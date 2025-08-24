const {
  Shelter,
  User,
  Pet,
  Post,
  Blog,
  Report,
  Donation,
} = require("../models/index");
const { cloudinary } = require("../configs/cloudinary");
const fs = require("fs");
const generateCodename = require("../utils/codeNameGenerator");
const db = require("../models/index");
const dayjs = require("dayjs");

const mongoose = require("mongoose");
const { mailer } = require("../configs");
const AdoptionForm = require("../models/adoptionForm.model");
const AdoptionSubmission = require("../models/adoptionSubmission.model");
const Species = require("../models/species.model");
const Breed = require("../models/breed.model");
const notificationService = require("./notification.service");

async function generateEligibleUserToInvite(shelterId){
  try{
// 1. Lấy tất cả memberId của các shelter đang active
    const shelters = await Shelter.find({ status: "active" }).select(
      "members._id"
    );
    const allMemberIds = shelters.flatMap((s) =>
      s.members.map((member) => member._id.toString())
    );

    // 2. Tìm user đã kích hoạt nhưng không nằm trong bất kỳ shelter nào
    const usersWithoutShelter = await User.find({
      status: "active",
      roles: { $in: ["user"] },
      _id: { $nin: allMemberIds },
    }).select("_id email avatar");

    // 3. Không có lời mời hoặc yêu cầu đang chờ xử lý trong shelter hiện tại
    const currentShelter = await Shelter.findById(shelterId);
    let userWithPendingInvitations = []
    for(let i=0; i< currentShelter.invitations.length; i++){
      if(currentShelter.invitations[i].status === "pending"){
        userWithPendingInvitations.push(String(currentShelter.invitations[i].user))
      }
    }
    const usersWithoutInvitations = usersWithoutShelter.filter(user => {
      if(!userWithPendingInvitations.includes(String(user?._id))){
        return user;
      }
    }) 

    return usersWithoutInvitations;
  }catch(error){
    console.log(error)
  }
}




//USER
async function getAll() {
  try {
    const shelters = await db.Shelter.find({ status: "active" })
      .populate("members._id")
      .lean();
    return shelters.map((s) => {
      return {
        ...s,
        members: s.members.map((m) => ({
          _id: String(m._id._id),
          fullName: m._id.fullName,
          avatar: m._id.avatar,
          roles: m.roles,
        })),
      };
    });
  } catch (error) {
    throw error;
  }
}

const getShelterById = async (shelterId) => {
  try {
    const shelter = await Shelter.findById(shelterId)
      .populate("members._id", "fullName avatar email roles status")
      .lean();
    if (!shelter) {
      throw new Error("Shelter not found");
    }
    return {
      ...shelter,
      members: shelter.members.map((m) => ({
        _id: String(m._id._id),
        fullName: m._id.fullName,
        avatar: m._id.avatar,
        email: m._id.email,
        roles: m.roles,
        status: m._id.status,
      })),
    };
  } catch (error) {
    throw error;
  }
};

const getShelterRequestByUserId = async (userId) => {
  try {
    
    const shelter = await Shelter.find({ "members._id": userId }).sort({createdAt: -1});
    const allShelters = await Shelter.find();
    let isEligible = true; //check dieu kien gui yeu cau
    let reason = "Đủ điều kiện để tạo yêu cầu thành lập trạm cứu hộ"; //ly do
    for (let i = 0; i < allShelters.length; i++) {
      if (["banned"].includes(allShelters[i].status) && 
      allShelters[i].members.find(member => String(member._id) === String(userId))) {
        reason = "Bạn đã bị ban khỏi việc thành lập trạm cứu hộ!";
        isEligible = false;
        break;
      }
      if (["active"].includes(allShelters[i].status) && 
      allShelters[i].members.find(member => String(member._id) === String(userId))) {
        reason = "Bạn đã thuộc về một trạm cứu hộ!";
        isEligible = false;
        break;
      }
      if (["verifying"].includes(allShelters[i].status) && 
      allShelters[i].members.find(member => String(member._id) === String(userId))) {
        reason = "Bạn có yêu cầu đang chờ xử lý!";
        isEligible = false;
        break;
      }
      const hasPendingInvitation = allShelters[i].invitations.find(invitation => 
        String(invitation.user) === String(userId) &&
        invitation.status === "pending");
      if(hasPendingInvitation){
        reason = "Bạn đã có yêu cầu hoặc lời mời vào trạm cứu hộ khác!";
        isEligible = false;
        break;
      }
    }
    return {
      isEligible,
      reason,
      shelterRequest: shelter.map((item) => {
        return {
          id: item._id,
          name: item.name,
          shelterCode: item.shelterCode,
          email: item.email,
          hotline: item.hotline,
          address: item.address,
          status: item.status,
          shelterLicenseURL: item.shelterLicense.url,
          aspiration: item.aspiration,
          rejectReason: item.rejectReason,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        };
      }),
    };
  } catch (error) {
    throw error;
  }
};
const sendShelterEstablishmentRequest = async (
  requesterId,
  shelterRequestData,
  shelterLicense
) => {
  try {
    if (!shelterLicense) {
      throw new Error(
        "Không tìm thấy giấy phép hoạt động! Vui lòng đính kèm giấy phép hoạt động"
      );
    }

    const location = shelterRequestData?.location
      ? JSON.parse(shelterRequestData?.location)
      : "Chưa cung cấp tọa độ của địa chỉ";
    if (location === "Chưa cung cấp tọa độ của địa chỉ") {
      throw new Error("Chưa cung cấp tọa độ của địa chỉ!");
    }

    const isShelterCodeExist = await Shelter.findOne({
      shelterCode: shelterRequestData.shelterCode,
      status: {$in: ["verifying", "active"]}
    });
    if (isShelterCodeExist) {
      throw new Error("Mã trạm đã tồn tại!");
    }

    const isNotEligible = await Shelter.findOne({
      "members._id": requesterId,
      invitations: {
        $elemMatch: {
          user: requesterId,
          status: "pending",
        },
      },
      status: { $in: ["active", "banned", "verifying"] },
    });
    if (isNotEligible) {
      throw new Error("Tài khoản không đủ điều kiện để gửi yêu cầu!");
    }

    const uploadResult = await cloudinary.uploader.upload(shelterLicense.path, {
      folder: "shelter_licenses",
      resource_type: "auto",
    });

    await Shelter.create({
      name: shelterRequestData.name,
      shelterCode: shelterRequestData.shelterCode,
      bio: "",
      email: shelterRequestData.email,
      hotline: shelterRequestData.hotline,
      address: shelterRequestData.address,
      location: location,
      members: [
        {
          _id: requesterId,
          roles: ["staff", "manager"],
        },
      ],
      shelterLicense: {
        fileName: shelterLicense?.originalname,
        url: uploadResult?.secure_url,
        size: shelterLicense?.size,
        mimeType: shelterLicense?.mimetype,
        createAt: new Date(),
        updateAt: new Date(),
      },
      aspiration: shelterRequestData.aspiration,
      foundationDate: new Date(),
    });

    return {
      status: 200,
      message: "Gửi yêu cầu thành lập trạm cứu hộ thành công",
    };
  } catch (error) {
    throw error;
  } finally {
    if (shelterLicense?.path) {
      fs.unlink(shelterLicense.path, (err) => {
        if (err) console.error("Lỗi xóa file shelter license ở local:", err);
      });
    }
  }
};

