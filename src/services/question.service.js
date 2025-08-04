const db = require("../models");

const getAllQuestions = async (page = 1, limit = 10) => {
  try {
    const skip = (page - 1) * limit;

    const [questions, total] = await Promise.all([
      db.Question.find().skip(skip).limit(limit).sort({ createdAt: -1 }), // sắp xếp mới nhất lên trước
      db.Question.countDocuments(),
    ]);

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      data: questions,
    };
  } catch (error) {
    throw error;
  }
};

const getQuestionById = async (questionId) => {
  try {
    const question = await db.Question.findById(questionId);
    if (!question) {
      throw new Error("Question not found");
    }
    return question;
  } catch (error) {
    throw error;
  }
};

const createQuestion = async (data) => {
  try {
    const questionData = {
      title: data.title,
      priority: data.priority || "none",
      options: data.options.map((option) => ({
        title: option.title,
        isTrue: option.isTrue || false,
      })),
      status: "active",
      //ignore Uppercase
      type: data.type.toUpperCase(),
    };
    const newQuestion = await db.Question.create(questionData);
    return newQuestion;
  } catch (error) {
    throw error;
  }
};

const editQuestion = async (questionId, data) => {
  try {
    const questionData = {
      title: data.title,
      priority: data.priority || "none",
      options: data.options.map((option) => ({
        title: option.title,
        isTrue: option.isTrue || false,
      })),
      status: data.status || "active",
      type: data.type,
    };
    const updatedQuestion = await db.Question.findByIdAndUpdate(
      questionId,
      questionData,
      { new: true }
    );
    if (!updatedQuestion) {
      throw new Error("Không tìm thấy câu hỏi");
    }
    if (updatedQuestion.status === "inactive") {
      throw new Error("Câu hỏi đã bị xóa");
    }
    return updatedQuestion;
  } catch (error) {
    throw error;
  }
};

//edit lists of questions (list questions)
const editListQuestions = async (questionsData) => {
  try {
    const results = [];

    for (const item of questionsData) {
      const isUpdate = item._id !== undefined && item._id !== null;

      const questionData = {
        title: item.title,
        priority: item.priority || "none",
        options: (item.options || []),
        status: item.status || "active",
        type: item.type?.toUpperCase?.() || "TEXT",
      };

      let question;

      if (isUpdate) {
        question = await db.Question.findByIdAndUpdate(item._id, questionData, {
          new: true,
        });

        if (!question) {
          throw new Error(`Không tìm thấy câu hỏi: ${item._id}`);
        }
      } else {
        question = await db.Question.create(questionData);
      }

      results.push(question);
    }

    return results;
  } catch (error) {
    throw new Error("Lỗi khi chỉnh sửa câu hỏi " + error.message);
  }
};

//duplicate the questions (list id of question)

const duplicateQuestion = async (questionId) => {
  try {
    const question = await db.Question.findById(questionId);
    if (!question) {
      throw new Error("Không tìm thấy câu hỏi");
    }

    // Tạo bản sao của câu hỏi
    const newQuestionData = {
      title: question.title,
      priority: question.priority,
      options: question.options.map((option) => ({
        title: option.title,
        isTrue: option.isTrue,
      })),
      status: "active",
      type: question.type,
    };

    const newQuestion = await db.Question.create(newQuestionData);
    return newQuestion;
  } catch (error) {
    throw error;
  }
};

//duplicate a list of questions
const duplicateListQuestions = async (questionIds) => {
  try {
    const questions = await db.Question.find({
      _id: { $in: questionIds },
    });

    if (!questions || questions.length === 0) {
      throw new Error("Không tìm thấy câu hỏi nào để sao chép");
    }

    const duplicatedData = questions.map((question) => ({
      title: question.title,
      priority: question.priority,
      options: question.options.map((option) => ({
        title: option.title,
        isTrue: option.isTrue,
      })),
      status: "active",
      type: question.type,
    }));

    const duplicatedQuestions = await db.Question.insertMany(duplicatedData);

    return duplicatedQuestions;
  } catch (error) {
    throw new Error("Lỗi khi đang sao chép câu hỏi: " + error.message);
  }
};

const deleteQuestion = async (questionId) => {
  try {
    const updatedQuestion = await db.Question.findByIdAndUpdate(
      questionId,
      { status: "inactive" },
      { new: true }
    );
    if (!updatedQuestion) {
      throw new Error("Không tìm thấy câu hỏi");
    }
    if (updatedQuestion.status === "inactive") {
      throw new Error("Câu hỏi đã bị xóa");
    }
    return updatedQuestion;
  } catch (error) {
    throw error;
  }
};

const listQuestionsByAdoptionForm = async (
  adoptionFormId,
  page = 1,
  limit = 10
) => {
  try {
    const skip = (page - 1) * limit;

    // Lấy danh sách ID câu hỏi từ AdoptionForm
    const adoptionForm = await db.AdoptionForm.findById(adoptionFormId).lean();

    if (!adoptionForm) {
      throw new Error("Không tìm thấy Adoption Form");
    }

    const questionIds = adoptionForm.questions || [];

    const total = questionIds.length;

    // Lấy dữ liệu câu hỏi với phân trang
    const questions = await db.Question.find({
      _id: { $in: questionIds },
      status: "active",
    })
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      data: questions,
    };
  } catch (error) {
    throw new Error("Lỗi khi lấy câu hỏi: " + error.message);
  }
};
const listQuestionsByAdoptionTemplate = async (
  adoptionTemplateId,
  page = 1,
  limit = 10
) => {
  try {
    const skip = (page - 1) * limit;

    // Lấy danh sách ID câu hỏi từ AdoptionTemplate
    const adoptionTemplate = await db.AdoptionTemplate.findById(
      adoptionTemplateId
    ).lean();

    if (!adoptionTemplate) {
      throw new Error("Không tìm thấy Adoption Template");
    }

    const questionIds = adoptionTemplate.questions || [];

    const total = questionIds.length;

    // Lấy dữ liệu câu hỏi với phân trang
    const questions = await db.Question.find({
      _id: { $in: questionIds },
      status: "active",
    })
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      data: questions,
    };
  } catch (error) {
    throw new Error("Error fetching questions: " + error.message);
  }
};


const questionService = {
  getAllQuestions,
  getQuestionById,
  createQuestion,
  editQuestion,
  deleteQuestion,
  listQuestionsByAdoptionForm,
  listQuestionsByAdoptionTemplate,
  editListQuestions,
  duplicateQuestion,
  duplicateListQuestions,
};

module.exports = questionService;