const db = require('../models');
const JWT = require('jsonwebtoken');
const bcrypt = require("bcrypt")
const morgan = require("morgan")
const createHttpErrors = require("http-errors");
const { notificationService } = require('../services');

const getAlls = async (req, res, next) => {
  try {
    const userId = req.payload?.id;
    const notifications = await notificationService.getAllNotifications(userId);
    res.status(200).json({ status: 200, message: "Get notifications successfully!", notifications });
  } catch (error) {
    next(error);
  }
};

const markSeen = async (req, res, next) => {
  try {
    const userId = req.payload.id;
    const notificationId = req.params.notificationId;

    const updated = await db.User.updateOne(
      { _id: userId, "notifications._id": notificationId },
      { $set: { "notifications.$.isSeen": true } }
    );

    if (updated.modifiedCount === 0) {
      return res.status(404).json({ message: "Notification not found or already seen" });
    }

    res.status(200).json({ message: "Marked as seen" });
  } catch (err) {
    next(err);
  }
};


const notificationController = {
    getAlls,
    markSeen
}

module.exports = notificationController;