const getShelterProfile = async (shelterId) => {
  try {
    const shelter = await Shelter.findById(shelterId);

    if (!shelter) {
      throw new Error("Không tìm thấy shelter");
    }

    return {
      _id: shelter._id,
      name: shelter.name,
      shelterCode: shelter.shelterCode,
      bio: shelter.bio,
      email: shelter.email,
      hotline: shelter.hotline,
      avatar: shelter.avatar,
      address: shelter.address,
      background: shelter.background,
    };
  } catch (error) {
    throw error;
  }
};

const editShelterProfile = async (shelterId, updatedData) => {
  try {
    const shelter = await Shelter.findById(shelterId);
    if (!shelter) {
      throw new Error("Không tìm thấy trạm cứu hộ để cập nhật");
    }

    const updatedFields = {};

    // Các trường cơ bản
    const basicFields = [
      "name",
      "bio",
      "email",
      "hotline",
      "address",
      "location",
    ];
    for (const field of basicFields) {
      if (updatedData[field] !== undefined) {
        updatedFields[field] = updatedData[field];
      }
    }

    // Upload avatar nếu có
    if (updatedData.avatar && typeof updatedData.avatar === "object") {
      const result = await cloudinary.uploader.upload(updatedData.avatar.path, {
        folder: "shelter_profiles",
        resource_type: "image",
      });
      updatedFields.avatar = result.secure_url;
      fs.unlink(updatedData.avatar.path, () => {}); // xóa file local
    }

    // Upload background nếu có
    if (updatedData.background && typeof updatedData.background === "object") {
      const result = await cloudinary.uploader.upload(
        updatedData.background.path,
        {
          folder: "shelter_profiles",
          resource_type: "image",
        }
      );
      updatedFields.background = result.secure_url;
      fs.unlink(updatedData.background.path, () => {}); // xóa file local
    }

    // Cập nhật vào MongoDB
    const updatedShelter = await Shelter.findByIdAndUpdate(
      shelterId,
      { $set: updatedFields },
      { new: true, runValidators: true }
    );

    return {
      // name: updatedShelter.name,
      bio: updatedShelter.bio,
      email: updatedShelter.email,
      hotline: updatedShelter.hotline,
      avatar: updatedShelter.avatar,
      address: updatedShelter.address,
      background: updatedShelter.background,
    };
  } catch (error) {
    throw error;
  }
};
const cancelShelterEstabilshmentRequest = async (requestId) => {
  try {
    const shelter = await Shelter.findOne({ _id: requestId });
    if (!shelter) {
      throw new Error("Không tìm thấy shelter với requestId đã cho.");
    }
    if (["active", "banned", "rejected"].includes(shelter.status)) {
      throw new Error("Yêu cầu đã được xử lý trong quá khứ!");
    }

    await Shelter.findOneAndUpdate({ _id: requestId }, { status: "cancelled" });

    return {
      status: 200,
      message: "Hủy yêu cầu thành lập shelter thành công",
    };
  } catch (error) {
    throw error;
  }
};
const getShelterMembers = async (shelterId) => {
  try {
    const shelter = await Shelter.findById(shelterId).populate("members._id");
    if (!shelter) {
      throw new Error("Không tìm thấy shelter");
    }
    const formatUserOutput = (rawUser) => {
      const u = rawUser._id; // bản gốc nằm trong _id
      return {
        id: u._id?.toString?.() || "",

        avatar: u.avatar || null,
        background: u.background || null,
        bio: u.bio || null,
        email: u.email || null,
        fullName: u.fullName || null,
        phoneNumber: u.phoneNumber || null,
        status: u.status || null,
        warningCount: u.warningCount ?? 0,

        userRoles: u.roles || [],
        shelterRoles: rawUser.roles || [], // từ field ngoài cùng
      };
    };

    const formattedUsers = shelter.members.map(formatUserOutput);
    return formattedUsers;
  } catch (error) {
    throw error;
  }
};
// tim user du dieu kien de invite
const findEligibleUsersToInvite = async (shelterId) => {
  try {
    const eligibleUsers = await generateEligibleUserToInvite(shelterId);
    return eligibleUsers.map((user) => {
      return {
        email: user.email,
        avatar:user.avatar
      };
    });
  } catch (error) {
    console.error("Lỗi khi tìm user đủ điều kiện:", error.message);
    throw error;
  }
};

