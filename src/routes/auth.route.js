const express = require("express");
const authRouter = express.Router();
const bodyParser = require("body-parser");
const db = require("../models/index");
const { authController } = require("../controllers");
const { verifyAccessToken, verifyGoogleCallback, verifyGoogleCallbackAdmin } = require("../middlewares/auth.middleware");
const authMiddleware = require("../middlewares/auth.middleware");

authRouter.use(bodyParser.json());
authRouter.post("/forgot-password/:email",
    authController.forgotPassword
)
authRouter.post("/reset-password",
    authController.resetPassword
)
authRouter.post("/send-activation-email",
    authController.sendActivationEmail
)
authRouter.post("/verify-account", 
    authController.verifyAccount
)


// Endpoint đăng ký
authRouter.post("/register", authController.register);
// Endpoint đăng nhập
authRouter.post("/login", authController.login);

// login, register bang google
authRouter.get("/loginByGoogle", authController.loginByGoogle);
authRouter.get("/admin/loginByGoogle", authController.loginByGoogleAdmin);
authRouter.get("/loginByGoogle/callback", verifyGoogleCallback, authController.loginByGoogleCallbackUser);
authRouter.get("/admin/loginByGoogle/callback", verifyGoogleCallbackAdmin, authController.loginByGoogleCallbackAdmin);
authRouter.get("/getUserByAccessToken", authController.getUserByAccessToken);  

// refresh access token
authRouter.post("/refresh", authController.refreshAccessToken);
authRouter.post("/getRefreshToken", authController.getRefreshToken);

authRouter.get("/checkLoginStatus", authController.checkLoginStatus);

authRouter.post("/logout", authController.logout);


// authRouter.get("/testToken", authMiddleware.verifyAccessToken, (req, res) => { res.status(200).json({ message: "Token is valid" }) });

module.exports = authRouter;