const express = require("express");
const bodyParser = require("body-parser");
const db = require("../models/index");
const { notificationController } = require("../controllers");
const authMiddleware = require("../middlewares/auth.middleware");


const notificationRouter = express.Router();
notificationRouter.use([authMiddleware.verifyAccessToken]);

notificationRouter.get("/get-all", notificationController.getAlls);
notificationRouter.put("/:notificationId/mark-seen", notificationController.markSeen);

notificationRouter.use(bodyParser.json());


module.exports = notificationRouter;