// shelter gui yeu cau cho user
const inviteShelterMembers = async (shelterId, emailsList = [], roles) => {
  try {
    const shelter = await Shelter.findById(shelterId);
    const eligibleUsers = await generateEligibleUserToInvite(shelterId);
    const eligibleUsersEmail = eligibleUsers.map(user => user.email);
    let eligibleEmailList = [];
    const invitationsToSend = [];

    for (const email of emailsList) {
      if(!eligibleUsersEmail.includes(email)){
        continue;
      }

      const userId = eligibleUsers.find(user => user.email === email && user?._id);
      // Tạo invitation mới
      const newInvitation = {
        _id: new mongoose.Types.ObjectId(),
        shelter: shelterId,
        user: userId,
        type: "invitation",
        roles,
        status: "pending",
        createdAt: new Date(),
        updatedAt: new Date(),
        expireAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 ngày
      };

      invitationsToSend.push(newInvitation);
      eligibleEmailList.push(email);
    }

    // console.log(invitationsToSend)
    // return {message: "OK"}

    // Push tất cả invitation vào shelter
    if (invitationsToSend.length > 0) {
      await Shelter.findByIdAndUpdate(
        shelterId,
        { $push: { invitations: { $each: invitationsToSend } } },
        { new: true }
      );
    }

    if(eligibleEmailList.length < 1){
      throw new Error("Không có tài khoản đủ điều kiện để mời")
    }

    // Gui email thong bao loi moi
    const link = `${process.env.FE_URL_USER}/shelter-request`;
    const subject = `Lời mời tham gia làm tình nguyện viên từ trạm cứu hộ ${shelter.name}`;
    const body = `
  <div style="font-family: Arial, sans-serif; padding: 20px;">
    <h2 style="color: #1890ff;">Bạn nhận được một lời mời tham gia trạm cứu hộ</h2>
    <p>Trạm cứu hộ <strong>${shelter.name}</strong> đã gửi lời mời bạn tham gia làm tình nguyện viên.</p>
    <p>Vui lòng nhấn vào nút bên dưới để xem và phản hồi lời mời:</p>
    <a href="${link}" style="display: inline-block; margin-top: 12px; padding: 10px 20px; background-color: #1890ff; color: white; text-decoration: none; border-radius: 5px;">
      Xem lời mời
    </a>
    <p style="margin-top: 20px; color: #666;">
      Nếu bạn không nhận được lời mời, vui lòng bỏ qua email này.
    </p>
  </div>
`;
    await mailer.sendEmail(eligibleEmailList, subject, body);

    return {
      message: "Đã gửi lời mời",
      count: invitationsToSend.length,
      invitations: invitationsToSend,
    };
  } catch (error) {
    console.error(error);
    throw error;
  }
};

// shelter lay danh sach cac yeu cau
const getShelterInvitationsAndRequests = async (shelterId) => {
  try {
    const tempShelter = await Shelter.findById(shelterId);
    if (!tempShelter) {
      throw new Error("Không tìm thấy shelter");
    }

    // update các invitation mà đã hết hạn sang expired
    await Shelter.updateMany(
      {
        _id: shelterId,
      },
      {
        $set: { "invitations.$[elem].status": "expired" },
      },
      {
        arrayFilters: [
          {
            "elem.status": "pending",
            "elem.expireAt": { $lt: new Date() },
          },
        ],
      }
    );

    const shelter = await Shelter.findById(shelterId).populate([
      { path: "invitations.shelter", select: "email name avatar" },
      { path: "invitations.user", select: "email fullName avatar" },
    ]);

    // Mapping dữ liệu đúng interface
    const formatted = shelter.invitations.map((invitation) => ({
      requestId: invitation._id,
      requestType: invitation.type || "No type found",
      shelter: {
        id: invitation.shelter._id,
        email: invitation.shelter.email,
        name: invitation.shelter.fullName,
        avatar: invitation.shelter.avatar,
      },
      user: {
        id: invitation.user._id,
        email: invitation.user.email,
        fullName: invitation.user.fullName,
        avatar: invitation.user.avatar,
      },
      roles: invitation.roles || [],
      requestStatus: invitation.status,
      createdAt: invitation.createdAt,
      updatedAt: invitation.updatedAt,
      expireAt: invitation.expireAt,
    }));

    return formatted.sort((a, b) => b.createdAt - a.createdAt);
  } catch (error) {
    throw error;
  }
};
// user lay danh sach cac yeu cau
const getUserInvitationsAndRequests = async (userId) => {
  try {
    // Tìm tất cả shelter có invitation liên quan đến user
    const shelters = await Shelter.find({
      "invitations.user": userId,
    })
      .select("invitations") // chỉ lấy trường invitations để gọn
      .populate("invitations.shelter", "email name avatar")
      .populate("invitations.user", "email fullName avatar");

    const results = shelters.flatMap((shelter) =>
      shelter.invitations
        .filter((inv) => String(inv.user?._id) === String(userId))
        .map((inv) => ({
          requestId: inv._id,
          requestType: inv.type, // "invitation" hoặc "request"
          shelter: inv.shelter
            ? {
                id: inv.shelter._id,
                email: inv.shelter.email,
                name: inv.shelter.name,
                avatar: inv.shelter.avatar,
              }
            : null,
          user: inv.user
            ? {
                id: inv.user._id,
                email: inv.user.email,
                fullName: inv.user.fullName,
                avatar: inv.user.avatar,
              }
            : null,
          roles: inv.roles || [],
          requestStatus: inv.status,
          createdAt: inv.createdAt,
          updatedAt: inv.updatedAt,
          expireAt: inv.expireAt,
        }))
    );

    return results.sort((a, b) => b.createdAt - a.createdAt);
  } catch (error) {
    console.error("Error in getUserInvitationsAndRequests:", error);
    throw error;
  }
};

