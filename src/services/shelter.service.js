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
    const shelter = await Shelter.find({ "members._id": userId });
    let isEligible = true; //check dieu kien gui yeu cau
    let reason = "Đủ điều kiện để tạo yêu cầu thành lập trạm cứu hộ"; //ly do
    for (let i = 0; i < shelter.length; i++) {
      if (["banned"].includes(shelter[i].status)) {
        reason = "Bạn đã bị ban khỏi việc thành lập trạm cứu hộ!";
        isEligible = false;
        break;
      }
      if (["active"].includes(shelter[i].status)) {
        reason = "Bạn đã thuộc về một trạm cứu hộ!";
        isEligible = false;
        break;
      }
      if (["verifying"].includes(shelter[i].status)) {
        reason = "Bạn có yêu cầu đang chờ xử lý!";
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
  { shelterLicense }
) => {
  try {
    if (!shelterLicense[0]) {
      throw new Error(
        "Không tìm thấy giấy phép hoạt động! Vui lòng đính kèm giấy phép hoạt động"
      );
    }

    const isShelterCodeExist = await Shelter.findOne({
      shelterCode: shelterRequestData.shelterCode,
    });
    if (isShelterCodeExist) {
      throw new Error("Mã trạm đã tồn tại!");
    }

    const isNotEligible = await Shelter.findOne({
      "members._id": requesterId,
      status: { $in: ["active", "banned", "verifying"] },
    });
    if (isNotEligible) {
      // Xoa file o local
      fs.unlink(shelterLicense[0].path, (err) => {
        if (err) console.error("Lỗi xóa file ở local:", err);
      });
      throw new Error("Tài khoản không đủ điều kiện để gửi yêu cầu!");
    }

    const uploadResult = await cloudinary.uploader.upload(
      shelterLicense[0].path,
      {
        folder: "shelter_licenses",
        resource_type: "raw",
      }
    );
    // Xoa file o local
    fs.unlink(shelterLicense[0].path, (err) => {
      if (err) console.error("Lỗi xóa file ở local:", err);
    });

    const shelter = await Shelter.create({
      name: shelterRequestData.name,
      shelterCode: shelterRequestData.shelterCode,
      bio: "",
      email: shelterRequestData.email,
      hotline: shelterRequestData.hotline,
      avatar: "https://res.cloudinary.com/dpaht6o2y/image/upload/v1753884169/0265e65863c0d910bf1553816c432275_qfl6nk.jpg",
      address: shelterRequestData.address,
      location: shelterRequestData.location,
      background: "https://res.cloudinary.com/dpaht6o2y/image/upload/v1753884183/279dcca3f058ad75a2f3d256799c4634_zt7z3j.jpg",
      members: [
        {
          _id: requesterId,
          roles: ["staff", "manager"],
        },
      ],
      shelterLicense: {
        fileName: shelterLicense[0]?.originalname,
        url: uploadResult?.secure_url,
        size: shelterLicense[0]?.size,
        mimeType: shelterLicense[0]?.mimetype,
        createAt: new Date(),
        updateAt: new Date(),
      },
      aspiration: shelterRequestData.aspiration,
      foundationDate: new Date(), //tam thoi
      status: "verifying",
      warningCount: 0,
    });

    return {
      status: 200,
      message: "Gửi yêu cầu thành lập trạm cứu hộ thành công",
      shelterRequest: shelter,
    };
  } catch (error) {
    // Xoa file o local
    fs.unlink(shelterLicense[0].path, (err) => {
      if (err) console.error("Lỗi xóa file ở local:", err);
    });
    throw error;
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

    // const shelterMember = shelter.members.map(member => {
    //   return {
    //     avatar: member._id.name,
    //     fullName: string;
    //     email: string;
    //     roles: [string];
    //     status: string;
    //     createdAt: Date;
    //     updatedAt:
    //   }
    // })
    const formattedUsers = shelter.members.map(formatUserOutput);
    // console.log(formattedUsers)
    return formattedUsers;
  } catch (error) {
    throw error;
  }
};
// tim user du dieu kien de invite
const findEligibleUsersToInvite = async (shelterId) => {
  try {
    // 1. Không thuộc trạm cứu hộ hiện tại
    const currentMemberIds = (await getShelterMembers(shelterId)).map(
      (member) => member.id
    );
    const notCurrentMembers = await User.find({
      _id: { $nin: currentMemberIds },
    });
    // console.log(notCurrentMembers)

    // 2. Tài khoản đã kích hoạt
    const activatedAccount = notCurrentMembers.filter(
      (user) => user.status === "active"
    );
    // console.log(activatedAccount);

    // 3. Không là thành viên của trạm cứu hộ nào khác
    const allShelterMembers = await Shelter.find({ status: "active" }).select(
      "members"
    );
    const memberIdSet = new Set(allShelterMembers.map((id) => id.toString()));
    const notInAnyShelter = activatedAccount.filter(
      (user) => !memberIdSet.has(user._id)
    );
    // console.log(notInAnyShelter);

    // 3. Không có yêu cầu thành lập trạm cứu hộ nào
    const verifyingShelters = await Shelter.find({
      status: "verifying",
    }).select("members");
    const verifyingCreators = new Set(
      verifyingShelters
        .filter((s) => s.members?.length > 0)
        .map((s) => s.members[0])
    );
    const eligibleUsers = notInAnyShelter.filter(
      (user) => !verifyingCreators.has(user._id)
    );

    // 4. Không có lời mời hoặc yêu cầu đang chờ xử lý trong shelter hiện tại
    const currentShelter = await Shelter.findById(shelterId).select(
      "invitations"
    );
    const pendingReceivers = new Set(
      currentShelter.invitations
        .filter((inv) => inv.status === "pending")
        .map((inv) => inv.user.toString())
    );

    const finalEligibleUsers = eligibleUsers.filter(
      (user) => !pendingReceivers.has(user._id.toString())
    );

    // console.log(eligibleUsers);
    return finalEligibleUsers.map((user) => {
      return {
        email: user.email,
        avatar:
          user.avatar ||
          "https://static.vecteezy.com/system/resources/thumbnails/009/292/244/small/default-avatar-icon-of-social-media-user-vector.jpg",
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
    if (!shelter) {
      throw new Error("Không tìm thấy shelter");
    }

    const invitationsToSend = [];

    for (const email of emailsList) {
      const user = await User.findOne({ email });
      if (!user) {
        console.warn(`Không tìm thấy người dùng với email ${email}`);
        continue;
      }

      // Check nếu user đã là member
      const isMember = shelter.members.some(
        (member) => member._id.toString() === user._id.toString()
      );
      if (isMember) {
        console.warn(`${email} đã là thành viên`);
        continue;
      }

      // Check nếu đã có lời mời đang pending
      const existing = shelter.invitations.find(
        (inv) =>
          inv.user.toString() === user._id.toString() &&
          inv.status === "pending"
      );
      if (existing) {
        console.warn(`Đã có lời mời pending cho ${email}`);
        continue;
      }

      // Tạo invitation mới
      const newInvitation = {
        _id: new mongoose.Types.ObjectId(),
        shelter: shelterId,
        user: user._id,
        type: "invitation",
        roles,
        status: "pending",
        createdAt: new Date(),
        updatedAt: new Date(),
        expireAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 ngày
      };

      invitationsToSend.push(newInvitation);
    }

    // Push tất cả invitation vào shelter
    if (invitationsToSend.length > 0) {
      await Shelter.findByIdAndUpdate(
        shelterId,
        { $push: { invitations: { $each: invitationsToSend } } },
        { new: true }
      );
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
    await mailer.sendEmail(emailsList, subject, body);

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
    const shelter = await Shelter.findById(shelterId).populate([
      { path: "invitations.shelter", select: "email name avatar" },
      { path: "invitations.user", select: "email fullName avatar" },
    ]);

    if (!shelter) {
      throw new Error("Không tìm thấy shelter");
    }
    console.log(shelter);

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

    return formatted;
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

    return results;
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

    // console.log(currInvitation)
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
            "invitations.$[elem].status": "cancelled",
          },
        },
        {
          arrayFilters: [
            {
              "elem.user": userId,
              "elem.status": "pending",
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
    // console.log(shelterId, requestId, decision)
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
    const shelters = await Shelter.find({}).populate("members._id");
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
const reviewShelterEstablishmentRequest = async ({
  requestId,
  decision = "reject",
  rejectReason = "No reason",
}) => {
  try {
    const shelter = await Shelter.findOne({ _id: requestId });
    if (!shelter) {
      throw new Error("Không tìm thấy shelter với requestId đã cho.");
    }
    if (["active", "banned", "rejected"].includes(shelter.status)) {
      throw new Error("Yêu cầu đã được xử lý trong quá khứ!");
    }

    // hoan thanh viec thanh lap shelter
    if (decision === "approve") {
      await Shelter.findOneAndUpdate({ _id: requestId }, { status: "active" });
    } else if (decision === "reject") {
      await Shelter.findOneAndUpdate(
        { _id: requestId },
        { status: "rejected", rejectReason: rejectReason }
      );
      return {
        status: 200,
        message: "Xử lý yêu cầu thành lập shelter thành công",
        decision: decision === "approve" ? "Chấp thuận" : "Từ chối",
      };
    } else {
      throw new Error("Thiếu quyết định!");
    }

    // reject cac yeu cau moi vao shelter (neu co)

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
    const tmpDate = dayjs().subtract(i, "week");
    const week = getISOWeekNumber(tmpDate.toDate());
    const year = tmpDate.year();

    const found = submissions.find(
      (f) => f._id.week === week && f._id.year === year
    );

    result.push({
      week: `${tmpDate.startOf("isoWeek").format("DD/MM")} - ${tmpDate
        .endOf("isoWeek")
        .format("DD/MM")}`,
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
