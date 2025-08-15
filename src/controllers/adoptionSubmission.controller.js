const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../models/index");
const adoptionSubmissionService = require("../services/adoptionSubmission.service");
const AdoptionSubmission = require("../models/adoptionSubmission.model");
const { mailer } = require("../configs");
const { default: mongoose } = require("mongoose");
const { format } = require("date-fns");
const notificationService = require("../services/notification.service");
const socketIoService = require("../services/socket-io.service");


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

    // 3. Lấy toàn bộ câu hỏi của form để biết priority
    const formQuestions = await db.Question.find({
      _id: { $in: adoptionForm.questions },
    });

    // Map tiện tra cứu theo _id
    const formQMap = new Map(formQuestions.map(q => [q._id.toString(), q]));

    // Tập id câu hỏi bắt buộc (priority !== 'none')
    const requiredQIds = formQuestions
      .filter(q => q.priority !== "none")
      .map(q => q._id.toString());

    // 4. Kiểm tra từng answer người dùng gửi lên: phải thuộc form
    const answerQuestionIds = answers.map(a => a.questionId?.toString());

    // Nếu có câu hỏi nào trong câu trả lời không thuộc form → báo lỗi
    for (const qId of answerQuestionIds) {
      if (!formQMap.has(qId)) {
        return res.status(400).json({
          message: `Câu hỏi với ID '${qId}' không thuộc form này.`,
        });
      }
    }

    // 5. Bảo đảm tất cả câu hỏi bắt buộc đều có đáp án (không rỗng)
    // 5. Bảo đảm tất cả câu hỏi bắt buộc đều có đáp án (không rỗng)
    for (const reqId of requiredQIds) {
      const ans = answers.find(a => a.questionId?.toString() === reqId);

      // thiếu hoặc không phải mảng
      if (!ans || !Array.isArray(ans.selections)) {
        const qTitle = formQMap.get(reqId)?.title || reqId;
        return res.status(400).json({
          message: `Bạn phải trả lời câu hỏi bắt buộc: '${qTitle}'.`,
        });
      }

      // coi "", "   " là rỗng
      const hasFilled = ans.selections.some(sel =>
        sel != null && (typeof sel !== "string" || sel.trim() !== "")
      );
      if (!hasFilled) {
        const qTitle = formQMap.get(reqId)?.title || reqId;
        return res.status(400).json({
          message: `Bạn phải trả lời câu hỏi bắt buộc: '${qTitle}'.`,
        });
      }
    }


    // 6. Validate nội dung selections theo type

    for (const answer of answers) {
      const qId = answer.questionId?.toString();
      const question = formQMap.get(qId);
      if (!question) {
        return res.status(400).json({
          message: `Không tìm thấy câu hỏi với ID: ${answer.questionId}`,
        });
      }

      const { type, options, priority } = question;
      const raw = answer.selections;

      // selections phải là mảng nếu có gửi lên
      if (raw != null && !Array.isArray(raw)) {
        return res.status(400).json({
          message: `Answer cho câu hỏi '${question.title}' phải là một mảng.`,
        });
      }

      // LỌC rỗng: bỏ null/undefined và chuỗi rỗng/space
      const selections = Array.isArray(raw)
        ? raw.filter(v => v != null && (typeof v !== "string" || v.trim() !== ""))
        : [];

      const isRequired = priority !== "none";
      const hasAny = selections.length > 0;

      if (isRequired && !hasAny) {
        return res.status(400).json({
          message: `Bạn phải chọn/nhập câu trả lời cho câu hỏi '${question.title}'.`,
        });
      }

      // Optional + không có trả lời -> bỏ qua validate type
      if (!isRequired && !hasAny) continue;

      // === Validate theo type, dùng selections đã lọc ===
      if (type === "SINGLECHOICE") {
        if (!selections[0] || !options.some(opt => opt.title === selections[0])) {
          return res.status(400).json({
            message: `Lựa chọn '${selections[0] ?? ""}' không hợp lệ cho câu hỏi '${question.title}'.`,
          });
        }
      }

      if (type === "MULTIPLECHOICE") {
        for (const sel of selections) {
          if (!options.some(opt => opt.title === sel)) {
            return res.status(400).json({
              message: `Lựa chọn '${sel}' không hợp lệ cho câu hỏi '${question.title}'.`,
            });
          }
        }
      }

      if (type === "YESNO") {
        const validYesNo = ["Có", "Không"];
        if (!selections[0] || !validYesNo.includes(selections[0])) {
          return res.status(400).json({
            message: `Câu hỏi '${question.title}' chỉ chấp nhận 'Có' hoặc 'Không'.`,
          });
        }
      }

      if (type === "TEXT") {
        const val = selections[0]; // đã được lọc rỗng ở trên
        if (typeof val !== "string") {
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
      const question = formQMap.get(answer.questionId.toString());
      if (!question) continue;

      const correctOptions = question.options.filter(opt => opt.isTrue);
      const totalCorrect = correctOptions.length;
      if (totalCorrect === 0) continue;

      const userCorrect = (answer.selections || []).filter(sel =>
        correctOptions.some(opt => opt.title === sel)
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

      const notification = await notificationService.createNotification(
        userId,
        receiverIds,
        content,
        "adoption",
        redirectUrl
      );

      //  receiverIds.forEach((rid) => {
      //   socketIoService.to(`user:${rid}`, "notification", notification);
      // });
      socketIoService.to(`shelter:${shelter._id}`, "notification", notification);

    }
    socketIoService.to(
      `shelter:${shelter._id}`,
      "adoptionSubmission:created",
      {
        petId: form.pet._id.toString(),
        submissionId: saved._id.toString(),
      }
    );



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

    const updated = await adoptionSubmissionService.updateSubmissionStatus(
      submissionId,
      status
    );

    res.status(200).json({ status: updated.status });

    // Notifications + Socket
    try {
      const submission = await AdoptionSubmission.findById(submissionId)
        .populate("performedBy", "_id email fullName")
        .populate({
          path: "adoptionForm",
          populate: {
            path: "pet",
            populate: { path: "shelter", select: "_id name members" },
          },
        })
        .populate({
          path: "interview",
          populate: { path: "performedBy", select: "_id fullName email avatar" },
        });

      if (!submission) return;

      const user = submission.performedBy;
      const pet = submission.adoptionForm?.pet;
      const shelter = pet?.shelter;
      const petId = pet?._id;
      const petName = pet?.name || "thú cưng";
      const shelterName = shelter?.name || "Trung tâm cứu hộ";
      const redirectUrl = `/shelters/${shelter._id}/management/submission-forms/${petId}`;

      // Map nội dung thông báo theo status
      const userMsgMap = {
        pending: `Trạng thái đơn nhận nuôi "${petName}" của "${user?.fullName}" đã chuyển về "Chờ duyệt".`,
        scheduling: `Đơn nhận nuôi "${petName}" của "${user?.fullName}" đã được duyệt.`,
        interviewing: `Đơn nhận nuôi "${petName}" của "${user?.fullName}" đang chờ phỏng vấn.`,
        reviewed: `Đơn nhận nuôi "${petName}" của "${user?.fullName}" đã được phỏng vấn.`,
        approved: `Đơn nhận nuôi "${petName}" của "${user?.fullName}" đã được chấp thuận.`,
        rejected: `Đơn nhận nuôi "${petName}" của "${user?.fullName}" đã bị từ chối.`,
      };

      // Notification cho NGƯỜI NỘP ĐƠN
      // if (user?._id) {
      //   const content = userMsgMap[status] || `Đơn nhận nuôi "${petName}" đã cập nhật trạng thái: ${status}.`;
      //   const notif = await notificationService.createNotification(
      //     reviewedBy,
      //     [user._id],
      //     content,
      //     "adoption",
      //     redirectUrlUser
      //   );
      //   // emit tới user
      //   socketIoService.to(`user:${user._id.toString()}`, "notification", notif);
      // }

      // Notification cho NHÂN VIÊN PHỎNG VẤN nếu có

      const assignedId =
        submission?.interview?.performedBy?._id?.toString() ??
        submission?.interview?.performedBy?.toString() ??
        null;
      const receiverIds = (shelter?.members ?? [])
        .filter(m =>
          m.roles?.includes("manager") ||
          (m.roles?.includes("staff") && assignedId && m._id.toString() === assignedId)
        )
        .map(m => m._id.toString());
      if (receiverIds.length > 0) {
        const contentStaff = userMsgMap[status] || `Đơn nhận nuôi "${petName}" đang cập nhật trạng thái: ${status}.`;
        const notifStaff = await notificationService.createNotification(
          reviewedBy,
          receiverIds,
          contentStaff,
          "adoption",
          redirectUrl
        );
        receiverIds.forEach((rid) => {
          socketIoService.to(`user:${rid.toString()}`, "notification", notifStaff);
        });
      }

      if (shelter?._id) {
        socketIoService.to(
          `shelter:${shelter._id}`,
          "adoptionSubmission:statusChanged",
          {
            submissionId: submissionId.toString(),
            petId: petId?.toString(),
            status: updated.status,
          }
        );
      }

      if (status === "rejected" && user?.email) {
        const subject = `Thông báo kết quả đơn nhận nuôi ${petName}`;
        const body = `
          <div style="font-family: Arial, sans-serif; line-height: 1.5;">
            <h2>Thông báo từ chối đơn nhận nuôi</h2>
            <p>Xin chào <strong>${user.fullName || "bạn"}</strong>,</p>
            <p>Đơn đăng ký nhận nuôi bé <strong>${petName}</strong> của bạn đã không được <strong>${shelterName}</strong> chấp nhận.</p>
            <p>Cảm ơn bạn đã quan tâm và hi vọng bạn sẽ tiếp tục đồng hành cùng các bé khác trong tương lai.</p>
            <p style="margin-top: 20px;">Trân trọng,<br>${shelterName}</p>
          </div>`;
        mailer.sendEmail(user.email, subject, body).catch(err =>
          console.error("Lỗi gửi email từ chối nhận nuôi:", err)
        );
      }
    } catch (sideErr) {
      console.error("Lỗi gửi notification/socket sau khi update status:", sideErr);
    }
  } catch (error) {
    console.error("Lỗi khi cập nhật submission status:", error);
    res
      .status(400)
      .json({ message: "Lỗi khi cập nhật submission", error: error.message });
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
      const shelter = pet?.shelter;
      const shelterName = pet?.shelter?.name || "Trung tâm cứu hộ";

      if (user?._id) {
        socketIoService.to(`user:${user._id.toString()}`,
          "adoptionSubmission:interviewSchedule",
          {
            submissionId: submissionId.toString(),
            petId: pet?._id?.toString(),
          }
        );
      }
      if (shelter?._id) {
        //   socketIoService.to(`shelter:${shelter._id}`,
        // "adoptionSubmission:createSchedule",
        // {
        //   submissionId: submissionId.toString(),
        //   petId: pet?._id?.toString(),
        // }    
        // );
        socketIoService.to(
          `shelter:${shelter._id}`,
          "adoptionSubmission:statusChanged",
          { submissionId: submissionId.toString(), petId: pet?._id?.toString(), status: "interviewing" }
        );
      }

      // Notification
      if (user?._id) {
        const content = `Đơn nhận nuôi bé "${petName}" của bạn đã được xét duyệt. Vui lòng chọn lịch phỏng vấn.`;
        const redirectUrl = `/adoption-form/${petId}/${submissionId}`;

        const notification = await notificationService.createNotification(
          reviewedBy,
          [user._id],
          content,
          "adoption",
          redirectUrl
        );
        socketIoService.to(`user:${user._id.toString()}`, "notification", notification);
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

      const assignedId = submission?.interview?.performedBy?.toString();
      const receivers = shelter.members.filter(
        (m) => m.roles?.includes("manager") || (m.roles?.includes("staff") && m._id.toString() === assignedId)
      );
      const receiverIds = receivers.map((m) => m._id);
      if (receiverIds.length > 0) {
        const content = `đã chọn lịch phỏng vấn vào ngày ${new Date(selectedDate).toLocaleDateString("vi-VN")} cho đơn nhận nuôi bé "${petName}".`;
        const notification = await notificationService.createNotification(
          userId,
          receiverIds,
          content,
          "adoption",
          redirectUrl
        );
        receiverIds.forEach((rid) => {
          socketIoService.to(`user:${rid}`, "notification", notification);
        });
      }
      socketIoService.to(`shelter:${shelter._id}`,
        "adoptionSubmission:selectedSchedule",
        {
          submissionId: submissionId.toString(),
          petId: pet?._id?.toString(),
        }
      );

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
    res.status(error.statusCode || 400).json({ message: error.message });
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
