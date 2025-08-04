const express = require("express");
const consentFormRouter = express.Router({ mergeParams: true });
const bodyParser = require("body-parser");
const { authMiddleware, shelterMiddleware } = require("../middlewares");
const { consentFormController } = require("../controllers");
const { cloudinary } = require("../configs");

consentFormRouter.use(bodyParser.json());

consentFormRouter.get(
  "/get-by-user",
  [authMiddleware.verifyAccessToken, authMiddleware.isActive],
  consentFormController.getByUser
);

consentFormRouter.put(
  "/:consentFormId/change-status-user",
  [authMiddleware.verifyAccessToken, authMiddleware.isActive],
  consentFormController.changeFormStatusUser
);

module.exports = consentFormRouter;