// user xu ly loi moi vao shelter
const reviewShelterInvitationRequest = async (shelterId, userId, decision) => {
  // const session = await mongoose.startSession();
  // session.startTransaction(); // nếu fail thì revert lại hết
  try {
    // 1. Tìm shelter hiện tại
    const shelter = await Shelter.findById(shelterId);
    if (!shelter) {
      throw new Error("Không tìm thấy shelter");
    }

    // 2. Tìm invitation của user trong shelter này
    const currInvitation = shelter.invitations.find((inv) => {
      return (
        String(inv.user) === userId &&
        inv.type === "invitation" &&
        inv.status === "pending" &&
        inv
      );
    });

    if (!currInvitation) {
      throw new Error("Không tìm thấy lời mời phù hợp");
    }

    if (decision === "approve") {
      // 3. Cập nhật invitation thành "accepted"
      currInvitation.status = "accepted";
      currInvitation.updatedAt = new Date();

      // 4. Thêm user vào members nếu chưa có
      const alreadyMember = shelter.members.some((m) => m._id === userId);
      if (!alreadyMember) {
        shelter.members.push({
          _id: userId,
          roles: currInvitation.roles,
        });
      }

      await shelter.save();

      // 5. Huỷ các invitation/request khác của user từ các trạm khác
      await Shelter.updateMany(
        {
          _id: { $ne: shelterId },
          "invitations.user": userId,
          "invitations.status": "pending",
        },
        {
          $set: {
            "invitations.$[requestElem].status": "cancelled",
            "invitations.$[invitationElem].status": "declined"
          },
        },
        {
          arrayFilters: [
            {
              "requestElem.user": userId,
              "requestElem.type": "request",
              "requestElem.status": "pending",
            },
            {
              "invitationElem.user": userId,
              "invitationElem.type": "invitation",
              "invitationElem.status": "pending",
            },
          ],
        }
      );


    } else if (decision === "reject") {
      // Chuyển invitation thành "declined"
      currInvitation.status = "declined";
      currInvitation.updatedAt = new Date();
      await shelter.save();
    } else {
      throw new Error("Quyết định không hợp lệ");
    }

    // await session.commitTransaction();
    // session.endSession();

    return { success: true, message: "Xử lý thành công" };
  } catch (error) {
    // await session.abortTransaction();
    // session.endSession();
    throw error;
  }
};
const kickShelterMember = async (shelterId, userId) => {
  try {
    const shelter = await Shelter.findById(shelterId);
    if (!shelter) {
      throw new Error("Không tìm thấy shelter");
    }

    // Tìm member trong danh sách members
    const member = shelter.members.find(
      (member) => String(member._id) === userId
    );

    if (!member) {
      throw new Error("Thành viên không tồn tại trong shelter");
    }

    // Kiểm tra vai trò
    let memberRole = null;

    if (typeof member === "object" && member.roles) {
      memberRole = member.roles;
    } else {
      const user = await User.findById(userId);
      if (!user) throw new Error("Không tìm thấy người dùng");
    }

    if (member.roles.includes("manager")) {
      throw new Error("Không thể kick người có vai trò quản lý (manager)");
    }

    await Shelter.findByIdAndUpdate(
      shelterId,
      {
        $pull: {
          members: typeof member === "object" ? { _id: userId } : userId,
        },
      },
      { new: true }
    );

    return { message: "Đã xoá thành viên khỏi shelter" };
  } catch (error) {
    console.error("Lỗi khi xoá thành viên:", error.message);
    throw error;
  }
};
const requestIntoShelter = async (shelterEmail, senderId) => {
  try {
    const shelters = await Shelter.find({});

    const hasEstablishmentRequest = shelters.find(shelter => 
      shelter.members.find(member => String(member._id) === senderId) && 
      shelter.status === "verifying")
    if (hasEstablishmentRequest) {
      throw new Error("Bạn đang có yêu cầu thành lập trạm cứu hộ chờ xử lý");
    }

    const isInShelter = shelters.find(shelter => 
      shelter.members.find(member => String(member._id) === senderId) && 
      shelter.status === "active")
    if (isInShelter) {
      throw new Error("Bạn đã thuộc về một trạm cứu hộ rồi");
    }

    const shelter = await Shelter.findOne({ email: shelterEmail });
    if (!shelter) {
      throw new Error("Không tìm thấy shelter");
    }

    const user = await User.findById(senderId);
    if (!user) {
      throw new Error("Không tìm thấy người dùng");
    }

    // Check nếu đã là thành viên
    const isMember = shelter.members.some((member) => member._id === user._id);
    if (isMember) {
      throw new Error("Bạn đã là thành viên của trạm cứu hộ này");
    }

    // Check nếu đã gửi yêu cầu đang chờ xử lý
    const existing = shelter.invitations.find(
      (inv) =>
        String(inv.user) === String(user._id) &&
        inv.type === "request" &&
        inv.status === "pending"
    );
    if (existing) {
      throw new Error("Chỉ được gửi một yêu cầu duy nhất");
    }

    // Check nếu đã có lời mời từ phía shelter
    const hasInvitation = shelter.invitations.find(
      (inv) =>
        String(inv.user) === String(user._id) &&
        inv.type === "invitation" &&
        inv.status === "pending"
    );
    if (hasInvitation) {
      throw new Error("Bạn đã có lời mời vào trạm cứu hộ này! Vui lòng kiểm tra lời mời");
    }

    const newRequest = {
      _id: new mongoose.Types.ObjectId(),
      shelter: shelter._id,
      user: user._id,
      type: "request",
      roles: ["staff"],
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
      expireAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 ngày
    };

    await Shelter.findByIdAndUpdate(
      shelter._id,
      { $push: { invitations: newRequest } },
      { new: true }
    );

    return {
      message: "Đã gửi yêu cầu tham gia shelter",
      request: newRequest,
    };
  } catch (error) {
    console.error(error);
    throw error;
  }
};

