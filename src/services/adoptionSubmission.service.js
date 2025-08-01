const db = require("../models/");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");
dayjs.extend(utc);
dayjs.extend(timezone);

const getAdtoptionRequestList = async (id) => {
  try {
    const adoptionRequest = await db.AdoptionSubmission.find({
      performedBy: id,
    })
      .populate("performedBy")
      .populate({
        path: "adoptionForm",
        populate: [
          {
            path: "pet",
            model: "Pet",
            select: "name petCode tokenMoney photos",
          },
          { path: "shelter", model: "Shelter", select: "name" },
        ],
      })
      .populate("answers.questionId");
    if (!adoptionRequest) {
      throw new Error("No adoption requests found for this user");
    }
    return adoptionRequest;
  } catch (error) {
    throw error;
  }
};


const getSubmissionsByUserId = async (userId) => {
  try {
    const submissions = await db.AdoptionSubmission.find({ performedBy: userId })
       .populate({
        path: "adoptionForm",
        populate: [
          {
            path: "pet",
            select: "_id name photos tokenMoney species breed age gender",
          },
          {
            path: "shelter",
            select: "_id name address avatar phoneNumber", 
          },
        ],
      });

    return submissions;
  } catch (error) {
    throw error;
  }
};

// submit adoption request for user
const createAdoptionSubmission = async (data) => {
  return await db.AdoptionSubmission.create(data);
};

// check user submission exist
const checkUserSubmittedForm = async (userId, adoptionFormId) => {
  const existingSubmission = await db.AdoptionSubmission.findOne({
    performedBy: userId,
    adoptionForm: adoptionFormId,
  });

  return existingSubmission; // true nếu đã submit, false nếu chưa
};

// get adoption form submission by id
const getAdoptionSubmissionById = async (id) => {
  try {
    const adoptionSubmission = await db.AdoptionSubmission.findById(id)
      .populate({
        path: "performedBy",
        select: "-password -googleId -createdAt -updatedAt",
      })

      .populate({
        path: "adoptionForm",
        populate: [
          { path: "pet", model: "Pet", select: "name petCode" },
          {
            path: "shelter",
            model: "Shelter",
            select: "name address hotline email",
          },
        ],
      })
      .populate("answers.questionId");

    if (!adoptionSubmission) {
      throw new Error("Không tìm thấy submission");
    }

    return adoptionSubmission;
  } catch (error) {
    throw error;
  }
};

// get submission by petId
const getSubmissionsByPetIds = async (petIds) => {
  try {
    // Tìm tất cả AdoptionForm có status là active và thuộc các petId
    const adoptionForms = await db.AdoptionForm.find({
      pet: { $in: petIds },
      status: { $in: ["active", "adopted"] },
    }).select("_id");

    const formIds = adoptionForms.map((f) => f._id);

    if (!formIds.length) return [];

    const submissions = await db.AdoptionSubmission.find({
      adoptionForm: { $in: formIds },
    })
      .populate(
        "performedBy",
        "fullName email address dob phoneNumber warningCount avatar"
      )
      .populate({
        path: "adoptionForm",
        populate: [
          { path: "pet", model: "Pet", select: "name petCode photos" },
          { path: "shelter", model: "Shelter", select: "name" },
        ],
      })
      .populate("answers.questionId")
      .populate("interview.performedBy", "fullName email avatar")
      .sort({ createdAt: -1 });

    return submissions;
  } catch (error) {
    throw error;
  }
};

