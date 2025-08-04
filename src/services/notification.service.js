const db = require("../models");

const createNotification = async (
  from,
  receivers,
  content,
  type,
  redirectUrl
) => {
  try {
    if (!Array.isArray(receivers) || receivers.length == 0) {
      throw new Error("Receivers must be a non-empty array");
    }
    if (!content || typeof content !== "string") {
      throw new Error("Content must be a valid string");
    }
    if (!type || typeof type !== "string") {
      throw new Error("Type must be a valid string");
    }

    const validReceivers = await db.User.find(
      { _id: { $in: receivers }, status: { $ne: "banned" } },
      { _id: 1 }
    );

    if (validReceivers.length === 0) {
      throw new Error("No valid receivers found (may not exist or are banned)");
    }

    const validReceiverIds = validReceivers.map((user) => user._id);

    const newNotification = {
      from: from,
      receivers: validReceiverIds,
      content: content,
      type: type,
      redirectUrl,
    };

    const createdNotification = await db.Notification.create(newNotification);

    if (createdNotification) {
      await db.User.updateMany(
        { _id: { $in: validReceiverIds } },
        {
          $addToSet: {
            notifications: { _id: createdNotification._id, isSeen: false },
          },
        }
      );
    }

    return createdNotification;
  } catch (error) {
    // console.error("Error creating notification:", error.message);
    throw error;
  }
};

const getAllNotifications = async (userId) => {
  try {
    const user = await db.User.findById(userId);
    if (!user) throw new Error("User not found");

    const seenMap = new Map();
    user.notifications?.forEach((n) => {
      seenMap.set(n._id.toString(), n.isSeen);
    });

    const notifications = await db.Notification.find({ receivers: userId })
      .populate("from", "_id fullName avatar")
      .sort({ createdAt: -1 });

    return notifications.map((n) => ({
      _id: n._id,
      from: n.from,
      receiver: { _id: user._id, fullName: user.fullName, avatar: user.avatar },
      content: n.content,
      redirectUrl: n.redirectUrl,
      seen: seenMap.get(n._id.toString()) ?? false,
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
    }));
  } catch (error) {
    throw error;
  }
};

const notificationService = {
  createNotification,
  getAllNotifications,
};

module.exports = notificationService;