const getEligibleShelters = async (userId) => {
  try {
    const shelters = await Shelter.find({
      status: "active",
      warningCount: { $lt: 3 },
      $nor: [
        {
          invitations: {
            $elemMatch: {
              user: userId,
              type: "invitation",
              status: "pending",
            },
          },
        },
        {
          invitations: {
            $elemMatch: {
              user: userId,
              type: "request",
              status: "pending",
            },
          },
        },
      ],
    });

    return shelters;
  } catch (error) {
    console.error(error);
    throw error;
  }
};
// xu ly yeu cau vao shelter cua manager
const reviewShelterRequest = async (shelterId, requestId, decision) => {
  try {
    const shelter = await Shelter.findById(shelterId);
    if (!shelter) {
      throw new Error("Không tìm thấy shelter");
    }

    const request = shelter.invitations.find(
      (inv) =>
        inv._id.toString() === requestId &&
        inv.type === "request" &&
        inv.status === "pending"
    );

    if (!request) {
      throw new Error("Không tìm thấy yêu cầu phù hợp hoặc đã được xử lý");
    }

    if (decision === "approve") {
      // Check user đã là thành viên chưa
      const isAlreadyMember = shelter.members.some(
        (member) => member._id.toString() === request.user.toString()
      );
      if (isAlreadyMember) {
        throw new Error("Người dùng đã là thành viên của shelter");
      }

      // Thêm user vào members
      shelter.members.push({
        _id: request.user,
        roles: request.roles,
      });
      request.status = "accepted";


      // Cancel các yêu cầu, lời mời khác của user ở các shelter khác
      await Shelter.updateMany(
        {
          _id: { $ne: shelterId },
          "invitations.user": request.user,
          "invitations.status": "pending",
        },
        {
          $set: {
            "invitations.$[requestElem].status": "cancelled",
            "invitations.$[invitationElem].status": "declined"
          },
        },
        {
          arrayFilters: [
            {
              "requestElem.user": request.user,
              "requestElem.type": "request",
              "requestElem.status": "pending",
            },
            {
              "invitationElem.user": request.user,
              "invitationElem.type": "invitation",
              "invitationElem.status": "pending",
            },
          ],
        }
      );

    } else if (decision === "reject") {
      request.status = "declined";
    } else {
      throw new Error(
        "Quyết định không hợp lệ (chỉ chấp nhận 'approve' hoặc 'reject')"
      );
    }

    request.updatedAt = new Date();

    await shelter.save();

    return {
      message: `Yêu cầu đã được ${
        decision === "approve" ? "chấp thuận" : "từ chối"
      }`,
      status: request.status,
    };
  } catch (error) {
    console.error("Lỗi xử lý yêu cầu shelter:", error);
    throw error;
  }
};

const getShelterCaringPetsCount = async (shelterId) => {
  return await Pet.countDocuments({
    shelter: shelterId,
    status: "unavailable",
  });
};

const getShelterAdoptedPetsCount = async (shelterId) => {
  return await Pet.countDocuments({ shelter: shelterId, status: "adopted" });
};

const getShelterPostsCount = async (shelterId) => {
  return await Post.countDocuments({ shelter: shelterId });
};

const getShelterMembersCount = async (shelterId) => {
  const shelter = await Shelter.findById(shelterId);
  return shelter?.members?.length || 0;
};

const getShelterPetGrowthByMonth = async (shelterId) => {
  const now = new Date();
  const firstDayOfYear = new Date(now.getFullYear(), 0, 1);
  const result = await Pet.aggregate([
    {
      $match: {
        shelter: new mongoose.Types.ObjectId(shelterId),
        createdAt: { $gte: firstDayOfYear },
      },
    },
    {
      $group: {
        _id: { $month: "$createdAt" },
        count: { $sum: 1 },
      },
    },
    {
      $sort: { _id: 1 },
    },
  ]);
  return result;
};
const changeShelterMemberRole = async (
  managerId,
  shelterId,
  memberId,
  roles
) => {
  try {
    if (managerId == memberId) {
      throw new Error("Quản lý không thể tự thay đổi vai trò của chính mình");
    }

    // Validate roles
    const validRoles = ["staff", "manager"];
    const isValid = roles.every((r) => validRoles.includes(r));
    if (!isValid) {
      throw new Error(
        "Vai trò không hợp lệ. Chỉ chấp nhận 'staff' hoặc 'manager'"
      );
    }

    // check so luong role
    if (roles.length < 1) {
      throw new Error("Mỗi user thành viên phải có ít nhất 1 vai trò");
    }

    // Cập nhật roles cho member trong mảng members
    const updatedShelter = await Shelter.findOneAndUpdate(
      {
        _id: shelterId,
        "members._id": memberId,
      },
      {
        $set: {
          "members.$.roles": roles,
        },
      },
      { new: true }
    );

    if (!updatedShelter) {
      throw new Error("Không tìm thấy shelter hoặc thành viên");
    }

    return {
      message: "Đã cập nhật vai trò thành viên",
      roles,
    };
  } catch (error) {
    console.error("Lỗi khi cập nhật vai trò shelter member:", error);
    throw error;
  }
};

