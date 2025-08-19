const { cloudinary } = require("../configs/cloudinary");
const db = require("../models");
const fs = require("fs/promises");
const notificationService = require("./notification.service");
const adoptionSubmissionService = require("./adoptionSubmission.service");
const socketIoService = require("./socket-io.service");

const getByShelter = async (shelterId) => {
  try {
    const consentForms = await db.ConsentForm.find({ shelter: shelterId })
      .populate("shelter", "_id name address avatar status")
      .populate("adopter", "_id fullName avatar phoneNumber address status")
      .populate(
        "pet",
        "_id name photos petCode status identificationFeature sterilizationStatus isMale  "
      )
      .populate("createdBy", "_id fullName avatar phoneNumber address status");

    return consentForms;
  } catch (error) {
    // console.error('Error fetching consent forms by shelter:', error);
    throw error;
  }
};

const getByUser = async (userId) => {
  try {
    const consentForms = await db.ConsentForm.find({ adopter: userId })
      .populate("shelter", "_id name address avatar status")
      .populate("adopter", "_id fullName avatar phoneNumber address status")
      .populate(
        "pet",
        "_id name photos petCode status identificationFeature sterilizationStatus isMale  "
      )
      .populate("createdBy", "_id fullName avatar phoneNumber address status");

    // if(!consentForms || consentForms.length === 0) {
    //    throw new Error("Không tìm thấy bản đồng ý nào cho người dùng này.");
    // }

    return consentForms;
  } catch (error) {
    // console.error('Error fetching consent forms by user:', error);
    throw error;
  }
};

const getById = async (consentFormId) => {
  try {
    const consentForm = await db.ConsentForm.findById(consentFormId)
      .populate("shelter", "_id name address avatar status")
      .populate("adopter", "_id fullName avatar phoneNumber address status")
      .populate(
        "pet",
        "_id name photos petCode status identificationFeature sterilizationStatus isMale  "
      )
      .populate("createdBy", "_id fullName avatar phoneNumber address status");

    if (!consentForm) {
      throw new Error("Không tìm thấy bản đồng ý với ID đã cho.");
    }

    return consentForm;
  } catch (error) {
    // console.error('Error fetching consent form by ID:', error);
    throw error;
  }
};

const createForm = async (consentForm) => {
  try {
    const isExisted = await db.ConsentForm.findOne({
      pet: consentForm.pet,
      adopter: consentForm.adopter,
    });

    if (isExisted) {
      throw new Error(
        "Chỉ có thể tạo duy nhất một bản đồng ý cho một thú nuôi và người nhận nuôi!"
      );
    }

    const attachmentsRaw = consentForm.attachments;

    const attachments = [];

    if (attachmentsRaw && attachmentsRaw.length > 0) {
      for (const attachment of attachmentsRaw) {
        const { originalname, path, size, mimetype } = attachment;
        try {
          const uploadedPhoto = await cloudinary.uploader.upload(path, {
            folder: "consentForms",
            resource_type: "auto",
          });
          if (!uploadedPhoto) {
            throw Error("Lỗi khi upload tệp đính kèm!");
          }
          attachments.push({
            fileName: originalname,
            url: uploadedPhoto.secure_url,
            size: size || 0,
            mimeType: mimetype,
          });

          await fs.unlink(attachment.path);
        } catch (error) {
          throw error;
        }
      }
    }

    const newConsentForm = new db.ConsentForm({
      ...consentForm,
      attachments: attachments,
      status: "draft",
    });
    const savedConsentForm = await newConsentForm.save();
    if (!savedConsentForm) {
      throw new Error(
        "Lỗi khi lưu bản đồng ý nhận nuôi. Vui lòng thử lại sau."
      );
    }
    const populatedConsentForm = await db.ConsentForm.findById(
      savedConsentForm._id
    )
      .populate("shelter", "_id name address avatar status")
      .populate("adopter", "_id fullName avatar phoneNumber address status")
      .populate(
        "pet",
        "_id name photos petCode status identificationFeature sterilizationStatus isMale  "
      )
      .populate("createdBy", "_id fullName avatar phoneNumber address status");

    return populatedConsentForm;
  } catch (error) {
    throw error;
  }
};

