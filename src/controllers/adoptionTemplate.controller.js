const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../models/index");
const adoptionTemplateService = require("../services/adoptionTemplate.service");
const questionService = require("../services/question.service");

async function getAll(req, res, next) {
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
  try {
    const templates = await adoptionTemplateService.getAll(shelterId);
    res.status(200).json(templates);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

async function create(req, res, next) {
  const { id } = req.payload;
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

  try {
    const template = await adoptionTemplateService.create(
      req.body,
      id,
      shelterId
    );
    res.status(201).json(template);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}



async function editTemplate(req, res, next) {
  const { templateId } = req.params;
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
    const updatedTemplate = await adoptionTemplateService.editTemplate(
      templateId,
      req.body,
      shelterId
    );
    res.status(200).json(updatedTemplate);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

const editTemplateQuestions = async (req, res, next) => {
  const { templateId } = req.params;
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
    const savedQuestions = await questionService.editListQuestions(
      req.body.questions
    );

    const updatedTemplate = await adoptionTemplateService.editTemplate(
      templateId,
      {
        ...req.body,
        questions: savedQuestions.map((question) => question._id),
      },
      shelterId
    );
    res.status(200).json(updatedTemplate);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

async function duplicateTemplate(req, res, next) {
  const { templateId } = req.params;
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
  const oldTemplate = await db.AdoptionTemplate.findById(templateId).populate("questions").lean();
  if (!oldTemplate) {
    return res.status(404).json({ message: "Mẫu không tồn tại" });
  }
  try {
    const dataQuestions = oldTemplate.questions.map(({_id,...question}) => {
      return {
        ...question
      };
    })
    const savedQuestions = await questionService.editListQuestions(dataQuestions);
    newData = {
      title: `${oldTemplate.title}-Copy`,
      species: oldTemplate.species,
      description: oldTemplate.description,
      questions: savedQuestions.map((question) => question._id),
    }
    const newTemplate = await adoptionTemplateService.create(
      newData,
      id,
      shelterId
    );

    res.status(200).json(newTemplate);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

async function deleteTemplate(req, res, next) {
  const { templateId } = req.params;
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

  try {
    await adoptionTemplateService.deleteTemplate(templateId, shelterId);
    res.status(204).json({ message: "Xóa thành công" });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

const adoptionTemplateController = {
  getAll,
  create,
  editTemplate,
  duplicateTemplate,
  editTemplateQuestions,
  deleteTemplate,
};

module.exports = adoptionTemplateController;
