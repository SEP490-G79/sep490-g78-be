const petService = require("../services/pet.service");
const { cloudinary } = require("../configs/cloudinary");
const medicalRecordService = require("../services/medicalRecord.service");
const {
  analyzePetWithGPT,
  searchPetWithGPT,
} = require("../services/gptVision.service");
const mongoose = require("mongoose");
const db = require("../models");
const fs = require("fs/promises");
const { speciesService, breedsService } = require("../services");

const getAllPets = async (req, res) => {
  try {
    const { shelterId } = req.params;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 8;

    if (!shelterId) {
      return res.status(400).json({ message: "Thiếu shelterId" });
    }

    const result = await petService.getAllPetsByShelter(shelterId, page, limit);
    res.status(200).json(result);
  } catch (error) {
    console.error("❌ getAllPets:", error);
    res.status(500).json({ message: "Lỗi máy chủ", error: error.message });
  }
};
const getAllPetsForSubmission = async (req, res, next) => {
  try {
    const { shelterId } = req.params;
    const { status } = req.query;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 8;

    if (!shelterId) {
      return res.status(400).json({ message: "Missing shelterId" });
    }

    const result = await petService.getAllPetsByShelterForSubmission(
      shelterId,
      page,
      limit,
      status
    );
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

const viewDetailPet = async (req, res) => {
  try {
    const pet = await petService.viewPetDetails(req.params.petId);
    if (!pet)
      return res.status(404).json({ message: "Không tìm thấy thú cưng" });
    res.status(200).json(pet);
  } catch (error) {
    res.status(500).json({ message: "Lỗi máy chủ", error: error.message });
  }
};

const createPet = async (req, res) => {
  try {
    const { shelterId } = req.params;
    if (!shelterId) {
      return res.status(400).json({ message: "Thiếu shelterId" });
    }

    const petData = { ...req.body, shelter: shelterId };
    const newPet = await petService.createPet(petData);
    res.status(201).json(newPet);
  } catch (error) {
    console.error("❌ createPet:", error);
    res
      .status(400)
      .json({ message: "Dữ liệu không hợp lệ", error: error.message });
  }
};

const updatePet = async (req, res) => {
  try {
    const { petId, shelterId } = req.params;

    const updatedPet = await petService.updatePet(petId, {
      ...req.body,
      shelter: shelterId,
    });

    res.status(200).json(updatedPet);
  } catch (error) {
    console.error("updatePet:", error);
    res
      .status(400)
      .json({ message: "Dữ liệu không hợp lệ", error: error.message });
  }
};

const disablePet = async (req, res) => {
  try {
    const { petId, shelterId } = req.params;

    const pet = await db.Pet.findOne({ _id: petId, shelter: shelterId });
    if (!pet) {
      return res.status(404).json({ message: "Không tìm thấy thú cưng" });
    }

    const updatedPet = await db.Pet.findByIdAndUpdate(
      petId,
      { status: "disabled" },
      { new: true }
    );

    res
      .status(200)
      .json({ message: "Thú nuôi đã bị vô hiệu hóa", pet: updatedPet });
  } catch (err) {
    res.status(500).json({
      message: "Lỗi máy chủ",
      error: err.message,
    });
  }
};

const getMedicalRecords = async (req, res) => {
  try {
    const records = await petService.getMedicalRecords(req.params.petId);
    res.status(200).json(records);
  } catch (error) {
    res.status(500).json({ message: "Lỗi máy chủ", error: error.message });
  }
};

const uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Không có file nào được upload" });
    }

    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: "pets",
    });
    await fs.unlink(req.file.path).catch((err) => {
      console.error("Lỗi khi xóa file tạm:", err);
    });
    res.status(200).json({ url: result.secure_url });
  } catch (error) {
    res.status(500).json({ message: "Upload thất bại", error: error.message });
  }
};

const getPetList = async (req, res) => {
  try {
    const pets = await petService.getPetList();
    res.status(200).json(pets);
  } catch (error) {
    res.status(500).json({ message: "Lỗi máy chủ", error: error.message });
  }
};

const getPetById = async (req, res) => {
  const { petId } = req.params;
  try {
    const pet = await petService.getPetById(petId);
    if (!pet)
      return res.status(404).json({ message: "Không tìm thấy thú cưng" });
    res.status(200).json(pet);
  } catch (error) {
    res.status(500).json({ message: "Lỗi máy chủ", error: error.message });
  }
};

const getAdoptedPetbyUser = async (req, res) => {
  const userId = req.params.userId;
  try {
    const pets = await petService.getAdoptedPetbyUser(userId);
    res.status(200).json(pets);
  } catch (error) {
    res.status(500).json({ message: "Lỗi máy chủ", error: error.message });
  }
};

const getMedicalRecordsByPet = async (req, res) => {
  try {
    const petId = req.params.petId || req.query.petId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 3;

    if (!petId) return res.status(400).json({ message: "petId là bắt buộc" });

    const { records, total } =
      await medicalRecordService.getMedicalRecordsByPet(petId, page, limit);

    res.status(200).json({ records, total, page, limit });
  } catch (error) {
    res.status(500).json({ message: "Lỗi máy chủ", error: error.message });
  }
};

const analyzePetImage = async (req, res) => {
  try {
    const { imageBase64 } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ message: "Thiếu dữ liệu ảnh" });
    }

    const result = await analyzePetWithGPT(imageBase64);
    res.status(200).json(result);
  } catch (err) {
    res
      .status(500)
      .json({ message: "AI phân tích thất bại", error: err.message });
  }
};

const searchPetByImage = async (req, res) => {
  try {
    const { colorsList } = req.body;
    const imageRaw = req.file;

    const speciesRaw = await speciesService.getAll();
    const breedsRaw = await breedsService.getAll();

    const speciesList = speciesRaw.map((species) => ({
      name: species.name,
      description: species.description,
    }));

    const breedsList = breedsRaw.map((breed) => ({
      name: breed.name,
      description: breed.description,
    }));

    if (!speciesList || !breedsList || !colorsList) {
      return res
        .status(400)
        .json({ message: "Thiếu dữ liệu của loài, giống và màu sắc" });
    }

    if (!imageRaw) {
      res.status(400).json({ message: "Thiếu dữ liệu ảnh" });
    }

    const image = await cloudinary.uploader.upload(imageRaw.path, {
      folder: "pets",
      resource_type: "image",
    });

    await fs.unlink(imageRaw.path).catch((err) => {
      console.error("Lỗi khi xóa tệp:", err);
    });

    if (!image || !image.secure_url) {
      res.status(400).json({ message: "Không thể tải ảnh lên" });
    }

    const result = await searchPetWithGPT(
      image.secure_url,
      speciesList,
      breedsList,
      colorsList
    );
    res.status(200).json(result);
  } catch (err) {
    res
      .status(400)
      .json({ message: err.message || "Lỗi khi phân tích hình ảnh!" });
  }
};

const petController = {
  getAllPets,
  createPet,
  updatePet,
  disablePet,
  getMedicalRecords,
  viewDetailPet,
  uploadImage,
  analyzePetImage,
  getPetList,
  getPetById,
  getAdoptedPetbyUser,
  getMedicalRecordsByPet,
  searchPetByImage,
  getAllPetsForSubmission,
};

module.exports = petController;
