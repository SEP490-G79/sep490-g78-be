const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../models/index");
const adoptionSubmissionService = require("../services/adoptionSubmission.service");
const AdoptionSubmission = require("../models/adoptionSubmission.model");


const getAdtoptionRequestList = async (req, res) => {
    try {
        const adoptionRequests = await adoptionSubmissionService.getAdtoptionRequestList(req.payload.id);
        res.status(200).json(adoptionRequests);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
}

// submit adoption request for user
const createAdoptionSubmission = async (req, res) => {
  try {
    const { adoptionFormId, answers } = req.body;
    const userId = req.payload.id;

       // Tính thời gian 1 tháng trước
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    //  Đếm số pet đã được user này nhận nuôi trong 1 tháng
    const adoptionsLastMonth = await db.Pet.countDocuments({
      adopter: userId,
      status: "adopted",
      updatedAt: { $gte: oneMonthAgo }, // sử dụng updatedAt để đảm bảo chính xác
    });

    // Lấy tất cả questionId từ answers
    const questionIds = answers.map((a) => a.questionId);

    // Tải trước tất cả câu hỏi trong 1 lần
    const questions = await db.Question.find({ _id: { $in: questionIds } });

    // Map để tra cứu nhanh
    const questionMap = new Map();
    for (const q of questions) {
      questionMap.set(q._id.toString(), q);
    }

    let totalScore = 0;

    for (const answer of answers) {
      const question = questionMap.get(answer.questionId.toString());
      if (!question) continue;

      const correctOptions = question.options.filter((opt) => opt.isTrue);
      const totalCorrect = correctOptions.length;
      if (totalCorrect === 0) continue; 

      const userCorrect = (answer.selections || []).filter((sel) =>
        correctOptions.some((opt) => opt.title === sel)
      ).length;

      const multiplier = {
        none: 0,
        low: 1,
        medium: 2,
        high: 3,
      }[question.priority] || 0;

      totalScore += (userCorrect / totalCorrect) * multiplier;
    }

    const submission = new AdoptionSubmission({
      performedBy: userId,
      adoptionForm: adoptionFormId,
      answers,
      adoptionsLastMonth,
      total: totalScore,
    });
//     const existing = await AdoptionSubmission.findOne({
//   performedBy: req.payload.id,
//   adoptionForm: adoptionFormId,
// });

// if (existing) {
//   return res.status(400).json({ message: "Bạn đã nộp đơn cho thú cưng này rồi." });
// }


    const saved = await submission.save(); 
    res.status(201).json(saved); 
  } catch (err) {
    console.error(" Lỗi khi tạo đơn nhận nuôi:", err);
    res.status(500).json({ message: "Lỗi server", error: err.message });
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
      });
    }

    return res.status(200).json({ submitted: false });
    

    return res.status(200).json({ submitted });
  } catch (error) {
    console.error("Lỗi khi kiểm tra submission:", error);
    return res.status(400).json({ message: "Đã tồn tại đơn xin nhận nuôi!" });
  }
};

// get adoption form submission by id
const getAdoptionSubmissionById = async (req, res) => {
  try {
    const id = req.params.submissionId;
    const submission = await adoptionSubmissionService.getAdoptionSubmissionById(id);
    res.status(200).json(submission);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const adoptionSubmissionController = {
    getAdtoptionRequestList,
    createAdoptionSubmission,
    checkUserSubmitted,
    getAdoptionSubmissionById
};

module.exports = adoptionSubmissionController;