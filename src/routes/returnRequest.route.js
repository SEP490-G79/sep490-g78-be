const express = require("express");
const returnRequestRouter = express.Router({ mergeParams: true });
const returnRequestController = require("../controllers/returnRequest.controller");
const {verifyAccessToken} = require("../middlewares/auth.middleware");
const {isShelterStaff} = require("../middlewares/shelter.middleware");
const cloudinary = require("../configs/cloudinary");


returnRequestRouter.post("/create", cloudinary.upload.array("photos", 5), verifyAccessToken, returnRequestController.createReturnRequest);

returnRequestRouter.put("/:requestId/update", cloudinary.upload.array("photos", 5), verifyAccessToken, returnRequestController.updateReturnRequest);

//returnRequestRouter.get("/get-all", verifyAccessToken, returnRequestController.getReturnRequests);

returnRequestRouter.get("/get-by-user", verifyAccessToken, returnRequestController.getReturnRequestsByUser);
returnRequestRouter.get("/user/:userId", verifyAccessToken, returnRequestController.getReturnRequestsByUserId);

returnRequestRouter.get("/get-by-shelter", [verifyAccessToken, isShelterStaff], returnRequestController.getReturnRequestsByShelter); //merge params

returnRequestRouter.delete("/:requestId/delete", verifyAccessToken, returnRequestController.deleteReturnRequest);

returnRequestRouter.put("/:requestId/approve", [verifyAccessToken, isShelterStaff], returnRequestController.approveReturnRequest); //merge params

returnRequestRouter.put("/:requestId/reject", [verifyAccessToken, isShelterStaff], returnRequestController.rejectReturnRequest); //merge params

module.exports = returnRequestRouter;
