const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../models/index");
const questionService = require("./question.service");

async function getAll(shelterId) {
  try {
    const templates = await db.AdoptionTemplate.find({
      shelter: shelterId,
      status: "active",
    })
      .populate("species", " _id name")
      .populate("questions")
      .populate("createdBy", "fullName email avatar")
      .populate("shelter", "name")
      .lean();
    return templates?.map((t) => {
      return {
        ...t,
        shelter: t?.shelter?.name,
      };
    });
  } catch (error) {
    throw error;
  }
}

async function create(data, createdBy, shelterId) {
  try {
    const { title, species, description } = data;
    if (!title) {
      throw new Error("Tiêu đề là bắt buộc");
    }
    if(!species) {
      throw new Error("Yêu cầu chọn loài cho mẫu");
    }
    const checkSpecies = await db.Species.findById(species);
    if (!checkSpecies) {
      throw new Error("Loài không tồn tại");
    } 
    const addData = new db.AdoptionTemplate({
      title: title,
      species: species,
      description: description,
      questions: data.questions ? data.questions : [],
      createdBy: createdBy,
      shelter: shelterId,
    });

    const newTemplate = await addData.save();
    const result = await db.AdoptionTemplate.findById(newTemplate._id)
      .populate("species", "_id name")
      .populate("questions")
      .populate("createdBy", "fullName email avatar")
      .lean();

    return {
      ...result,
      createdBy: {
        fullName: result.createdBy.fullName,
        email: result.createdBy.email,
        avatar: result.createdBy.avatar,
      },
    };
  } catch (error) {
    throw error;
  }
}

async function editTemplate(templateId, data, shelterId) {
  try {
    const selectedTemplate = await db.AdoptionTemplate.findOne({
      _id: templateId,
      shelter: shelterId,
      status: "active",
    });
    if (!selectedTemplate) {
      throw new Error("Không tìm thấy mẫu đơn nhận nuôi");
    }
    if (data.species) {
      const checkSpecies = await db.Species.findById(data.species);
      if (!checkSpecies) {
        throw new Error("Loài không tồn tại");
      }
    }

    const { title, species, description } = data;
    if (!title || !species) {
      throw new Error("Tiêu đề và loài là bắt buộc");
    }
    const updatedTemplate = await db.AdoptionTemplate.findOneAndUpdate(
      { _id: templateId },
      data,
      { new: true }
    )
      .populate("species", "_id name")
      .populate("questions")
      .populate("createdBy", "fullName email avatar")
      .lean();
    if (!updatedTemplate) {
      throw new Error("Không thể cập nhật mẫu đơn nhận nuôi");
    }
    return {
      ...updatedTemplate,
      createdBy: {
        fullName: updatedTemplate.createdBy.fullName,
        email: updatedTemplate.createdBy.email,
        avatar: updatedTemplate.createdBy.avatar,
      },
    };
  } catch (error) {
    throw error;
  }
}


async function deleteTemplate(templateId, shelterId) {
  try {
    const selectedTemplate = await db.AdoptionTemplate.findOne({
      _id: templateId,
      shelter: shelterId,
      status: "active",
    });
    if (!selectedTemplate) {
      throw new Error("Không tìm thấy mẫu đơn nhận nuôi");
    }
    // const deletedTemplate = await db.AdoptionTemplate.findOneAndUpdate(
    //   { _id: templateId },
    //   { status: "inactive" },
    //   { new: true }
    // );
    // if (!deletedTemplate) {
    //   throw new Error("Không thể xóa mẫu đơn nhận nuôi");
    // }
    const deletedTemplate = await db.AdoptionTemplate.deleteOne({
      _id: templateId,
      shelter: shelterId,
    });
    return deletedTemplate;
  } catch (error) {
    throw error;
  }
}

const adoptionTemplateService = {
  getAll,
  create,
  editTemplate,
  deleteTemplate,
};

module.exports = adoptionTemplateService;
