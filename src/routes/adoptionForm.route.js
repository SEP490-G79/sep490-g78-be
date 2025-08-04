const express = require("express");
const adoptionFormRouter = express.Router({ mergeParams: true });
const bodyParser = require("body-parser");
const cloudinary = require("../configs/cloudinary");
const {
  verifyAccessToken,
  isActive,
  verifyGoogleCallback,
  verifyGoogleCallbackAdmin,
} = require("../middlewares/auth.middleware");
const adoptionFormController = require("../controllers/adoptionForm.controller");
const shelterMiddleware = require("../middlewares/shelter.middleware");

adoptionFormRouter.use(bodyParser.json());

adoptionFormRouter.get(
  "/get-by-shelter",
  [verifyAccessToken, isActive],
  adoptionFormController.getFormsByShelter
);
adoptionFormRouter.post(
  "/create/:petId",
  [verifyAccessToken, isActive,shelterMiddleware.isShelterStaff],
  adoptionFormController.createForm
);
adoptionFormRouter.post(
  "/create-by-template/:petId",
  [verifyAccessToken, isActive,shelterMiddleware.isShelterStaff],
  adoptionFormController.createFormByTemplate
);
adoptionFormRouter.put(
  "/:formId/edit",
  [verifyAccessToken, isActive,shelterMiddleware.isShelterStaff],
  adoptionFormController.editForm
);
adoptionFormRouter.put(
  "/:formId/change-status",
  [verifyAccessToken, isActive,shelterMiddleware.isShelterStaff],
  adoptionFormController.changeFormStatus
);
adoptionFormRouter.put(
  "/:formId/update-questions",
  [verifyAccessToken, isActive,shelterMiddleware.isShelterStaff],
  adoptionFormController.editFormQuestions
);
adoptionFormRouter.delete(
  "/:formId/delete",
  [verifyAccessToken, isActive,shelterMiddleware.isShelterStaff],
  adoptionFormController.deleteForm
);

module.exports = adoptionFormRouter;
