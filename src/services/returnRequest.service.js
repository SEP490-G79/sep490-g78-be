const db = require("../models");
const { cloudinary } = require("../configs/cloudinary");
const fs = require("fs/promises");
const NotificationService = require("./notification.service");
const adoptionFormService = require("./adoptionForm.service");

const safeUser = (user) => ({
  _id: user?._id ?? null,
  fullName: user?.fullName ?? "",
  email: user?.email ?? "",
  avatar: user?.avatar ?? "",
  phoneNumber: user?.phoneNumber ?? "",
  dob: user?.dob ?? null,
  bio: user?.bio ?? "",
  address: user?.address ?? "",
  background: user?.background ?? "",
  location: {
    lat: user?.location?.lat ?? 0,
    lng: user?.location?.lng ?? 0,
  },
  warningCount: user?.warningCount ?? 0,
  createdAt: user?.createdAt ?? null,
  updatedAt: user?.updatedAt ?? null,
});

const createReturnRequest = async (userId, data, files) => {
  const uploadedPhotoUrls = [];

  try {
    const { pet, shelter, reason } = data;
    if (!pet || !shelter) throw new Error("Thiếu thông tin pet hoặc shelter");
    if (!reason || reason.trim() === "") throw new Error("Lý do là bắt buộc");
    if (!files || files.length === 0) {
      throw new Error("Cần ít nhất một ảnh");
    }
    if (files.length > 5) {
      throw new Error("Chỉ được tải lên tối đa 5 ảnh");
    }

    const adoptedPet = await db.Pet.findById(pet);
    if (!adoptedPet) throw new Error("Không tìm thấy thú cưng");
    if (
      !adoptedPet.adopter ||
      adoptedPet.adopter.toString() !== userId.toString()
    ) {
      throw new Error("Bạn không phải người đã nhận nuôi thú cưng này");
    }

    const existingRequest = await db.ReturnRequest.findOne({
      pet,
      requestedBy: userId,
      status: { $in: ["pending", "approved"] },
    });

    if (existingRequest) {
      throw new Error(
        "Bạn đã gửi yêu cầu trả thú cưng này và đang chờ duyệt hoặc đã được duyệt!"
      );
    }

    for (const file of files) {
      try {
        const result = await cloudinary.uploader.upload(file.path, {
          folder: "return-requests",
          resource_type: "image",
        });
        uploadedPhotoUrls.push(result.secure_url);
        await fs.unlink(file.path);
      } catch (uploadError) {
        console.error("Upload error:", uploadError);
        throw new Error("Lỗi khi upload ảnh lên Cloudinary");
      }
    }

    const returnRequest = await db.ReturnRequest.create({
      requestedBy: userId,
      pet,
      shelter,
      reason,
      photos: uploadedPhotoUrls,
      status: "pending",
    });

    const shelterDoc = await db.Shelter.findById(shelter);
    if (!shelterDoc) throw new Error("Không tìm thấy shelter");

    const receiverIds = shelterDoc.members
      .filter((m) => m.roles.includes("manager") || m.roles.includes("staff"))
      .map((m) => m._id);

    if (receiverIds.length === 0) {
      throw new Error(
        "Shelter không có thành viên nào hợp lệ để nhận thông báo"
      );
    }

    await NotificationService.createNotification(
      userId,
      receiverIds,
      "Có một yêu cầu trả thú cưng mới",
      "other",
      `/shelter/return-requests/${returnRequest._id}`
    );

    return returnRequest;
  } catch (error) {
    throw error;
  }
};

const updateReturnRequest = async (requestId, userId, updateData, files) => {
  const uploadedPhotoUrls = [];

  try {
    const existingPhotos = JSON.parse(updateData.existingPhotos || "[]");

    if (!requestId || !userId) {
      throw new Error("Request ID và User ID là bắt buộc");
    }
    if (!updateData.reason || updateData.reason.trim() === "") {
      throw new Error("Lý do trả thú cưng là bắt buộc");
    }
    if (existingPhotos.length === 0 && (!files || files.length === 0)) {
      throw new Error("Cần ít nhất một ảnh");
    }
    if (files.length > 5) {
      throw new Error("Tối đa 5 ảnh được phép tải lên");
    }

    const request = await db.ReturnRequest.findById(requestId);
    if (!request) throw new Error("Không tìm thấy yêu cầu");

    if (!request.requestedBy.equals(userId)) {
      throw new Error("Bạn không có quyền chỉnh sửa yêu cầu này");
    }

    if (request.status !== "pending") {
      throw new Error("Chỉ có thể chỉnh sửa yêu cầu khi đang chờ duyệt");
    }

    for (const file of files) {
      try {
        const result = await cloudinary.uploader.upload(file.path, {
          folder: "return-requests",
          resource_type: "image",
        });
        uploadedPhotoUrls.push(result.secure_url);
        await fs.unlink(file.path);
      } catch (uploadError) {
        console.error("Upload error:", uploadError);
        throw new Error("Lỗi khi upload ảnh lên Cloudinary");
      }
    }

    const updatedRequest = await db.ReturnRequest.findByIdAndUpdate(
      requestId,
      {
        reason: updateData.reason,
        photos: [...existingPhotos, ...uploadedPhotoUrls],
      },
      { new: true }
    )
      .populate("pet")
      .populate("shelter");

    const shelter = await db.Shelter.findById(request.shelter);
    if (!shelter) throw new Error("Không tìm thấy shelter");

    const receiverIds = shelter.members.map((m) => m._id);
    const validReceivers = await db.User.find({
      _id: { $in: receiverIds },
      status: { $ne: "banned" },
    });

    if (!validReceivers.length) {
      throw new Error("Shelter không có người nhận thông báo hợp lệ");
    }

    await NotificationService.createNotification(
      userId,
      validReceivers.map((u) => u._id),
      `Yêu cầu trả thú cưng đã được cập nhật.`,
      "other",
      `/shelter/return-requests/${requestId}`
    );

    return updatedRequest;
  } catch (error) {
    throw error;
  }
};