// update status submisison
const updateSubmissionStatus = async (submissionId, status) => {
  try {
    const allowedStatus = {
      pending: ["pending", "scheduling", "rejected"],
      scheduling: ["pending", "interviewing", "rejected", "scheduling"],
      interviewing: ["rejected", "reviewed", "interviewing"],
      reviewed: ["reviewed", "approved", "rejected"],
      approved: ["approved"],
      rejected: ["rejected"],
    };

    const submission = await db.AdoptionSubmission.findById(submissionId);
    if (!submission) {
      const error = new Error("Không tìm thấy hồ sơ nhận nuôi");
      error.statusCode = 404;
      throw error;
    }

    const currentStatus = submission.status;
    const allowedNextStatuses = allowedStatus[currentStatus];

    if (!allowedNextStatuses) {
      const error = new Error(
        `Trạng thái hiện tại "${currentStatus}" không hợp lệ`
      );
      error.statusCode = 400;
      throw error;
    }

    if (!allowedNextStatuses.includes(status)) {
      const error = new Error(
        `Trạng thái không hợp lệ. Chỉ cho phép: ${allowedNextStatuses.join(
          ", "
        )}`
      );
      error.statusCode = 400;
      throw error;
    }

    submission.status = status;
    await submission.save();
    return submission;
  } catch (error) {
    throw error;
  }
};

// schedule interview
const scheduleInterview = async ({
  submissionId,
  interviewId,
  availableFrom,
  availableTo,
  method,
  performedBy,
  reviewedBy,
}) => {
  try {
    const submission = await db.AdoptionSubmission.findById(submissionId);
    if (!submission) {
      throw new Error("Không tìm thấy đơn nhận nuôi.");
    }
    if (submission.status !== "scheduling") {
      throw new Error(
        "Chỉ có thể tạo lịch phỏng vấn với những đơn nhận nuôi trong trạng thái chờ phỏng vấn."
      );
    }
    if (!availableFrom || !availableTo || !method || !performedBy) {
      throw new Error("Thiếu thông tin bắt buộc để lên lịch phỏng vấn.");
    }
    if (new Date(availableFrom) >= new Date(availableTo)) {
      throw new Error("Thời gian bắt đầu phải trước thời gian kết thúc.");
    }

    // Cập nhật trường interview
    submission.interview = {
      interviewId,
      availableFrom,
      availableTo,
      method,
      performedBy,
      reviewedBy,
      createAt: new Date(),
      updateAt: new Date(),
    };
    submission.status = "interviewing";
    await submission.save();
    return submission;
  } catch (err) {
    throw err;
  }
};

// count interviewing of staff
const getInterviewCountsByStaff = async (shelterId, from, to) => {
  const shelter = await db.Shelter.findById(shelterId);
  if (!shelter) {
    throw new Error("Không tìm thấy shelter");
  }

  const staffIds = shelter.members
    .filter((m) => m.roles.includes("staff"))
    .map((m) => m._id);

  const interviewCounts = await db.AdoptionSubmission.aggregate([
    {
      $match: {
        "interview.performedBy": { $in: staffIds },
        "interview.availableFrom": { $lt: new Date(to) },
        "interview.availableTo": { $gt: new Date(from) },
      },
    },
    {
      $group: {
        _id: "$interview.performedBy",
        interviewCount: { $sum: 1 },
      },
    },
  ]);

  // Map staffId → interviewCount
  const countMap = new Map();
  for (const item of interviewCounts) {
    countMap.set(item._id.toString(), item.interviewCount);
  }

  // Truy vấn thêm thông tin user
  const users = await db.User.find({ _id: { $in: staffIds } }).select(
    "fullName email avatar"
  );

  // Trả về danh sách gộp
  const result = users.map((u) => ({
    staffId: u._id,
    fullName: u.fullName,
    email: u.email,
    avatar: u.avatar,
    interviewCount: countMap.get(u._id.toString()) || 0,
  }));

  // Sắp xếp giảm dần theo số cuộc phỏng vấn
  result.sort((a, b) => a.interviewCount - b.interviewCount);

  return result;
};

