const {Breed, Species, Pet, Shelter} = require("../models");
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
    return await Breed.find({}).populate("species").sort({createdAt: -1});
  } catch (error) {
    throw error;
  }
};
const createBreed = async (adminId, speciesId, name, description) => {
  try {
    const species = await Species.findById(speciesId);
    if(!species){
        throw new Error("Loài không hợp lệ! Vui lòng chọn loài có trong hệ thống")
    }
    const isBreedExisted = await Breed.findOne({ $or: [{ name: name }, { description: description }],})
    if(isBreedExisted){
        throw new Error("Giống đã tồn tại hoặc miêu tả bị trùng với giống khác !");
    }

    const newBreed = await Breed.create({
        species: speciesId,
        name: name,
        description: description
    })

    // gui thong bao cho tat ca shelter
    await sendNotificationToAllShelter(adminId, `Giống ${name} vừa được thêm vào hệ thống!`)

    return newBreed;
  } catch (error) {
    throw error;
  }
};
const editBreed = async (adminId, breedId, speciesId, name, description) => {
  try {
    const breed = await Breed.findById(breedId);
    if(!breed){
        throw new Error("Id của giống không hợp lệ!")
    }
    const species = await Species.findById(speciesId);
    if(!species){
        throw new Error("Id của loài không hợp lệ!")
    }
    await Breed.findByIdAndUpdate(breedId, {
      species: speciesId,
      name,
      description
    })

    // gui thong bao cho tat ca shelter
    await sendNotificationToAllShelter(adminId, `Giống ${breed.name} vừa được cập nhập!`)

    return {
      message: "Cập nhập giống thành công!"
    };
  } catch (error) {
    throw error;
  }
};
const deleteBreed = async (adminId, breedId) => {
  try {
    const breed = await Breed.findById(breedId);
    if(!breed){
        throw new Error("Giống không tồn tại");
    }

    // xoa breed
    await Breed.findByIdAndDelete(breedId);
    // xoa breed khoi cac pet dang su dung
    await Pet.updateMany({breeds: {$in: breedId}}, {$pull: {breeds: breedId}})

    // gui thong bao cho tat ca shelter
    await sendNotificationToAllShelter(adminId, `Giống ${breed.name} vừa bị xóa khỏi hệ thống!`)

    return {
      status: 200,
      message: `Xóa giống ${breed.name} thành công!`
    };
  } catch (error) {
    throw error;
  }
};

const breedsService = {
  //USER
    

  //ADMIN
  getAll,
  createBreed,
  editBreed,
  deleteBreed,
};

module.exports = breedsService;