const cancelRequestIntoShelter = async (userId, shelterId, requestId) => {
  try {
    const shelter = await Shelter.findById(shelterId);
    if(!shelter){
      throw new Error("Trạm cứu hộ không tồn tại")
    }
    const request = shelter.invitations.find(invitation => invitation.type === "request" && String(invitation.id) === String(requestId));
    if(!request){
      throw new Error("Yêu cầu vào trạm cứu hộ không tồn tại")
    }
    if(String(request.user) !== String(userId)){
      throw new Error("Chỉ có người tạo yêu cầu mới có quyền hủy yêu cầu")
    }
    request.status = "cancelled";
    await shelter.save();
    return {
      message: "Hủy yêu cầu tình nguyện vào trạm cứu hộ thành công!"
    }
  } catch (error) {
    throw(error)
  }
};
const cancelShelterInvitationById = async (userId, shelterId, invitationId) => {
  try {
    const shelter = await Shelter.findById(shelterId);
    if(!shelter){
      throw new Error("Trạm cứu hộ không tồn tại")
    }
    const invitation = shelter.invitations.find(invitation => invitation.type === "invitation" && String(invitation.id) === String(invitationId));
    if(!invitation){
      throw new Error("Lời mời vào trạm cứu hộ không tồn tại")
    }

    const isStaffOfShelter = shelter.members.find(member => String(member.id) === String(userId));
    if(!isStaffOfShelter){
      throw new Error("Chỉ có thành viên thuộc trạm cứu hộ gửi lời mời mới có quyền hủy lời mời")
    }

    if(invitation.status !== "pending"){
      throw new Error("Chỉ có thể hủy lời mời trong trạng thái chờ")
    }

    invitation.status = "cancelled";
    await shelter.save();
    return {
      message: "Hủy lời mời vào trạm cứu hộ thành công!"
    }
  } catch (error) {
    throw(error)
  }
};

