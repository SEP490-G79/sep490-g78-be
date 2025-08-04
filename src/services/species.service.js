const {Species, Breed, Pet, Shelter} = require("../models");
const {createNotification} = require("./notification.service")

async function sendNotificationToAllShelter(senderId, message){
  try {
    const shelters = await Shelter.find({status: "active"});
    const allMemberIds = shelters.flatMap((shelter) =>
      shelter.members.map((member) => member._id)
    );
    if(shelters.length > 0){
        createNotification(senderId, allMemberIds, message, "system", "");
    }
  } catch (error) {
    throw error;
  }
}

//USER

//ADMIN
const getAll = async () => {
  try {
    return await Species.find().sort({createdAt: -1});
  } catch (error) {
    throw error;
  }
};
const createSpecies = async (adminId, name, description) => {
  try {
    const species = await Species.findOne({name: name});
    if(species){
      throw new Error("Loài đã tồn tại!")
    }
    const newSpecies = await Species.create({
      name,
      description
    })

    // gui thong bao cho tat ca shelter
    await sendNotificationToAllShelter(adminId, `Loài ${name} vừa được thêm vào hệ thống!`)

    return newSpecies;
  } catch (error) {
    throw error;
  }
};
const editSpecies = async (adminId, speciesId, description) => {
  try {
    const species = await Species.findById(speciesId);
    if(!species){
      throw new Error("Loài không tồn tại!")
    }
    await Species.findByIdAndUpdate(speciesId, {
      description: description
    })

    // gui thong bao cho tat ca shelter
    await sendNotificationToAllShelter(adminId, `Loài ${species.name} vừa được cập nhập!`)

    return {
      message: "Chỉnh sửa loài thành công!"
    };
  } catch (error) {
    throw error;
  }
};
const deleteSpecies = async (adminId, speciesId) => {
  try {
    const species = await Species.findById(speciesId);
    if (!species) {
      throw new Error("Id của loài không hợp lệ!");
    }

    const petCountsBySpecies = await Pet.countDocuments({species: speciesId})
    if(petCountsBySpecies > 0){
      throw new Error(`Không thể xóa loài vì đang có ${petCountsBySpecies} thú cưng đang sử dụng loài này!`);
    }
    const breedCountsBySpecies = await Breed.countDocuments({species: speciesId})
    if(breedCountsBySpecies > 0){
      throw new Error(`Không thể xóa loài vì đang có ${breedCountsBySpecies} giống đang sử dụng loài này!`);
    }
    
    // Xoá species
    await Species.findByIdAndDelete(speciesId);

    // gui thong bao cho tat ca shelter
    await sendNotificationToAllShelter(adminId, `Loài ${species.name} vừa bị xóa khỏi hệ thống!`)

    return {
      message: "Xóa loài thành công!",
    };
  } catch (error) {
    throw error;
  }
};


const speciesService = {
  //USER


  //ADMIN
  getAll,
  createSpecies,
  editSpecies,
  deleteSpecies,
};

module.exports = speciesService;