// const getReturnRequests = async ({ userId, shelterId }) => {
//   const query = {};
//   try {
//     if (!userId && !shelterId) {
//       throw new Error("Either userId or shelterId must be provided");
//     }
//     if (userId) query.requestedBy = userId;
//     if (shelterId) query.shelter = shelterId;

//     return db.ReturnRequest.find(query)
//       .populate("pet requestedBy shelter approvedBy")
//       .sort({ createdAt: -1 });
//   } catch (error) {
//     throw new Error(`Error fetching return requests: ${error.message}`);
//   }
// };

const getReturnRequestsByUser = async (userId) => {
  try {
    if (!userId) throw new Error("Thiếu id người dùng");

    const returnRequests = await db.ReturnRequest.find({
      requestedBy: userId,
      status: { $ne: "cancelled" },
    })
      .populate("pet requestedBy shelter approvedBy")
      .sort({ createdAt: -1 });

    const result = returnRequests.map((request) => {
      return {
        _id: request._id,
        pet: {
          _id: request.pet._id,
          name: request.pet.name,
          status: request.pet.status,
          age: request.pet.age,
          petCode: request.pet.petCode,
          photos: request.pet.photos,
          isMale: request.pet.isMale,
        },
        requestedBy: safeUser(request.requestedBy),
        shelter: {
          _id: request.shelter._id,
          name: request.shelter.name,
          address: request.shelter.address,
          email: request.shelter.email,
          avatar: request.shelter.avatar,
          status: request.shelter.status,
        },
        status: request.status,
        reason: request.reason,
        photos: request.photos,
        createdAt: request.createdAt,
        updatedAt: request.updatedAt,
        approvedBy: safeUser(request.approvedBy),
        rejectReason: request.rejectReason || null,
      };
    });

    return result;
  } catch (error) {
    throw error;
  }
};

const getReturnRequestsByUserId = async (userId) => {
  try {
    if (!userId) throw new Error("Thiếu id người dùng");

    const returnRequests = await db.ReturnRequest.find({ requestedBy: userId })
      .populate("pet requestedBy shelter approvedBy")
      .sort({ createdAt: -1 });

    const result = returnRequests.map((request) => {
      return {
        _id: request._id,
        pet: {
          _id: request.pet._id,
          name: request.pet.name,
          status: request.pet.status,
          age: request.pet.age,
          petCode: request.pet.petCode,
          photos: request.pet.photos,
          isMale: request.pet.isMale,
        },
        requestedBy: safeUser(request.requestedBy),
        shelter: {
          _id: request.shelter._id,
          name: request.shelter.name,
          address: request.shelter.address,
          email: request.shelter.email,
          avatar: request.shelter.avatar,
          status: request.shelter.status,
        },
        status: request.status,
        reason: request.reason,
        photos: request.photos,
        createdAt: request.createdAt,
        updatedAt: request.updatedAt,
        approvedBy: safeUser(request.approvedBy),
        rejectReason: request.rejectReason || null,
      };
    });

    return result;
  } catch (error) {
    throw error;
  }
};

const getReturnRequestsByShelter = async (shelterId) => {
  try {
    if (!shelterId) throw new Error("Thiếu id shelter");

    const returnRequests = await db.ReturnRequest.find({ shelter: shelterId })
      .populate("pet requestedBy shelter approvedBy")
      .sort({ createdAt: -1 });

    const result = returnRequests.map((request) => {
      return {
        _id: request._id,
        pet: {
          _id: request.pet._id,
          name: request.pet.name,
          status: request.pet.status,
          age: request.pet.age,
          petCode: request.pet.petCode,
          photos: request.pet.photos,
          isMale: request.pet.isMale,
        },
        requestedBy: safeUser(request.requestedBy),
        shelter: {
          _id: request.shelter._id,
          name: request.shelter.name,
          address: request.shelter.address,
          email: request.shelter.email,
          avatar: request.shelter.avatar,
          status: request.shelter.status,
        },
        status: request.status,
        reason: request.reason,
        rejectReason: request.rejectReason || null,
        photos: request.photos,
        createdAt: request.createdAt,
        updatedAt: request.updatedAt,
        approvedBy: safeUser(request.approvedBy),
      };
    });

    return result;
  } catch (error) {
    throw error;
  }
};

