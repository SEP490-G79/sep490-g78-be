const MedicalRecord = require("../models/medicalRecord.model");
const Pet = require("../models/pet.model");
const db = require("../models/");
const Shelter = require("../models/shelter.model");

const getAllPets = async () => {
  try {
    const pets = await Pet.find()
      .populate("species")
      .populate("breeds")
      .populate("shelter")
      .populate("adopter");
    return pets;
  } catch (error) {
    throw error;
  }
};
const getAllPetsByShelter = async (shelterId, page = 1, limit = 8) => {
  const skip = (page - 1) * limit;

  const [pets, total] = await Promise.all([
    Pet.find({ shelter: shelterId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("breeds species"),
    Pet.countDocuments({ shelter: shelterId }),
  ]);

  return {
    pets,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

const viewPetDetails = async (petId) => {
  try {
    const pet = await Pet.findById(petId)
      .populate("species")
      .populate("breeds")
      .populate("shelter")
      .populate("adopter");
    return pet;
  } catch (error) {
    throw error;
  }
};

const createPet = async (petData) => {
  try {
    // 1. Lấy shelterCode từ shelterId
    const shelter = await Shelter.findById(petData.shelter);
    if (!shelter) {
      throw new Error("Shelter not found");
    }
    const shelterCode = shelter.shelterCode;

    // 2. Tìm petCode lớn nhất theo shelterCode
    const lastPet = await Pet.findOne({
      petCode: { $regex: `^${shelterCode}\\d{3}$` }, // ví dụ: HAPPY001, DOG023
    })
      .sort({ petCode: -1 }) // sort theo chuỗi giảm dần (OK vì pad 0 rồi)
      .lean();

    // 3. Sinh số tiếp theo
    let nextNumber = 1;
    const match = lastPet?.petCode?.match(/(\d{3})$/); // chỉ lấy đúng 3 số cuối
    if (match) {
      nextNumber = parseInt(match[1], 10) + 1;
    }

    const formattedNumber = String(nextNumber).padStart(3, "0");
    const petCode = `${shelterCode}${formattedNumber}`;
    petData.petCode = petCode;

    // 4. Tạo thú nuôi
    try {
      const pet = new Pet(petData);
      return await pet.save();
    } catch (err) {
      // Nếu bị trùng petCode (rất hiếm), thử lại 1 lần nữa
      if (err.code === 11000 && err.keyPattern?.petCode) {
        console.warn("⚠️ petCode bị trùng, thử lại...");
        return await createPet(petData); // retry 1 lần
      }
      throw err;
    }
  } catch (error) {
    console.error("❌ CREATE PET ERROR:", error);
    throw error;
  }
};

const updatePet = async (petId, updateData) => {
  try {
    // Lấy pet cần update
    const pet = await Pet.findById(petId);
    if (!pet) throw new Error("Không tìm thấy thú cưng");

    // Kiểm tra nếu có trường shelter trong updateData thì phải khớp
    if (
      updateData.shelter &&
      pet.shelter.toString() !== updateData.shelter.toString()
    ) {
      throw new Error("Thú cưng không thuộc trạm cứu hộ này!");
    }

    // Cập nhật dữ liệu
    return await Pet.findByIdAndUpdate(petId, updateData, { new: true });
  } catch (error) {
    throw error;
  }
};

const deletePet = async (petId) => {
  try {
    return await Pet.findByIdAndDelete(petId);
  } catch (error) {
    throw error;
  }
};

const getMedicalRecords = async (petId) => {
  try {
    const pet = await Pet.findById(petId);
    if (!pet) {
      throw new Error("Pet not found");
    }

    const records = await MedicalRecord.find({ pet: petId })
      .populate("performedBy", "fullName email")
      .sort({ procedureDate: -1 });

    return { pet, records };
  } catch (error) {
    throw error;
  }
};

const getPetList = async () => {
  try {
    const pets = await db.Pet.find()
      .populate("breeds")
      .populate("species")
      .populate("shelter")
      .populate("adopter");
    const result = pets.map((pet) => {
      return {
        _id: pet._id,
        name: pet.name,
        isMale: pet.isMale,
        age: pet.age,
        weight: pet.weight,
        petCode: pet.petCode,
        identificationFeature: pet.identificationFeature,
        sterilizationStatus: pet.sterilizationStatus,
        species: {
          name: pet.species.name,
          description: pet.species.description,
        },
        breeds: pet.breeds.map((breed) => ({
          name: breed.name,
          description: breed.description,
        })),

        color: pet.color,
        bio: pet.bio,
        intakeTime: pet.intakeTime,
        photos: pet.photos,
        foundLocation: pet.foundLocation,
        tokenMoney: pet.tokenMoney,
        shelter: {
          _id: pet.shelter._id,
          name: pet.shelter.name,
          bio: pet.shelter.bio,
        },
        adopter: {
          _id: pet.adopter ? pet.adopter._id : null,
          fullName: pet.adopter ? pet.adopter.fullName : null,
        },
        status: pet.status,
      };
    });
    return result;
  } catch (error) {
    throw error;
  }
};

const getPetById = async (petId) => {
  try {
    const pet = await db.Pet.findById(petId)
      .populate("breeds")
      .populate("species")
      .populate("shelter");
    if (!pet) {
      throw new Error("Pet not found");
    }
    return pet;
  } catch (error) {
    throw error;
  }
};

const getAdoptedPetbyUser = async (userId) => {
  try {
    const pets = await db.Pet.find({ adopter: userId })
      .populate("breeds")
      .populate("species")
      .populate("shelter")
      .populate("adopter");
    const result = pets.map((pet) => {
      return {
        _id: pet._id,
        name: pet.name,
        isMale: pet.isMale,
        age: pet.age,
        weight: pet.weight,
        identificationFeature: pet.identificationFeature,
        sterilizationStatus: pet.sterilizationStatus,
        species: {
          name: pet.species.name,
          description: pet.species.description,
        },
        breeds: pet.breeds.map((breed) => ({
          name: breed.name,
          description: breed.description,
        })),

        color: pet.color,
        bio: pet.bio,
        intakeTime: pet.intakeTime,
        photos: pet.photos,
        foundLocation: pet.foundLocation,
        tokenMoney: pet.tokenMoney,
        shelter: {
          name: pet.shelter.name,
          bio: pet.shelter.bio,
        },
        adopter: {
          _id: pet.adopter ? pet.adopter._id : null,
          fullName: pet.adopter ? pet.adopter.fullName : null,
        },
        status: pet.status,
      };
    });
    return result;
  } catch (error) {
    throw error;
  }
};

const getMedicalRecordsByPet = async (petId, page = 1, limit = 3) => {
  const skip = (page - 1) * limit;
  const [records, total] = await Promise.all([
    MedicalRecord.find({ pet: petId })
      .populate("performedBy", "fullName email")
      .sort({ procedureDate: -1 })
      .skip(skip)
      .limit(limit),
    MedicalRecord.countDocuments({ pet: petId }),
  ]);
  return { records, total };
};

module.exports = {
  getAllPets,
  createPet,
  updatePet,
  viewPetDetails,
  deletePet,
  getMedicalRecords,
  getPetList,
  getPetById,
  getAdoptedPetbyUser,
  getMedicalRecordsByPet,
  getAllPetsByShelter,
};