// const editForm = async (consentFormId, updateForm) => {
//   try {
//     const consentForm = await db.ConsentForm.findById(consentFormId)
//       .populate("shelter", "_id name address avatar status")
//       .populate("adopter", "_id fullName avatar phoneNumber address status")
//       .populate(
//         "pet",
//         "_id name photos petCode status identificationFeature sterilizationStatus isMale  "
//       )
//       .populate("createdBy", "_id fullName avatar phoneNumber address status");

//     if (!consentForm) {
//       throw new Error("Không tìm thấy bản đồng ý với ID đã cho.");
//     }
//     if (consentForm.status != "draft") {
//       throw new Error(
//         "Chỉ có thể chỉnh sửa bản đồng ý nhận nuôi trong trạng thái nháp."
//       );
//     }
//     const attachmentsRaw = updateForm.attachments;

//     const attachments = [];

//     if (attachmentsRaw && attachmentsRaw.length > 0) {
//       for (const attachment of attachmentsRaw) {
//         const { originalname, path, size, mimetype } = attachment;
//         try {
//           const uploadedPhoto = await cloudinary.uploader.upload(path, {
//             folder: "consentForms",
//             resource_type: "auto",
//           });
//           if (!uploadedPhoto) {
//             throw Error("Lỗi khi upload tệp đính kèm!");
//           }
//           attachments.push({
//             fileName: originalname,
//             url: uploadedPhoto.secure_url,
//             size: size || 0,
//             mimeType: mimetype || "application/octet-stream",
//           });

//           await fs.unlink(attachment.path);
//         } catch (error) {
//           throw error;
//         }
//       }
//     }

//     const updatedConsentForm = await db.ConsentForm.findByIdAndUpdate(
//       consentFormId,
//       {
//         ...updateForm,
//         attachments: attachments,
//       },
//       { new: true }
//     )
//       .populate("shelter", "_id name address avatar status")
//       .populate("adopter", "_id fullName avatar phoneNumber address status")
//       .populate(
//         "pet",
//         "_id name photos petCode status identificationFeature sterilizationStatus isMale  "
//       )
//       .populate("createdBy", "_id fullName avatar phoneNumber address status");

//     if (!updatedConsentForm) {
//       throw new Error(
//         "Lỗi khi cập nhật bản đồng ý nhận nuôi. Vui lòng thử lại sau."
//       );
//     }
//     return updatedConsentForm;
//   } catch (error) {
//     throw error;
//   }
// };