// update selecte schedule from user
const selectInterviewSchedule = async (
  submissionId,
  userId,
  selectedSchedule
) => {
  const submission = await db.AdoptionSubmission.findById(submissionId);

  if (!submission) {
    throw new Error("Không tìm thấy đơn nhận nuôi");
  }

  if (submission.performedBy.toString() !== userId.toString()) {
    const error = new Error("Bạn không có quyền cập nhật lịch phỏng vấn này");
    error.statusCode = 403;
    throw error;
  }

  const selected = new Date(selectedSchedule);

  const from = new Date(submission.interview.availableFrom);
  const to = new Date(submission.interview.availableTo);

  if (!(selected >= from && selected <= to)) {
    const error = new Error("Thời gian bạn chọn nằm ngoài khoảng cho phép");
    error.statusCode = 400;
    throw error;
  }

  submission.interview.selectedSchedule = selected;
  submission.markModified("interview");

  await submission.save();
  return submission;
};

// add feedback interview
const addInterviewFeedback = async (submissionId, userId, feedback) => {
  const submission = await db.AdoptionSubmission.findById(submissionId);

  if (!submission) {
    const error = new Error("Không tìm thấy đơn nhận nuôi");
    error.statusCode = 404;
    throw error;
  }

  // Chỉ cho phép khi status là 'interviewing'
  if (submission.status !== "interviewing") {
    const error = new Error(
      "Chỉ có thể gửi phản hồi khi đơn đang ở trạng thái phỏng vấn"
    );
    error.statusCode = 400;
    throw error;
  }

  // Đảm bảo user đã chọn lịch hẹn
  if (!submission.interview?.selectedSchedule) {
    const error = new Error("Người dùng chưa chọn lịch phỏng vấn");
    error.statusCode = 400;
    throw error;
  }

  // Kiểm tra quyền: chỉ interview.performedBy mới được thêm feedback
  if (
    !submission.interview?.performedBy ||
    submission.interview.performedBy.toString() !== userId.toString()
  ) {
    const error = new Error("Bạn không có quyền gửi phản hồi phỏng vấn");
    error.statusCode = 403;
    throw error;
  }

  submission.interview.feedback = feedback;
  submission.interview.scheduleAt = new Date();
  submission.interview.updateAt = new Date();
  submission.markModified("interview");

  await submission.save();
  return submission;
};

// add note interview
const addInterviewNote = async (submissionId, note) => {
  const submission = await db.AdoptionSubmission.findById(submissionId);

  if (!submission) {
    const error = new Error("Không tìm thấy đơn nhận nuôi");
    error.statusCode = 404;
    throw error;
  }

  // Chỉ cho phép khi status là 'interviewing'
  if (submission.status !== "reviewed") {
    const error = new Error(
      "Chỉ có thể gửi phản hồi khi đơn đang ở trạng thái đã phỏng vấn"
    );
    error.statusCode = 400;
    throw error;
  }

  submission.interview.note = note;
  submission.interview.updateAt = new Date();
  submission.markModified("interview");

  await submission.save();
  return submission;
};

const updateManySubmissionStatus = async (adopterIds, petId) => {
  try {
    if (!petId) {
      throw new Error("Thiếu id của thú nuôi!");
    }


    const adoptionForm = await db.AdoptionForm.findOne({
      pet: petId,
      status: "active",
    });

    if (!adoptionForm) {
      throw new Error("Không tìm thấy đơn nhận nuôi!");
    }

    const result = await db.AdoptionSubmission.updateMany(
      {
        adoptionForm: adoptionForm._id,
        performedBy: { $in: adopterIds },
        status: {$ne: "rejected"},
      },
      {
        $set: { status: "rejected" },
      }
    );
    return result;
  } catch (error) {
    throw error;
  }
};


const adoptionSubmissionService = {
  getAdtoptionRequestList,
  getSubmissionsByUserId,
  createAdoptionSubmission,
  checkUserSubmittedForm,
  getAdoptionSubmissionById,
  getSubmissionsByPetIds,
  updateSubmissionStatus,
  scheduleInterview,
  getInterviewCountsByStaff,
  selectInterviewSchedule,
  addInterviewFeedback,
  addInterviewNote,
  updateManySubmissionStatus,
};
module.exports = adoptionSubmissionService;
