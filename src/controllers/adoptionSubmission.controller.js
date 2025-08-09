const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../models/index");
const adoptionSubmissionService = require("../services/adoptionSubmission.service");
const AdoptionSubmission = require("../models/adoptionSubmission.model");
const { mailer } = require("../configs");
const { default: mongoose } = require("mongoose");
const { format } = require("date-fns");
const notificationService = require("../services/notification.service");


const getAdtoptionRequestList = async (req, res) => {
  try {
    const adoptionRequests =
      await adoptionSubmissionService.getAdtoptionRequestList(req.payload.id);
    res.status(200).json(adoptionRequests);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const getSubmissionsByUser = async (req, res) => {
  try {
    const userId = req.params.userId;
    const result = await adoptionSubmissionService.getSubmissionsByUserId(
      userId
    );
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// submit adoption request for user
const createAdoptionSubmission = async (req, res) => {
  try {
    const { adoptionFormId, answers } = req.body;
    const userId = req.payload.id;

    // 1. Validate: thiếu dữ liệu đầu vào
    if (!adoptionFormId) {
      return res
        .status(400)
        .json({ message: "Thiếu adoptionFormId." });
    }

    // 2. Kiểm tra tồn tại form
    const adoptionForm = await db.AdoptionForm.findById(
      adoptionFormId
    ).populate("pet");
    if (!adoptionForm) {
      return res.status(404).json({ message: "Form nhận nuôi không tồn tại." });
    }

    if (adoptionForm.status !== "active") {
      return res
        .status(400)
        .json({ message: "Form nhận nuôi không còn khả dụng." });
    }

    if (adoptionForm.pet.status !== "available") {
      return res
        .status(400)
        .json({ message: "Thú cưng không còn khả dụng để nhận nuôi." });
    }

    // 3. Validate câu hỏi trong form
    const formQuestionIds = adoptionForm.questions.map((q) => q._id.toString());
    const answerQuestionIds = answers.map((a) => a.questionId?.toString());

    for (const qId of answerQuestionIds) {
      if (!formQuestionIds.includes(qId)) {
        return res.status(400).json({
          message: `Câu hỏi với ID '${qId}' không thuộc form này.`,
        });
      }
    }

    // 4. Lấy thông tin câu hỏi để validate selections
    const questions = await db.Question.find({
      _id: { $in: answerQuestionIds },
    });
    const questionMap = new Map(questions.map((q) => [q._id.toString(), q]));

    for (const answer of answers) {
      const question = questionMap.get(answer.questionId?.toString());
      if (!question) {
        return res.status(400).json({
          message: `Không tìm thấy câu hỏi với ID: ${answer.questionId}`,
        });
      }

      const { type, options } = question;
      const selections = answer.selections;

      if (!Array.isArray(selections)) {
        return res.status(400).json({
          message: `Answer cho câu hỏi '${question.title}' phải là một mảng.`,
        });
      }

      if (type === "SINGLECHOICE") {
        if (!options.some((opt) => opt.title === selections[0])) {
          return res.status(400).json({
            message: `Lựa chọn '${selections[0]}' không hợp lệ cho câu hỏi '${question.title}'.`,
          });
        }
      }

      if (type === "MULTIPLECHOICE") {
        for (const sel of selections) {
          if (!options.some((opt) => opt.title === sel)) {
            return res.status(400).json({
              message: `Lựa chọn '${sel}' không hợp lệ cho câu hỏi '${question.title}'.`,
            });
          }
        }
      }

      if (type === "YESNO") {
        const validYesNo = ["Có", "Không"];
        if (!validYesNo.includes(selections[0])) {
          return res.status(400).json({
            message: `Câu hỏi '${question.title}' chỉ chấp nhận 'Có' hoặc 'Không'.`,
          });
        }
      }

      if (type === "TEXT") {
        if (
          typeof selections[0] !== "string" ||
          !selections[0].trim()
        ) {
          return res.status(400).json({
            message: `Câu hỏi '${question.title}' yêu cầu một câu trả lời dạng văn bản.`,
          });
        }
      }
    }

    // 5. Đếm số pet đã nhận trong 1 tháng
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    const adoptionsLastMonth = await db.Pet.countDocuments({
      adopter: userId,
      status: "adopted",
      updatedAt: { $gte: oneMonthAgo },
    });

    // 6. Tính điểm
    const weightMap = { none: 0, low: 1, medium: 2, high: 3 };
    let totalScore = 0;
    let maxScore = 0;

    for (const answer of answers) {
      const question = questionMap.get(answer.questionId.toString());
      if (!question) continue;

      const correctOptions = question.options.filter((opt) => opt.isTrue);
      const totalCorrect = correctOptions.length;
      if (totalCorrect === 0) continue;

      const userCorrect = (answer.selections || []).filter((sel) =>
        correctOptions.some((opt) => opt.title === sel)
      ).length;

      const weight = weightMap[question.priority] || 0;
      maxScore += weight;
      totalScore += (userCorrect / totalCorrect) * weight;
    }

    const matchPercentage =
      maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

    // 7. Kiểm tra đã nộp đơn chưa
    const existing = await db.AdoptionSubmission.findOne({
      performedBy: userId,
      adoptionForm: adoptionFormId,
    });

    if (existing) {
      return res
        .status(400)
        .json({ message: "Bạn đã nộp đơn cho thú cưng này rồi." });
    }

    // Lấy form và kiểm tra shelter
    const form = await db.AdoptionForm.findById(adoptionFormId).populate({
      path: "pet",
      populate: { path: "shelter" },
    });

    if (!form || !form.pet || !form.pet.shelter) {
      return res.status(400).json({ message: "Form hoặc thú cưng không hợp lệ." });
    }
    const shelter = form.pet.shelter;
    const isMember = shelter.members.some(
      (member) => member._id.toString() === userId
    );

    if (isMember) {
      return res.status(403).json({
        message: "Bạn không thể gửi đơn vì bạn là thành viên của trạm cứu hộ này.",
      });
    }
    // Tạo đơn
    const submission = new db.AdoptionSubmission({
      performedBy: userId,
      adoptionForm: adoptionFormId,
      answers,
      adoptionsLastMonth,
      total: matchPercentage,
    });

    const saved = await submission.save();
    res.status(201).json(saved);

    // Gửi thông báo cho shelter 
    const shelterReceivers = shelter.members.filter(
      (m) => m.roles?.includes("manager") || m.roles?.includes("staff")
    );

    const receiverIds = shelterReceivers.map((m) => m._id);

    if (receiverIds.length > 0) {
      const content = `đã gửi yêu cầu nhận nuôi "${form.pet.name}"`;
      const redirectUrl = `/shelters/${shelter._id}/management/submission-forms/${form.pet._id}`;

      await notificationService.createNotification(
        userId,
        receiverIds,
        content,
        "adoption",
        redirectUrl
      );
    }


    setTimeout(async () => {
      try {
        // Gửi email xác nhận
        const user = await db.User.findById(userId);
        const form = await db.AdoptionForm.findById(adoptionFormId).populate({
          path: "pet",
          populate: { path: "shelter", select: "name" },
        });

        if (user && user.email && form && form.pet) {
          const to = user.email;
          const petName = form.pet.name || "thú cưng";
          const shelterName = form.pet.shelter?.name || "Trung tâm cứu hộ";

          const subject = "Xác nhận đăng ký nhận nuôi";

          const body = `
        <div style="font-family: Arial, sans-serif; line-height: 1.5;">
          <h2>Cảm ơn bạn đã gửi đơn nhận nuôi!</h2>
          <p>Xin chào <strong>${user.fullName || "bạn"}</strong>,</p>
          <p>Chúng tôi rất cảm kích vì bạn đã gửi đơn nhận nuôi cho thú cưng <strong>${petName}</strong> từ trung tâm <strong>${shelterName}</strong>.</p>
          <p>Đơn của bạn đã được tiếp nhận và đang chờ xét duyệt. Chúng tôi sẽ xem xét và phản hồi bạn trong thời gian sớm nhất.</p>
          <p style="margin-top: 20px;">Trân trọng,<br>${shelterName}</p>
        </div>
      `;

          await mailer.sendEmail(to, subject, body);
        }

      } catch (error) {
        console.log(error)
      }
    }, 0);

  } catch (err) {
    console.error("Lỗi khi tạo đơn nhận nuôi:", err);
    return res.status(500).json({ message: "Lỗi server", error: err.message });
  }
};

// check user submitted form
const checkUserSubmitted = async (req, res) => {
  try {
    const userId = req.payload.id;
    const { adoptionFormId } = req.body;

    if (!adoptionFormId) {
      return res.status(404).json({ message: "Thiếu adoptionFormId" });
    }

    const submission = await adoptionSubmissionService.checkUserSubmittedForm(
      userId,
      adoptionFormId
    );

    if (submission) {
      return res.status(200).json({
        submitted: true,
        submissionId: submission._id,
        status: submission.status,
        availableFrom: submission.interview?.availableFrom,
        availableTo: submission.interview?.availableTo,
        selectedSchedule: submission.interview?.selectedSchedule || null,
        interviewId: submission.interview?.interviewId || null,
      });
    }

    return res.status(200).json({ submitted: false });

  } catch (error) {
    console.error("Lỗi khi kiểm tra submission:", error);
    return res
      .status(400)
      .json({ "lỗi khi kiểm tra submission": error.message });
  }
};

// get adoption form submission by id
const getAdoptionSubmissionById = async (req, res) => {
  try {
    const id = req.params.submissionId;
    const submission =
      await adoptionSubmissionService.getAdoptionSubmissionById(id);
    res.status(200).json(submission);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// get submission by petID
const getSubmissionsByPetIds = async (req, res) => {
  try {
    const { petIds } = req.body;

    if (!Array.isArray(petIds) || petIds.length === 0) {
      return res.status(400).json({ message: "Thiếu danh sách petIds" });
    }

    const pets = await db.Pet.find({ _id: { $in: petIds } }, { _id: 1 });

    const existingPetIds = pets.map((pet) => pet._id.toString());

    const invalidPetIds = petIds.filter(
      (id) => !existingPetIds.includes(id.toString())
    );

    if (invalidPetIds.length > 0) {
      return res.status(404).json({
        message: `Các petId sau không tồn tại: ${invalidPetIds.join(", ")}`,
      });
    }
    const result = await adoptionSubmissionService.getSubmissionsByPetIds(
      petIds
    );
    res.status(200).json(result);
  } catch (error) {
    console.error("Lỗi khi lấy submissions:", error);
    res
      .status(400)
      .json({ message: "Lỗi khi lấy submissions", error: error.message });
  }
};

// update status of submission
const updateSubmissionStatus = async (req, res) => {
  try {

    const { submissionId, status } = req.body;
    const reviewedBy = req.payload.id;
    if (!submissionId || !status) {
      return res.status(400).json({
        message: "Thiếu submissionId hoặc trạng thái (status) cần cập nhật",
      });
    }

    const updateSubmission =
      await adoptionSubmissionService.updateSubmissionStatus(
        submissionId,
        status
      );

    res.status(200).json({ status: updateSubmission.status });

    if (status === "rejected") {
      const submission = await AdoptionSubmission.findById(submissionId)
        .populate("performedBy", "email fullName")
        .populate({
          path: "adoptionForm",
          populate: {
            path: "pet",
            populate: { path: "shelter", select: "name" },
          },
        });
      const user = submission?.performedBy;
      const pet = submission?.adoptionForm?.pet;
      const petId = pet?._id;
      const petName = pet?.name || "thú cưng";
      const shelterName = pet?.shelter?.name || "Trung tâm cứu hộ";

      // Gửi thông báo
      if (user?._id) {
        const content = `Đơn nhận nuôi bé "${petName}" của bạn đã bị từ chối.`;
        const redirectUrl = `/adoption-form/${petId}/${submissionId}`;

        await notificationService.createNotification(
          reviewedBy,
          [user._id],
          content,
          "adoption",
          redirectUrl
        );
      }

      // Gửi email
      try {
        if (user?.email) {
          const subject = `Thông báo kết quả đơn nhận nuôi ${petName}`;
          const body = `
        <div style="font-family: Arial, sans-serif; line-height: 1.5;">
          <h2>Thông báo từ chối đơn nhận nuôi</h2>
          <p>Xin chào <strong>${user.fullName || "bạn"}</strong>,</p>
          <p>Chúng tôi rất tiếc phải thông báo rằng đơn đăng ký nhận nuôi bé <strong>${petName}</strong> của bạn đã không được <strong>${shelterName}</strong> chấp nhận.</p>
          <p>Cảm ơn bạn đã quan tâm và hi vọng bạn sẽ tiếp tục yêu thương và đồng hành cùng các bé thú cưng khác trong tương lai.</p>
          <p style="margin-top: 20px;">Trân trọng,<br>${shelterName}</p>
        </div>
      `;
          await mailer.sendEmail(user.email, subject, body);
        }
      } catch (error) {
        console.error("Lỗi gửi email từ chối nhận nuôi:", error);
      }
    }
  } catch (error) {
    console.error("Lỗi khi lấy submissions:", error);
    res
      .status(400)
      .json({ message: "Lỗi khi lấy submissions", error: error.message });
  }
};
// schedule interview
const createInterviewSchedule = async (req, res) => {
  try {
    const { submissionId, availableFrom, availableTo, method, performedBy } =
      req.body;

    if (!submissionId || !availableFrom || !availableTo || !method || !performedBy) {
      return res.status(400).json({
        message: "Thiếu thông tin bắt buộc để lên lịch phỏng vấn.",
      });
    }

    const reviewedBy = req.payload.id;
    const interviewId = new mongoose.Types.ObjectId();

    const updated = await adoptionSubmissionService.scheduleInterview({
      submissionId,
      interviewId,
      availableFrom,
      availableTo,
      method,
      performedBy,
      reviewedBy,
    });

    res.status(200).json({
      message: "Tạo lịch phỏng vấn thành công",
      data: updated,
    });

    // Gửi notification cho người dùng
    try {
      const submission = await AdoptionSubmission.findById(submissionId)
        .populate("performedBy", "_id fullName email")
        .populate({
          path: "adoptionForm",
          populate: {
            path: "pet",
            populate: { path: "shelter", select: "name" },
          },
        });

      const user = submission?.performedBy;
      const pet = submission?.adoptionForm?.pet;
      const petId = pet?._id;
      const petName = pet?.name || "thú cưng";
      const shelterName = pet?.shelter?.name || "Trung tâm cứu hộ";

      // Notification
      if (user?._id) {
        const content = `Đơn nhận nuôi bé "${petName}" của bạn đã được xét duyệt. Vui lòng chọn lịch phỏng vấn.`;
        const redirectUrl = `/adoption-form/${petId}/${submissionId}`;

        await notificationService.createNotification(
          reviewedBy,
          [user._id],
          content,
          "adoption",
          redirectUrl
        );
      }

      // Gửi email (không await)
      if (user?.email) {
        const to = user.email;
        const subject = `Chọn lịch phỏng vấn cho đơn nhận nuôi bé ${petName}`;
        const fromDate = new Date(availableFrom);
        const toDate = new Date(availableTo);
        const deadline = new Date(toDate);
        deadline.setDate(deadline.getDate() - 1);

        const formatScheduleFrom = format(availableFrom, "'ngày' dd/MM/yyyy");
        const formatScheduleTo = format(availableTo, "'ngày' dd/MM/yyyy");
        const formatDeadline = format(deadline, "'ngày' dd/MM/yyyy");

        const body = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
          <h2>Thông báo lịch phỏng vấn</h2>
          <p>Xin chào <strong>${user.fullName || "bạn"}</strong>,</p>
          <p>Đơn đăng ký nhận nuôi bé <strong>${petName}</strong> của bạn đã được <strong>${shelterName}</strong> xem xét.</p>
          <p>Chúng tôi mời bạn tham gia một buổi phỏng vấn nhận nuôi. Vui lòng chọn một thời gian phù hợp trong khoảng sau:</p>
          <p><strong>Từ:</strong> ${formatScheduleFrom}<br/><strong>Đến:</strong> ${formatScheduleTo}</p>
          <p>Hình thức phỏng vấn: <strong>${method}</strong></p>
          <p><strong>Lưu ý:</strong> Bạn cần đăng nhập vào hệ thống PawShelter và chọn lịch phỏng vấn <strong>trước ${formatDeadline}</strong>. Nếu bạn không chọn lịch đúng hạn, đơn của bạn có thể bị hủy.</p>
          <p style="margin-top: 20px;">Trân trọng,<br/>${shelterName}</p>
        </div>
        `;

        mailer.sendEmail(to, subject, body).catch((err) => {
          console.error("Lỗi gửi email phỏng vấn:", err);
        });
      }
    } catch (err) {
      console.error("Lỗi xử lý notification/email sau khi tạo lịch:", err);
    }
  } catch (error) {
    console.error("Lỗi tạo lịch phỏng vấn:", error);

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({ message: messages.join(" ") });
    }
    

    // Thêm dòng này để hiển thị lỗi Error thường (do bạn throw trong service)
    if (error.message) {
      return res.status(400).json({ message: error.message });
    }

    res.status(500).json({ message: "Đã xảy ra lỗi khi tạo lịch phỏng vấn." });
  }
};


const getInterviewCounts = async (req, res) => {
  try {
    const { from, to } = req.query;
    const { shelterId } = req.params;

    if (!from || !to || !shelterId) {
      return res.status(400).json({ message: "Thiếu from, to hoặc shelterId" });
    }

    const result = await adoptionSubmissionService.getInterviewCountsByStaff(
      shelterId,
      from,
      to
    );

    res.status(200).json(result);
  } catch (error) {
    console.error("Lỗi đếm phỏng vấn theo staff:", error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

const selectInterviewSchedule = async (req, res) => {
  try {
    const { submissionId, selectedSchedule } = req.body;
    const userId = req.payload.id;

    if (!selectedSchedule) {
      return res.status(400).json({ message: "Thiếu thời gian bạn chọn" });
    }

    const result = await adoptionSubmissionService.selectInterviewSchedule(
      submissionId,
      userId,
      selectedSchedule
    );

    // Gửi notification đến shelter
    const submission = await AdoptionSubmission.findById(submissionId)
      .populate("performedBy", "fullName")
      .populate({
        path: "adoptionForm",
        populate: {
          path: "pet",
          populate: {
            path: "shelter",
            select: "name members",
          },
        },
      });

    const shelter = submission?.adoptionForm?.pet?.shelter;
    const pet = submission?.adoptionForm?.pet;
    const adopterName = submission?.performedBy?.fullName || "Người dùng";
    const petName = pet?.name || "thú cưng";
    const redirectUrl = `/shelters/${shelter?._id}/management/submission-forms/${pet?._id}`;

    // Lấy thời gian đã chọn từ selectedSchedule.interview
    const selectedDate = result?.interview?.selectedSchedule;

    if (shelter?.members?.length && selectedDate) {
      const receivers = shelter.members.filter(
        (m) => m.roles?.includes("manager") || m.roles?.includes("staff")
      );

      const receiverIds = receivers.map((m) => m._id);

      if (receiverIds.length > 0) {
        const content = `đã chọn lịch phỏng vấn vào ngày ${new Date(selectedDate).toLocaleDateString("vi-VN")} cho đơn nhận nuôi bé "${petName}".`;

        await notificationService.createNotification(
          userId,
          receiverIds,
          content,
          "adoption",
          redirectUrl
        );
      }
    }

    return res.status(200).json({
      message: "Đã chọn lịch phỏng vấn",
      selectedSchedule: result.interview.selectedSchedule,
    });
  } catch (error) {
    console.error("Lỗi chọn lịch phỏng vấn:", error);
    return res.status(error.statusCode || 500).json({ message: error.message });
  }
};

// add feedback interview
const addInterviewFeedback = async (req, res) => {
  try {
    const { submissionId, feedback } = req.body;
    const userId = req.payload.id;

    if (!submissionId || !feedback) {
      return res
        .status(400)
        .json({ message: "Thiếu submissionId hoặc feedback" });
    }

    const result = await adoptionSubmissionService.addInterviewFeedback(
      submissionId,
      userId,
      feedback
    );

    return res.status(200).json({
      message: "Đã thêm phản hồi phỏng vấn",
      feedback: result.interview.feedback,
    });
  } catch (error) {
    console.error("Lỗi thêm phản hồi phỏng vấn:", error);
    return res.status(error.statusCode || 500).json({ message: error.message });
  }
};

// add note interview
const addInterviewNote = async (req, res) => {
  try {
    const { submissionId, note } = req.body;
    const userId = req.payload.id;

    if (!submissionId || !note) {
      return res
        .status(400)
        .json({ message: "Thiếu submissionId hoặc feedback" });
    }

    const result = await adoptionSubmissionService.addInterviewNote(
      submissionId,
      note
    );

    return res.status(200).json({
      message: "Đã thêm ghi chú phỏng vấn",
      note: result.interview.note,
    });
  } catch (error) {
    console.error("Lỗi thêm ghi chú phỏng vấn:", error);
    return res.status(error.statusCode || 500).json({ message: error.message });
  }
};

// update interview performance
const updateInterviewPerformer = async (req, res) => {
  try {
    const { submissionId, newPerformerId } = req.body;
    const managerId = req.payload.id;
    if (!submissionId || !newPerformerId) {
      return res.status(400).json({
        message: "Thiếu submissionId hoặc newPerformerId",
      });
    }

    const updated = await adoptionSubmissionService.updateInterviewPerformer({
      submissionId,
      newPerformerId,
      managerId
    });

    res.status(200).json({
      message: "Cập nhật nhân viên phỏng vấn thành công",
      success: updated.success,
    });
  } catch (error) {
    console.error("Lỗi cập nhật nhân viên phỏng vấn:", error);
    res.status(error.statusCode ||400).json({ message: error.message });
  }
};



const adoptionSubmissionController = {
  getAdtoptionRequestList,
  getSubmissionsByUser,
  createAdoptionSubmission,
  checkUserSubmitted,
  getAdoptionSubmissionById,
  getSubmissionsByPetIds,
  updateSubmissionStatus,
  createInterviewSchedule,
  getInterviewCounts,
  selectInterviewSchedule,
  addInterviewFeedback,
  addInterviewNote,
  updateInterviewPerformer
};

module.exports = adoptionSubmissionController;