const editForm = async (consentFormId, updateForm) => {
  try {
    const consentForm = await db.ConsentForm.findById(consentFormId)
      .populate("shelter", "_id name address avatar status")
      .populate("adopter", "_id fullName avatar phoneNumber address status")
      .populate(
        "pet",
        "_id name photos petCode status identificationFeature sterilizationStatus isMale  "
      )
      .populate("createdBy", "_id fullName avatar phoneNumber address status");

    if (!consentForm) {
      throw new Error("Không tìm thấy bản đồng ý với ID đã cho.");
    }
    if (consentForm.status != "draft") {
      throw new Error(
        "Chỉ có thể chỉnh sửa bản đồng ý nhận nuôi trong trạng thái nháp."
      );
    }
    
    const updatedConsentForm = await db.ConsentForm.findByIdAndUpdate(
      consentFormId,
      {
        ...updateForm
      },
      { new: true }
    )
      .populate("shelter", "_id name address avatar status")
      .populate("adopter", "_id fullName avatar phoneNumber address status")
      .populate(
        "pet",
        "_id name photos petCode status identificationFeature sterilizationStatus isMale  "
      )
      .populate("createdBy", "_id fullName avatar phoneNumber address status");

    if (!updatedConsentForm) {
      throw new Error(
        "Lỗi khi cập nhật bản đồng ý nhận nuôi. Vui lòng thử lại sau."
      );
    }
    return updatedConsentForm;
  } catch (error) {
    throw error;
  }
};
const uploadConsent = async (consentFormId, updateForm) => {
  try {
    const consentForm = await db.ConsentForm.findById(consentFormId)
      .populate("shelter", "_id name address avatar status")
      .populate("adopter", "_id fullName avatar phoneNumber address status")
      .populate(
        "pet",
        "_id name photos petCode status identificationFeature sterilizationStatus isMale  "
      )
      .populate("createdBy", "_id fullName avatar phoneNumber address status");

    if (!consentForm) {
      throw new Error("Không tìm thấy bản đồng ý với ID đã cho.");
    }
    if (consentForm.status != "draft") {
      throw new Error(
        "Chỉ có thể chỉnh sửa bản đồng ý nhận nuôi trong trạng thái nháp."
      );
    }
    const attachmentsRaw = updateForm.attachments;

    const attachments = [];

    if (attachmentsRaw && attachmentsRaw.length > 0) {
      for (const attachment of attachmentsRaw) {
        const { originalname, path, size, mimetype } = attachment;
        try {
          const uploadedPhoto = await cloudinary.uploader.upload(path, {
            folder: "consentForms",
            resource_type: "auto",
          });
          if (!uploadedPhoto) {
            throw Error("Lỗi khi upload tệp đính kèm!");
          }
          attachments.push({
            fileName: originalname,
            url: uploadedPhoto.secure_url,
            size: size || 0,
            mimeType: mimetype || "application/octet-stream",
          });

          await fs.unlink(attachment.path);
        } catch (error) {
          throw error;
        }
      }
    }

    const updatedConsentForm = await db.ConsentForm.findByIdAndUpdate(
      consentFormId,
      {
        attachments: attachments,
      },
      { new: true }
    )
      .populate("shelter", "_id name address avatar status")
      .populate("adopter", "_id fullName avatar phoneNumber address status")
      .populate(
        "pet",
        "_id name photos petCode status identificationFeature sterilizationStatus isMale  "
      )
      .populate("createdBy", "_id fullName avatar phoneNumber address status");

    if (!updatedConsentForm) {
      throw new Error(
        "Lỗi khi cập nhật bản đồng ý nhận nuôi. Vui lòng thử lại sau."
      );
    }
    return updatedConsentForm;
  } catch (error) {
    throw error;
  }
};

const deleteFile = async (consentFormId, fileId) => {
  try {
    const consentForm = await db.ConsentForm.findById(consentFormId)
      .populate("shelter", "_id name address avatar status")
      .populate("adopter", "_id fullName avatar phoneNumber address status")
      .populate(
        "pet",
        "_id name photos petCode status identificationFeature sterilizationStatus isMale  "
      )
      .populate("createdBy", "_id fullName avatar phoneNumber address status");

    if (!consentForm) {
      throw new Error("Không tìm thấy bản đồng ý với ID đã cho.");
    }
    if (consentForm.status != "draft") {
      throw new Error(
        "Chỉ có thể chỉnh sửa bản đồng ý nhận nuôi trong trạng thái nháp."
      );
    }
    
    const attachments = consentForm.attachments.filter((f)=>f._id!= fileId)

    const updatedConsentForm = await db.ConsentForm.findByIdAndUpdate(
      consentFormId,
      {
        attachments: attachments,
      },
      { new: true }
    )
      .populate("shelter", "_id name address avatar status")
      .populate("adopter", "_id fullName avatar phoneNumber address status")
      .populate(
        "pet",
        "_id name photos petCode status identificationFeature sterilizationStatus isMale  "
      )
      .populate("createdBy", "_id fullName avatar phoneNumber address status");

    if (!updatedConsentForm) {
      throw new Error(
        "Lỗi khi cập nhật bản đồng ý nhận nuôi. Vui lòng thử lại sau."
      );
    }
    return updatedConsentForm;
  } catch (error) {
    throw error;
  }
};