// ADMIN
const getAllShelter = async () => {
  try {
    const shelters = await Shelter.find({
      status: { $in: ["active", "banned"] },
    });
    return shelters.map((shelter, index) => {
      return {
        _id: shelter?._id,
        avatar: shelter?.avatar,
        shelterCode: shelter?.shelterCode,
        name: shelter?.name,
        email: shelter?.email,
        hotline: shelter?.hotline,
        address: shelter?.address,
        createdBy: {
          fullName: shelter.members[0]._id.fullName,
          avatar: shelter.members[0]._id.avatar,
        },
        membersCount: shelter?.members.length,
        invitationsCount: shelter?.invitations.length,
        shelterLicenseURL: shelter?.shelterLicense.url,
        foundationDate: shelter?.foundationDate,
        warningCount: shelter?.warningCount,
        status: shelter?.status,
        createdAt: shelter?.createdAt,
        updatedAt: shelter?.updatedAt,
      };
    });
  } catch (error) {
    throw error;
  }
};
const getAllShelterEstablishmentRequests = async () => {
  try {
    const shelters = await Shelter.find({}).populate("members._id").sort({createdAt: -1});
    return shelters.map((shelter, index) => {
      return {
        _id: shelter._id,
        avatar: shelter.avatar,
        shelterCode: shelter.shelterCode,
        status: shelter.status,
        name: shelter.name,
        email: shelter.email,
        hotline: shelter.hotline,
        address: shelter.address,
        aspiration: shelter.aspiration,
        createdBy: {
          fullName: shelter.members[0]._id.fullName,
          avatar: shelter.members[0]._id.avatar,
        },
        rejectReason: shelter.rejectReason,
        shelterLicenseURL: shelter.shelterLicense.url,
        createdAt: shelter.createdAt,
        updateAt: shelter.updatedAt,
      };
    });
  } catch (error) {
    throw error;
  }
};
const getOverviewStatistic = async (selectedYear) => {
  try {
    const totalShelters = await Shelter.countDocuments();
    const totalUsers = await User.countDocuments();
    const rescuedPets = await Pet.countDocuments();
    const adoptedPets = await Pet.countDocuments({ status: "adopted" });
    const totalPosts = await Post.countDocuments();
    const totalBlogs = await Blog.countDocuments();
    const totalReports = await Report.countDocuments();
    const totalDonation = await Donation.aggregate([
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const donationAmount = totalDonation[0]?.total || 0;
    const totalSpecies = await Species.countDocuments();
    const totalBreeds = await Breed.countDocuments();

    // chart
    function matchDateField(field, from, to) {   // xử lý cả string hoặc date
      return {
        $expr: {
          $and: [
            { $gte: [{ $toDate: `$${field}` }, from] },
            { $lte: [{ $toDate: `$${field}` }, to] },
          ],
        },
      };
    }
    const startDate = new Date(`${selectedYear}-01-01T00:00:00.000Z`);
    const endDate = new Date(`${selectedYear}-12-31T23:59:59.999Z`);

    const months = Array.from(
      { length: 12 },
      (_, index) => `Tháng ${index + 1}`
    );
    const chartRawData = await db.Pet.find({
      status: "adopted",
      ...matchDateField("updatedAt", startDate, endDate),
    });
    const chartData = Array.from({ length: 12 }, (_, index) => ({
      month: months[index],
      amount: 0,
    }));
    for (const pet of chartRawData) {
      const monthIndex = dayjs(pet.updatedAt).month(); // 0-11
      chartData[monthIndex].amount++;
    }
    return {
      status: 200,
      message: "Lấy dữ liệu thống tổng quan thành công!",
      overviewStatistics: {
        shelter: totalShelters,
        user: totalUsers,
        pet: {
          rescuedPets: rescuedPets,
          adoptedPets: adoptedPets,
        },
        species: totalSpecies,
        breed: totalBreeds,
        post: totalPosts,
        blog: totalBlogs,
        report: totalReports,
        donation: donationAmount,
        chartData: chartData,
      },
    };
  } catch (error) {
    throw error;
  }
};
const reviewShelterEstablishmentRequest = async (adminId, requestId, decision = "reject", rejectReason = "No reason") => {
  try {
    const shelter = await Shelter.findOne({ _id: requestId }).populate("members._id");
    if (!shelter) {
      throw new Error("Không tìm thấy shelter với requestId đã cho.");
    }
    if (["active", "banned", "rejected"].includes(shelter.status)) {
      throw new Error("Yêu cầu đã được xử lý trong quá khứ!");
    }

    const admin = await User.findById(adminId);
    const requester = shelter?.members[0]._id;

    // hoan thanh viec thanh lap shelter
    if (decision === "approve") {
      await Shelter.findOneAndUpdate({ _id: requestId }, { status: "active" });
      await notificationService.createNotification(adminId, 
        requester._id, 
        "Yêu cầu thành lập trạm cứu hộ của bạn đã được chấp thuận",
        "system",
        `/shelters/${shelter._id}`);
    } else if (decision === "reject") {
      await Shelter.findOneAndUpdate(
        { _id: requestId },
        { status: "rejected", rejectReason: rejectReason }
      );
      await notificationService.createNotification(adminId, 
        requester._id, 
        "Yêu cầu thành lập trạm cứu hộ của bạn đã bị từ chối. Vui lòng xem chi tiết ở email",
        "system",
        `#`);
    } else {
      throw new Error("Thiếu quyết định!");
    }


    // gui email
    const subject = `Cập nhập yêu cầu thành lập trạm cứu hộ ${shelter?.name}`;
      const body = `
    <div>
      <p>Xin chào <b>${requester?.fullName}</b>,</p>
      <p>Chúng tôi xin thông báo về tình trạng yêu cầu thành lập trạm cứu hộ của bạn với các thông tin chi tiết dưới đây:</p>
      <div class="details">
        <p><strong>Tên trạm cứu hộ:</strong> ${shelter?.name}</p>
        <p><strong>Thời gian gửi yêu cầu:</strong> ${shelter?.createdAt}</p>
        <p><strong>Thời gian xử lý:</strong>  ${shelter?.updatedAt}</p>
        <p><strong>Quyết định:</strong> ${decision === "approve" ? "Chấp thuận" : "Từ chối"}</p>
        ${decision === "reject" && 
          `<p><strong>Lý do từ chối:</strong>  ${shelter?.rejectReason}</p>`}
      </div>
      <p>Vui lòng kiểm tra lại thông tin và phản hồi nếu có bất kỳ thắc mắc nào thông qua email sau ${admin?.email}.</p>
      <p>Trân trọng,</p>
      <p>PawShelter</p>
    </div>
    <div class="footer">
      <p style="opacity: 0.5; font-size: 0.9rem">Đây là email được gửi tự động. Vui lòng không trả lời email này.</p>
    </div>  
`;
      await mailer.sendEmail(requester.email, subject, body);

    // cancel các yêu cầu vào trạm cứu hộ khác và reject các lời mời vào trạm cứu hộ (nếu có)
    await Shelter.updateMany(
      {
        _id: { $ne: shelter._id },
        "invitations.user": requester._id,
        "invitations.status": "pending",
      },
      {
        $set: {
          "invitations.$[requestElem].status": "cancelled",
          "invitations.$[invitationElem].status": "declined",
        },
      },
      {
        arrayFilters: [
          {
            "requestElem.user": requester._id,
            "requestElem.type": "request",
            "requestElem.status": "pending",
          },
          {
            "invitationElem.user": requester._id,
            "invitationElem.type": "invitation",
            "invitationElem.status": "pending",
          },
        ],
      }
    );

    return {
      status: 200,
      message: "Xử lý yêu cầu thành lập shelter thành công",
      decision: decision === "approve" ? "Chấp thuận" : "Từ chối",
    };
  } catch (error) {
    throw error;
  }
};
const getISOWeekAndYear = (date) => {
  const tmp = new Date(date.getTime());
  tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((tmp - yearStart) / 86400000 + 1) / 7);
  return { week: weekNo, year: tmp.getUTCFullYear() };
};

const getStartEndOfISOWeek = (week, year) => {
  const simple = new Date(year, 0, 1 + (week - 1) * 7);
  const dow = simple.getDay();
  const start = new Date(simple);
  if (dow <= 4) start.setDate(simple.getDate() - simple.getDay() + 1);
  else start.setDate(simple.getDate() + 8 - simple.getDay());
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start, end };
};

const getAdoptedPetsByWeek = async (shelterId) => {
  const now = new Date();
  const twelveWeeksAgo = new Date(now);
  twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 7 * 12);

  const aggregation = await Pet.aggregate([
    {
      $match: {
        shelter: new mongoose.Types.ObjectId(shelterId),
        status: "adopted",
        updatedAt: { $gte: twelveWeeksAgo },
      },
    },
    {
      $project: {
        week: { $isoWeek: "$updatedAt" },
        year: { $isoWeekYear: "$updatedAt" },
      },
    },
    {
      $group: {
        _id: { week: "$week", year: "$year" },
        count: { $sum: 1 },
      },
    },
  ]);

  // Lấy 12 tuần gần nhất
  const currentDate = new Date();
  const weeks = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - i * 7);
    const { week, year } = getISOWeekAndYear(d);
    const { start, end } = getStartEndOfISOWeek(week, year);
    const label = `${start.toLocaleDateString(
      "vi-VN"
    )} - ${end.toLocaleDateString("vi-VN")}`;
    weeks.push({ week, year, label });
  }

  const formatted = weeks.map(({ label, week, year }) => {
    const found = aggregation.find(
      (item) => item._id.week === week && item._id.year === year
    );

    return {
      week: label,
      count: found?.count ?? 0, // Có thể bỏ random để đúng dữ liệu thực
    };
  });

  return formatted;
};

