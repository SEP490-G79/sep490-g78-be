const express = require("express");
const petRouter = express.Router({ mergeParams: true });
const bodyParser = require("body-parser");
const { verifyAccessToken } = require("../middlewares/auth.middleware");
const petController = require("../controllers/pet.controller");
const upload = require("../middlewares/upload.middleware");
const adoptionFormController = require("../controllers/adoptionForm.controller");
const {
  isShelterStaff,
  isShelterMember,
} = require("../middlewares/shelter.middleware");
const cloudinary = require("../configs/cloudinary");

petRouter.use(bodyParser.json());
petRouter.get("/get-pet-list", petController.getPetList);
petRouter.get("/:petId/medicalRecords", petController.getMedicalRecords);
petRouter.get(
  "/get-by-shelter/:shelterId",
  [verifyAccessToken, isShelterStaff],
  petController.getAllPets
);
petRouter.get(
  "/get-by-shelter-for-submission/:shelterId",
  [verifyAccessToken, isShelterStaff],
  petController.getAllPetsForSubmission
);
petRouter.post(
  "/createPet/:shelterId",
  [verifyAccessToken, isShelterStaff],

  petController.createPet
);
petRouter.put(
  "/edit/:petId/:shelterId",
  [verifyAccessToken, isShelterStaff],
  petController.updatePet
);

petRouter.patch(
  "/delete/:petId/:shelterId",
  [verifyAccessToken, isShelterStaff],
  petController.disablePet
);
petRouter.get(
  "/get-adoptionForms-by-petId/:petId",
  adoptionFormController.getFormByPetId
);
petRouter.post("/upload-image", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ message: "No file uploaded" });
  res.status(200).json({ url: `/uploads/${req.file.filename}` });
});

petRouter.get("/get-by-id/:petId", petController.getPetById);
petRouter.get(
  "/get-adopted-by-user/:userId",
  petController.getAdoptedPetbyUser
);
petRouter.post("/ai-analyze", petController.analyzePetImage);
petRouter.post(
  "/search-by-ai",
  cloudinary.upload.single("imageRaw"),
  petController.searchPetByImage
);

module.exports = petRouter;
