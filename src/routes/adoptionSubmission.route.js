const express = require ("express");
const adoptionSubmissionRouter = express.Router();
const bodyParser = require("body-parser");
const { verifyAccessToken } = require("../middlewares/auth.middleware");


const { adoptionSubmissionController } = require("../controllers");
const shelterMiddleware = require("../middlewares/shelter.middleware");

adoptionSubmissionRouter.use(bodyParser.json());

adoptionSubmissionRouter.get("/get-adoption-request-list",verifyAccessToken ,adoptionSubmissionController.getAdtoptionRequestList);
adoptionSubmissionRouter.post("/by-pet-ids", verifyAccessToken, adoptionSubmissionController.getSubmissionsByPetIds);
adoptionSubmissionRouter.post("/create-adoption-submission/:shelterId",[verifyAccessToken, shelterMiddleware.isNotShelterMember] ,adoptionSubmissionController.createAdoptionSubmission);
adoptionSubmissionRouter.post("/check-user-submitted",verifyAccessToken ,adoptionSubmissionController.checkUserSubmitted);
adoptionSubmissionRouter.patch("/update-submission-status/:shelterId", [verifyAccessToken, shelterMiddleware.isShelterMember], adoptionSubmissionController.updateSubmissionStatus);
adoptionSubmissionRouter.post("/schedule-interview/:shelterId", [verifyAccessToken, shelterMiddleware.isShelterMember], adoptionSubmissionController.createInterviewSchedule);
adoptionSubmissionRouter.put("/update-interview-performer/:shelterId", [verifyAccessToken, shelterMiddleware.isShelterManager], adoptionSubmissionController.updateInterviewPerformer);
adoptionSubmissionRouter.get("/staff-schedule-count/:shelterId", [verifyAccessToken, shelterMiddleware.isShelterManager], adoptionSubmissionController.getInterviewCounts);
adoptionSubmissionRouter.put("/interview-feedback/:shelterId", [verifyAccessToken, shelterMiddleware.isShelterStaff], adoptionSubmissionController.addInterviewFeedback);
adoptionSubmissionRouter.put("/interview-note/:shelterId", [verifyAccessToken, shelterMiddleware.isShelterManager], adoptionSubmissionController.addInterviewNote);
adoptionSubmissionRouter.get("/:submissionId", verifyAccessToken, adoptionSubmissionController.getAdoptionSubmissionById);
adoptionSubmissionRouter.put("/select-schedule", verifyAccessToken, adoptionSubmissionController.selectInterviewSchedule);

adoptionSubmissionRouter.get("/user/:userId", adoptionSubmissionController.getSubmissionsByUser);




module.exports = adoptionSubmissionRouter;