function getISOWeekNumber(date) {
  const tmp = new Date(date.getTime());
  tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((tmp - yearStart) / 86400000 + 1) / 7);
  return weekNo;
}

const getAdoptionFormsByWeek = async (shelterId) => {
  const now = new Date();
  const fourWeeksAgo = new Date();
  fourWeeksAgo.setDate(now.getDate() - 28);

  const forms = await db.AdoptionForm.aggregate([
    {
      $match: {
        shelter: new mongoose.Types.ObjectId(shelterId),
        createdAt: { $gte: fourWeeksAgo, $lte: now },
      },
    },
    {
      $addFields: {
        weekNumber: { $isoWeek: "$createdAt" },
        year: { $isoWeekYear: "$createdAt" },
      },
    },
    {
      $group: {
        _id: {
          week: "$weekNumber",
          year: "$year",
        },
        count: { $sum: 1 },
      },
    },
    {
      $sort: {
        "_id.year": 1,
        "_id.week": 1,
      },
    },
  ]);

  const result = [];
  for (let i = 3; i >= 0; i--) {
    const tmpDate = new Date();
    tmpDate.setDate(now.getDate() - i * 7);
    const week = getISOWeekNumber(tmpDate);
    const year = tmpDate.getUTCFullYear();

    const found = forms.find((f) => f._id.week === week && f._id.year === year);

    const start = dayjs(tmpDate).startOf("isoWeek");
    const end = dayjs(tmpDate).endOf("isoWeek");

    result.push({
      week: `${start.format("DD/MM")} - ${end.format("DD/MM")}`,
      count: found ? found.count : 0,
    });
  }

  return result;
};
const getSubmissionStatistics = async (shelterId) => {
  const submissions = await AdoptionSubmission.find()
    .populate({
      path: "adoptionForm",
      select: "shelter",
    })
    .lean();

  const filteredSubmissions = submissions.filter(
    (s) => s.adoptionForm?.shelter?.toString() === shelterId.toString()
  );

  const result = {
    approved: 0,
    rejected: 0,
    pending: 0,
    interviewing: 0,
    reviewed: 0,
  };

  for (const s of filteredSubmissions) {
    if (result.hasOwnProperty(s.status)) {
      result[s.status]++;
    }
  }

  return result;
};

function formatDayMonth(date) {
  const d = date.getDate().toString().padStart(2, "0");
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  return `${d}/${m}`;
}

const getAdoptionSubmissionsByWeek = async (shelterId) => {
  const now = dayjs().endOf("day").toDate();
  const fourWeeksAgo = dayjs().subtract(4, "week").startOf("day").toDate();

  const submissions = await db.AdoptionSubmission.aggregate([
    {
      $lookup: {
        from: "adoptionforms",
        localField: "adoptionForm",
        foreignField: "_id",
        as: "form",
      },
    },
    { $unwind: "$form" },
    {
      $match: {
        "form.shelter": new mongoose.Types.ObjectId(shelterId),
        createdAt: { $gte: fourWeeksAgo, $lte: now },
      },
    },
    {
      $addFields: {
        weekNumber: { $isoWeek: "$createdAt" },
        year: { $isoWeekYear: "$createdAt" },
      },
    },
    {
      $group: {
        _id: {
          week: "$weekNumber",
          year: "$year",
        },
        count: { $sum: 1 },
      },
    },
    {
      $sort: {
        "_id.year": 1,
        "_id.week": 1,
      },
    },
  ]);

  // Chuẩn hóa ra đúng 4 tuần gần nhất
  const result = [];
  for (let i = 3; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i * 7);

    const { week, year } = getISOWeekAndYear(d);
    const { start, end } = getStartEndOfISOWeek(week, year);

    const startLabel = formatDayMonth(start);
    const endLabel = formatDayMonth(end);

    const label = `${startLabel} - ${endLabel}`;

    const found = submissions.find(
      (f) => f._id.week === week && f._id.year === year
    );

    result.push({
      week: label,
      count: found ? found.count : 0,
    });
  }

  return result;
};


const shelterService = {
  // USER
  getAll,
  getShelterById,
  sendShelterEstablishmentRequest,
  getShelterRequestByUserId,
  getShelterProfile,
  editShelterProfile,
  getShelterMembers,
  findEligibleUsersToInvite,
  inviteShelterMembers,
  getShelterInvitationsAndRequests,
  getUserInvitationsAndRequests,
  cancelShelterEstabilshmentRequest,
  reviewShelterInvitationRequest,
  kickShelterMember,
  requestIntoShelter,
  getEligibleShelters,
  reviewShelterRequest,
  getShelterCaringPetsCount,
  getShelterAdoptedPetsCount,
  getShelterPostsCount,
  getShelterMembersCount,
  getShelterPetGrowthByMonth,
  changeShelterMemberRole,
  cancelRequestIntoShelter,
  cancelShelterInvitationById,

  //MANAGER
  getAdoptedPetsByWeek,
  getSubmissionStatistics,
  getAdoptionFormsByWeek,
  getAdoptionSubmissionsByWeek,

  // ADMIN
  getAllShelter,
  getAllShelterEstablishmentRequests,
  getOverviewStatistic,
  reviewShelterEstablishmentRequest,
};

module.exports = shelterService;
