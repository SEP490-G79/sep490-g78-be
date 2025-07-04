const express = require("express");
const userRouter = express.Router();
const bodyParser = require("body-parser");
const { userController } = require("../controllers");
const cloudinary = require("../configs/cloudinary");
const { verifyAccessToken, verifyGoogleCallback, verifyGoogleCallbackAdmin } = require("../middlewares/auth.middleware");
const { isAdmin } = require("../middlewares/admin.middleware");

userRouter.use(bodyParser.json());

userRouter.get("/", userController.getAllUsers);
userRouter.get("/user-profile",verifyAccessToken, userController.getUserById);
userRouter.put("/change-password", verifyAccessToken, userController.changePassword);
userRouter.put("/edit-profile",
  cloudinary.upload.fields([
    { name: "avatar", maxCount: 1 },
    { name: "background", maxCount: 1 },
  ]),
  verifyAccessToken,
  userController.editProfile
);

//ADMIN
userRouter.get("/admin/get-users-list",[verifyAccessToken, isAdmin], userController.getUsersList);

module.exports = userRouter;