const changeFormStatusShelter = async (consentFormId, status) => {
  try {
    const consentForm = await db.ConsentForm.findById(consentFormId);
    if (!consentForm) {
      throw new Error("Không tìm thấy bản đồng ý với ID đã cho.");
    }

    const oldStatus = consentForm.status;

    if (!["draft", "approved", "send"].includes(status)) {
      throw new Error("Không thể chuyển về trạng thái này!");
    }

    if (oldStatus === "draft" && status !== "send") {
      throw new Error("Không thể chuyển đến trạng thái này!");
    }

    if (["approved", "accepted"].includes(oldStatus) && status === "draft") {
      throw new Error("Không thể chuyển về trạng thái nháp!");
    }

    if (oldStatus === "cancelled") {
      throw new Error(
        "Người nhận nuôi đã hủy yêu cầu nhận nuôi! Vui lòng chọn ứng viên khác!"
      );
    }

    const updatedConsentForm = await db.ConsentForm.findByIdAndUpdate(
      consentFormId,
      { status },
      { new: true }
    )
      .populate("shelter", "_id name address avatar status")
      .populate("adopter", "_id fullName avatar phoneNumber address status")
      .populate(
        "pet",
        "_id name photos petCode status identificationFeature sterilizationStatus isMale"
      )
      .populate("createdBy", "_id fullName avatar phoneNumber address status");

    if (!updatedConsentForm) {
      throw new Error("Cập nhật trạng thái thất bại.");
    }

    if (status == "send") {
      const notificationSend = await notificationService.createNotification(
        updatedConsentForm.createdBy._id,
        [updatedConsentForm.adopter._id],
        `Trung tâm cứu hộ ${updatedConsentForm.shelter.name} đã gửi cho bạn bản đồng ý nhận nuôi bạn ${updatedConsentForm.pet.name}!`,
        "adoption",
        `/adoption-form/${updatedConsentForm.pet._id}`
      );
      socketIoService.to(`user:${updatedConsentForm.adopter._id}`, `notification`, notificationSend)

      socketIoService.to(
        `user:${updatedConsentForm.adopter._id}`,
        "consentForm:statusChanged",
        {
          consentFormId: updatedConsentForm._id.toString(),
          petId: updatedConsentForm.pet._id.toString(),
          status: "send",
        }

      );
    }
    if (status == "approved") {
      try {
        const submissionsRaw =
          await adoptionSubmissionService.getSubmissionsByPetIds([
            updatedConsentForm.pet._id,
          ]);

        if (!submissionsRaw || submissionsRaw.length == 0) {
          throw new Error("Không tìm thấy đơn nhận nuôi nào.");
        }

        const otherSubs = submissionsRaw
          .filter((submission) =>
            String(submission?.performedBy?._id ?? submission?.performedBy) !==
            String(updatedConsentForm?.adopter?._id)
          )
          .map((submission) => ({
            submissionId: submission._id.toString(),
            userId: (submission?.performedBy?._id ?? submission?.performedBy).toString(),
            selectedSchedule: Boolean(submission?.interview?.selectedSchedule),
          }));

        const otherAdopterIds = otherSubs.map(s => s.userId);

        const updatedPet = await db.Pet.findOneAndUpdate(
          { _id: updatedConsentForm?.pet?._id },
          { status: "adopted", adopter: updatedConsentForm?.adopter?._id },
          { new: true }
        );
        if (!updatedPet) {
          await db.ConsentForm.findByIdAndUpdate(consentFormId, {
            status: oldStatus,
          });

          throw new Error("Lỗi khi cập nhật trạng thái thú nuôi!");
        }
        // console.log(
        //   "ngu",
        //   Array.isArray(otherAdopterIds) && otherAdopterIds.length > 0
        // );
        if (Array.isArray(otherAdopterIds) && otherAdopterIds.length > 0) {
          const updatedSubmissions =
            await adoptionSubmissionService.updateManySubmissionStatus(
              otherAdopterIds,
              updatedConsentForm?.pet?._id
            );
          const notifOthers = await notificationService.createNotification(
            updatedConsentForm.createdBy._id,
            otherAdopterIds,
            `Thú cưng ${updatedConsentForm.pet.name} đã được nhận nuôi bởi người khác. Cảm ơn bạn đã quan tâm!`,
            "adoption",
            `/pet/${updatedConsentForm.pet._id}`
          );
          try {
            for (const { userId, submissionId, selectedSchedule } of otherSubs) {
              socketIoService.to(`user:${userId}`, "notification", notifOthers);

              socketIoService.to(
                `user:${userId}`,
                "adoptionSubmission:statusChanged",
                {
                  submissionId,
                  petId: updatedConsentForm.pet._id.toString(),
                  status: "rejected",
                  selectedSchedule,
                }
              );
            }

          } catch (emitErr) {
            console.error("Emit adoptionSubmission:statusChanged (others) failed:", emitErr);
          }

          if (!updatedSubmissions) {
            await db.Pet.findByIdAndUpdate(updatedConsentForm.pet._id, {
              status: "available",
              adopter: null,
            });
            await db.ConsentForm.findByIdAndUpdate(consentFormId, {
              status: oldStatus,
            });
            throw new Error(
              "Lỗi khi cập nhật trạng thái các người nhận nuôi khác!"
            );
          }
        }

        const updatedForm = await db.AdoptionForm.findOneAndUpdate(
          { pet: updatedConsentForm?.pet?._id, status: "active" },
          { status: "archived" },
          { new: true }
        );

        if (!updatedForm) {
          await db.Pet.findOneAndUpdate(
            { _id: updatedConsentForm?.pet?._id },
            { status: "available", adopter: null },
            { new: true }
          );

          await db.ConsentForm.findByIdAndUpdate(consentFormId, {
            status: oldStatus,
          });

          throw new Error("Lỗi khi cập nhật trạng thái đơn đăng ký nhận nuôi!");
        }

        const approvedNoti = await notificationService.createNotification(
          updatedConsentForm.createdBy._id,
          [updatedConsentForm.adopter._id],
          `Trung tâm cứu hộ ${updatedConsentForm.shelter.name} đã duyệt bản đồng ý nhận nuôi bạn ${updatedConsentForm.pet.name}!`,
          "adoption",
          `/adoption-form/${updatedConsentForm.pet._id}`
        );
        socketIoService.to(`user:${updatedConsentForm.adopter._id}`, `notification`, approvedNoti)
        try {
          socketIoService.to(
            `user:${updatedConsentForm.adopter._id}`,
            "consentForm:statusChanged",
            {
              consentFormId: updatedConsentForm._id.toString(),
              petId: updatedConsentForm.pet._id.toString(),
              status: "approved",
            }

          );
        } catch (e) {
          console.error("Emit to adopter (approved) failed:", e);
        }


      } catch (rejectError) {
        await db.ConsentForm.findByIdAndUpdate(consentFormId, {
          status: oldStatus,
        });
        throw new Error(rejectError || "Cập nhật thất bại!");
      }
    }

    try {
      socketIoService.to(
        `shelter:${updatedConsentForm.shelter._id}`,
        "consentForm:statusChanged",
        {
          consentFormId: updatedConsentForm._id.toString(),
          petId: updatedConsentForm.pet._id.toString(),
          status,
          adopterId: updatedConsentForm.adopter._id.toString(),
        }
      );
    } catch (emitErr) {
      console.error("Emit consentForm:statusChanged failed:", emitErr);
    }


    return updatedConsentForm;
  } catch (error) {
    console.log("error", error);
    throw new Error(error.message || "Có lỗi xảy ra khi cập nhật trạng thái.");
  }
};