const deleteReturnRequest = async (requestId, userId) => {
  try {
    if (!requestId || !userId) {
      throw new Error("Thiếu Request ID và User ID");
    }
    const request = await db.ReturnRequest.findById(requestId);
    if (!request) throw new Error("Không tìm thấy yêu cầu");

    if (!request.requestedBy.equals(userId)) {
      throw new Error("Bạn không có quyền xoá yêu cầu này");
    }

    if (request.status === "pending") {
      const updatedRequest = await db.ReturnRequest.findByIdAndUpdate(
        requestId,
        { status: "cancelled" },
        { new: true }
      )
        .populate("pet")
        .populate("shelter");
      return updatedRequest;
    }
  } catch (error) {
    throw error;
  }
};

const approveReturnRequest = async (requestId, shelterUserId) => {
  try {
    if (!requestId || !shelterUserId) {
      throw new Error("Thiếu Request ID và Shelter User ID");
    }
    const request = await db.ReturnRequest.findById(requestId).populate("pet");
    if (!request) throw new Error("Không tìm thấy yêu cầu");

    if (request.status !== "pending") {
      throw new Error("Không thể duyệt yêu cầu không ở trạng thái pending");
    }
    const oldAdopter = request.pet?.adopter || null;

    const updatedRequest = await db.ReturnRequest.findByIdAndUpdate(
      requestId,
      { status: "approved", approvedBy: shelterUserId },
      { new: true }
    );

    if (!updatedRequest) {
      throw new Error("Lỗi khi xác nhận yêu cầu!");
    }

    const updatedPet = await db.Pet.findByIdAndUpdate(
      request.pet,
      { $set: { status: "unavailable", adopter: null } },
      { new: true }
    );

    if (!updatedPet) {
      await db.ReturnRequest.findByIdAndUpdate(requestId, {
        status: "pending",
        approvedBy: null,
      });
      throw new Error("Lỗi khi đổi trạng thái thú nuôi!");
    }

    const updatedForm = await adoptionFormService.duplicateForm(
      updatedPet?._id,
      request?.shelter
    );

    if (!updatedForm) {
      await db.Pet.findByIdAndUpdate(
        request.pet,
        { status: "available", adopter: oldAdopter },
        { new: true }
      );
      await db.ReturnRequest.findByIdAndUpdate(requestId, {
        status: "pending",
        approvedBy: null,
      });
      throw new Error("Lỗi khi khởi tạo lại đơn đăng ký nhận nuôi!");
    }

    // await db.AdoptionForm.updateMany(
    //   { pet: request.pet._id, status: "active" },
    //   { status: "draft" }
    // );

    // const relatedForms = await db.AdoptionForm.find({ pet: request.pet._id });
    // const relatedFormIds = relatedForms.map((form) => form._id);

    // await db.AdoptionSubmission.updateMany(
    //   {
    //     adoptionForm: { $in: relatedFormIds },
    //     status: "approved",
    //   },
    //   { status: "rejected" }
    // );
    const shelter = await db.Shelter.findById(request.shelter).select("name");
    await NotificationService.createNotification(
      shelterUserId,
      [request.requestedBy],
      ` - ${shelter?.name || "Trạm cứu hộ"} Yêu cầu trả thú cưng đã được duyệt`,
      "other",
      `/profile/${request.requestedBy}?tab=return-request`
    );

    return request;
  } catch (error) {
    throw error;
  }
};

const rejectReturnRequest = async (requestId, shelterUserId, rejectReason) => {
  try {
    if (!requestId || !shelterUserId) {
      throw new Error("Thiếu Request ID và Shelter User ID");
    }

    if (!rejectReason || rejectReason.trim() === "") {
      throw new Error("Thiếu lý do từ chối");
    }

    const request = await db.ReturnRequest.findById(requestId);
    if (!request) throw new Error("Không tìm thấy yêu cầu");

    if (request.status !== "pending") {
      throw new Error(
        "Không thể từ chối yêu cầu không đang ở trạng thái pending"
      );
    }

    const rejectRequest = await db.ReturnRequest.findByIdAndUpdate(
      requestId,
      {
        status: "rejected",
        approvedBy: shelterUserId,
        rejectReason: rejectReason.trim(),
      },
      { new: true }
    );

    const shelter = await db.Shelter.findById(request.shelter).select("name");

    await NotificationService.createNotification(
      shelterUserId,
      [request.requestedBy],
      ` - ${shelter?.name || "Trạm cứu hộ"} Yêu cầu trả thú cưng đã bị từ chối`,
      "other",
      `/profile/${request.requestedBy}?tab=return-request`
    );

    return rejectRequest;
  } catch (error) {
    throw error;
  }
};

const returnRequestService = {
  createReturnRequest,
  updateReturnRequest,
  //getReturnRequests,
  getReturnRequestsByUser,
  getReturnRequestsByUserId,
  getReturnRequestsByShelter,
  deleteReturnRequest,
  approveReturnRequest,
  rejectReturnRequest,
};

module.exports = returnRequestService;
