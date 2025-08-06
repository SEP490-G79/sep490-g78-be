const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../models/index");
const adoptionFormService = require("../services/adoptionForm.service");
const questionService = require("../services/question.service");

const getFormsByShelter = async (req, res, next) => {
  try {
    const { shelterId } = req.params;
    const selectedShelter = await db.Shelter.findOne({
      _id: shelterId,
      status: "active",
    });
    if (!selectedShelter) {
      return res
        .status(404)
        .json({ message: "Trung tâm không tồn tại hoặc không hoạt động" });
    }


    const forms = await adoptionFormService.getFormsByShelter(shelterId);

    res.status(200).json(forms);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const createForm = async (req, res, next) => {
  const { shelterId, petId } = req.params;
  const { id } = req.payload;

  try {
    const selectedShelter = await db.Shelter.findOne({
      _id: shelterId,
      status: "active",
    });
    if (!selectedShelter) {
      return res
        .status(404)
        .json({ message: "Trung tâm không tồn tại hoặc không hoạt động" });
    }
    const pet = await db.Pet.findOne({
      _id: petId,
      status: "unavailable",
    });
    if (!pet) {
      return res.status(404).json({
        message:
          "Không tìm thấy thú nuôi hoặc thú nuôi này không thể tạo form!",
      });
    }
    const existingForm = await db.AdoptionForm.findOne({
      pet: petId,
      shelter: shelterId,
      status:{$ne:"archived"}
    });
    if (existingForm) {
      return res.status(400).json({
        message:
          "Đã tồn tại form xin nhận nuôi cho thú nuôi này tại trung tâm!",
      });
    }

    const formData = req.body;
    const newForm = await adoptionFormService.createForm(
      shelterId,
      petId,
      formData,
      id
    );
    res.status(201).json(newForm);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const createFormByTemplate = async (req, res, next) => {
  const { shelterId, petId } = req.params;
  const { id } = req.payload;

  try {
    const selectedShelter = await db.Shelter.findOne({
      _id: shelterId,
      status: "active",
    });
    if (!selectedShelter) {
      return res
        .status(404)
        .json({ message: "Trung tâm không tồn tại hoặc không hoạt động" });
    }
    const pet = await db.Pet.findOne({
      _id: petId,
      status: "unavailable",
    });
    if (!pet) {
      return res.status(404).json({
        message:
          "Không tìm thấy thú nuôi hoặc thú nuôi này không thể tạo form!",
      });
    }
    const existingForm = await db.AdoptionForm.findOne({
      pet: petId,
      shelter: shelterId,
    });
    if (existingForm) {
      return res.status(400).json({
        message:
          "Đã tồn tại form xin nhận nuôi cho thú nuôi này tại trung tâm!",
      });
    }
    const { questions } = req.body;

    const savedQuestions = await questionService.editListQuestions(questions);

    const formData = req.body;
    const newForm = await adoptionFormService.createForm(
      shelterId,
      petId,
      {
        ...formData,
        questions: savedQuestions.map((question) => question._id),
      },
      id
    );
    res.status(201).json(newForm);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};



async function editForm(req, res, next) {
  const { formId } = req.params;
  const formData = req.body;
  const {shelterId} = req.params;

  try {
    const existingForm = await db.AdoptionForm.findOne({
      _id: formId,
      shelter: shelterId,
    });
    if (!existingForm) {
      return res.status(404).json({ message: "Form không tồn tại!" });
    }
    if (existingForm.status != "draft") {
      return res.status(400).json({
        message: "Không thể chỉnh sửa câu hỏi! Vui lòng chuyển form về trạng thái nháp trước khi chỉnh sửa câu hỏi.",
      });
    }
    const updatedForm = await adoptionFormService.editForm(formId, formData);
    res.status(200).json(updatedForm);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

async function changeFormStatus(req, res, next) {
  const { formId } = req.params;
  const formData = req.body;

  try {

    const updatedForm = await adoptionFormService.changeFormStatus(formId, formData);
    res.status(200).json(updatedForm);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

async function editFormQuestions(req, res, next) {
  const { formId } = req.params;
  const { id } = req.payload;
  const { shelterId } = req.params;

  const selectedShelter = await db.Shelter.findOne({
    _id: shelterId,
    status: "active",
  });
  if (!selectedShelter) {
    return res
      .status(404)
      .json({ message: "Trung tâm không tồn tại hoặc không hoạt động!" });
  }

  try {
    const existingForm = await db.AdoptionForm.findOne({
      _id: formId,
      shelter: shelterId,
    });
    if (!existingForm) {
      return res.status(404).json({ message: "Form không tồn tại!" });
    }
    if (existingForm.status != "draft") {
      return res.status(400).json({
        message: "Không thể chỉnh sửa câu hỏi! Vui lòng chuyển form về trạng thái nháp trước khi chỉnh sửa câu hỏi.",
      });
    }


    const savedQuestions = await questionService.editListQuestions(
      req.body.questions
    );

    const updatedForm = await adoptionFormService.editForm(
      formId,
      {
        ...req.body,
        questions: savedQuestions.map((question) => question._id),
      },
      shelterId
    );
    res.status(200).json(updatedForm);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

async function deleteForm(req, res, next) {
  const { formId } = req.params;
  try {
    const form = await adoptionFormService.deleteForm(formId);
    res.status(204).json({ message: "Form deleted successfully" });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}


// get form by petID
const getFormByPetId = async (req, res, next) => {
  try {
    const { petId } = req.params;
    const selectedPet = await db.Pet.findOne({
      _id: petId,
      status:  { $in: ["available", "adopted", "booking", "delivered"] },
    });
    if (!selectedPet) {
      return res
        .status(404)
        .json({ message: "Thú cưng không tìm thấy hoặc chưa sẵn sàng nhận nuôi" });
    }

    const forms = await adoptionFormService.getFormsByPetId(petId);
    res.status(200).json(forms);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};


const adoptionFormController = {
  getFormsByShelter,
  createForm,
  editForm,
  changeFormStatus,
  createFormByTemplate,
  editFormQuestions,
  deleteForm,
  getFormByPetId,

};

module.exports = adoptionFormController;
