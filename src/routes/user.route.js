const express = require("express");
const userRouter = express.Router();
const bodyParser = require("body-parser");
const { userController } = require("../controllers");
const cloudinary = require("../configs/cloudinary");
const { verifyAccessToken } = require("../middlewares/auth.middleware");
const { isAdmin } = require("../middlewares/admin.middleware");

userRouter.use(bodyParser.json());

userRouter.get("/", userController.getAllUsers);
userRouter.get("/get-user",verifyAccessToken, userController.getUserByToken);
userRouter.get("/user-profile/:userId", userController.getUserById);
userRouter.put("/change-password", verifyAccessToken, userController.changePassword);
userRouter.put("/edit-profile",
  cloudinary.upload.fields([
    { name: "avatar", maxCount: 1 },
    { name: "background", maxCount: 1 },
  ]),
  verifyAccessToken,
  userController.editProfile
);
userRouter.put( "/wishlist/:petId", verifyAccessToken, userController.wishListPet);

//ADMIN
userRouter.get("/admin/get-users-list",[verifyAccessToken, isAdmin], userController.getUsersList);
userRouter.post(
  "/admin/add-user",
  [verifyAccessToken, isAdmin],
  userController.addUser
);
userRouter.put(
  "/admin/change-roles/:userId",
  [verifyAccessToken, isAdmin],
  userController.changeUserRole
);
userRouter.put(
  "/admin/ban-user/:userId",
  [verifyAccessToken, isAdmin],
  userController.banUser
);
userRouter.put(
  "/admin/unban-user/:userId",
  [verifyAccessToken, isAdmin],
  userController.unbanUser
);

module.exports = userRouter;