const changeFormStatusUser = async (consentFormId, status, note, userId) => {
  try {
    const consentForm = await db.ConsentForm.findById(consentFormId);

    if (!consentForm) {
      throw new Error("Không tìm thấy bản đồng ý với ID đã cho.");
    }

    if (String(consentForm.adopter) != String(userId)) {
      throw new Error("Bạn không có quyền thay đổi trạng thái bản đồng ý này.");
    }

    if (["draft", "approved"].includes(status)) {
      throw new Error("Không thể chuyển về trạng thái này!");
    }

    if (consentForm.status == "cancelled") {
      throw new Error("Người nhận nuôi đã hủy yêu cầu nhận nuôi!");
    }

    const oldStatus = consentForm.status;

    const existedShelter = await db.Shelter.findById(consentForm.shelter);
    if (!existedShelter) {
      throw new Error("Không tìm thấy trung tâm!");
    }
    const shelterMembers = existedShelter?.members?.map((m) => m?._id);

    const updatedConsentForm = await db.ConsentForm.findByIdAndUpdate(
      consentFormId,
      { status: status, note: note },
      { new: true }
    )
      .populate("shelter", "_id name address avatar status")
      .populate("adopter", "_id fullName avatar phoneNumber address status")
      .populate(
        "pet",
        "_id name photos petCode status identificationFeature sterilizationStatus isMale"
      )
      .populate("createdBy", "_id fullName avatar phoneNumber address status");

    if (!updatedConsentForm) {
      throw new Error("Không thể cập nhật bản đồng ý.");
    }

    if (status == "cancelled") {
      try {
        await adoptionSubmissionService.updateManySubmissionStatus(
          updatedConsentForm?.adopter?._id,
          updatedConsentForm?.pet?._id
        );

        const cancelledNoti = await notificationService.createNotification(
          updatedConsentForm.createdBy._id,
          [...shelterMembers],
          `Người nhận nuôi bạn ${updatedConsentForm.pet.name} đã hủy yêu cầu nhận nuôi!`,
          "adoption",
          `/shelters/${consentForm?.shelter?._id}/management/consent-forms/${updatedConsentForm?._id}`
        );
        socketIoService.to(`shelter:${updatedConsentForm.shelter._id}`, `notification`, cancelledNoti)

      } catch (err) {
        await db.ConsentForm.findByIdAndUpdate(consentFormId, {
          status: oldStatus,
        });
        throw new Error("Hủy yêu cầu nhận nuôi thất bại do lỗi xử lý từ chối.");
      }
    }

    if (status == "accepted") {
      const approvedNoti = await notificationService.createNotification(
        updatedConsentForm.createdBy._id,
        [...shelterMembers],
        `Người nhận nuôi bạn ${updatedConsentForm.pet.name} đã chấp nhận bản đồng ý nhận nuôi!`,
        "adoption",
        `/shelters/${consentForm?.shelter?._id}/management/consent-forms/${updatedConsentForm?._id}`
      );
      socketIoService.to(`shelter:${updatedConsentForm.shelter._id}`, `notification`, approvedNoti)
    }

    if (status == "rejected") {
      const rejectedNoti = await notificationService.createNotification(
        updatedConsentForm.createdBy._id,
        [...shelterMembers],
        `Người nhận nuôi bạn ${updatedConsentForm.pet.name} yêu cầu chỉnh sửa lại thông tin bản cam kết! Liên hệ người nhận nuôi để sửa lại các thông tin cần thiết!`,
        "adoption",
        `/shelters/${consentForm?.shelter?._id}/management/consent-forms/${updatedConsentForm?._id}`
      );
      socketIoService.to(`shelter:${updatedConsentForm.shelter._id}`, `notification`, rejectedNoti)
    }

    try {
      socketIoService.to(
        `user:${updatedConsentForm.adopter._id}`,
        "consentForm:statusChanged",
        {
          consentFormId: updatedConsentForm._id.toString(),
          petId: updatedConsentForm.pet._id.toString(),
          status, // accepted | rejected | cancelled
        }
      );
      socketIoService.to(
        `shelter:${updatedConsentForm.shelter._id}`,
        "consentForm:statusChanged",
        {
          consentFormId: updatedConsentForm._id.toString(),
          petId: updatedConsentForm.pet._id.toString(),
          status,
          adopterId: updatedConsentForm.adopter._id.toString(),
        }
      );
    } catch (emitErr) {
      console.error("Emit consentForm:statusChanged failed:", emitErr);
    }

    return updatedConsentForm;
  } catch (error) {
    throw error;
  }
};

const deleteForm = async (consentFormId) => {
  try {
    const consentForm = await db.ConsentForm.findById(consentFormId);
    if (!consentForm) {
      throw new Error("Không tìm thấy bản đồng ý với ID đã cho.");
    }
    if (consentForm.status != "draft") {
      throw new Error("Chỉ có thể xóa bản đồng ý trong trạng thái nháp.");
    }

    const deletedConsentForm = await db.ConsentForm.findByIdAndDelete(
      consentFormId
    );

    return deletedConsentForm;
  } catch (error) {
    throw error;
  }
};

const consentFormService = {
  getByShelter,
  getByUser,
  getById,
  createForm,
  editForm,
  deleteFile,
  uploadConsent,
  changeFormStatusShelter,
  changeFormStatusUser,
  deleteForm,
};

module.exports = consentFormService;
