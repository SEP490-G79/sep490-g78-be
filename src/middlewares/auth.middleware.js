const jwt = require("jsonwebtoken");
const createError = require("http-errors");
const passport = require("passport");
const { User } = require("../models");

const verifyAccessToken = (req, res, next) => {
  if (!req.headers["authorization"]) {
    return res
        .status(401)
        .json({
          error: { status: 401, message: "Chưa cung cấp access token!" },
        });
  }
  const authHeader = req.headers["authorization"];
  const bearerToken = authHeader.split(" ");
  const token = bearerToken[1];

  if (!token) {
    return res
        .status(401)
        .json({
          error: { status: 401, message: "Access token không hợp lệ!" },
        });
  }
  jwt.verify(token, process.env.JWT_SECRET, (err, payload) => {
    if (err) {
      return res
        .status(401)
        .json({
          error: { status: 401, message: "Access token không hợp lệ!" },
        });
    }
    req.payload = payload;
    req.user = next();
  });
};

const optionalVerifyAccessToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (!err) {
        req.payload = decoded;
      }
    });
  }
  next();
};

const isActive = async (req, res, next) => {
  try {
    const { id } = req.payload;
    const user = await User.findOne({ _id: id });
    if(!user){
      return res
        .status(400)
        .json({
          error: { status: 400, message: "Tài khoản không tồn tại!" },
        });
    }
    if (user.status != "active") {
      return res
        .status(400)
        .json({
          error: { status: 401, message: "Tài khoản không ở trạng thái kích hoạt!" },
        });
    }
    next();
  } catch (error) {
    next(error);
  }
};

const verifyGoogleCallback = passport.authenticate("google-user", {
  failureRedirect: "http://localhost:3000/error",
});
const verifyGoogleCallbackAdmin = passport.authenticate("google-admin", {
  failureRedirect: "http://localhost:3000/error",
});

const authMiddleware = {
  verifyAccessToken,
  optionalVerifyAccessToken,
  isActive,
  verifyGoogleCallback,
  verifyGoogleCallbackAdmin,
};

module.exports = authMiddleware;
