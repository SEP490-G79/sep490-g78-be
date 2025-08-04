const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../models/index");
const authService = require("../services/auth.service");
const passport = require("../configs/passport.config");
const { bcryptUtils, jwtUtils, redisUtils } = require("../utils");
const { mailer } = require("../configs");


async function forgotPassword(req, res) {
    try {
        const { email } = req.params;
        const response = await authService.forgotPassword(email);
        res.json(response);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
}



// Hàm đặt lại mật khẩu
async function resetPassword(req, res) {
  try {
    const { password, confirmPassword, token } = req.body;
    const response = await authService.resetPassword(
      password,
      confirmPassword,
      token
    );
    res.status(200).json(response)
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}


const sendActivationEmail = async (req, res) => {
    const { activeToken } = req.body;

    try {
        if (!activeToken) {
            return res.status(400).json({ message: "Không có activation token!" });
        }

        // Giải mã token để lấy email
        const decoded = jwt.verify(activeToken, process.env.JWT_SECRET);
        const user = await db.User.findById(decoded.id);
        if (!user) {
            return res.status(404).json({ message: "Tài khoản không tồn tại!" });
        }

        if (user.status === "active") {
            return res.status(400).json({ message: "Tài khoản đã kích hoạt!" });
        }

        // Tạo link kích hoạt
        const activationLink = `${process.env.FE_URL_USER}/active-account?token=${activeToken}`;
        const to = user.email;
        const subject = "Kích hoạt tài khoản PawShelter";
        const body = `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
                <p>Chào bạn,</p>
                <p>Cảm ơn bạn đã đăng ký tài khoản tại hệ thống của chúng tôi. Để hoàn tất quá trình đăng ký và bắt đầu sử dụng các tính năng, vui lòng kích hoạt tài khoản của bạn.</p>
  
                <p>Vui lòng nhấn vào nút bên dưới để kích hoạt tài khoản:</p>
                <a href="${activationLink}" style="display: inline-block; padding: 10px 20px; color: #fff; background: #1890ff; text-decoration: none; border-radius: 5px;">
                    Kích hoạt tài khoản
                </a>

                <p>Nếu bạn không yêu cầu đăng ký tài khoản, vui lòng bỏ qua email này.</p>
  
                    <p>Trân trọng,<br />PawShelter</p>
            </div>
    `;

        await mailer.sendEmail(to, subject, body);

        res.json({ message: "Email kích hoạt đã gửi, hãy kiểm tra email!" });

    } catch (error) {
        console.error(error);
        res.status(400).json({ message: "Có gì đó sai sai!" });
    }
};

const verifyAccount = async (req, res) => {
    const { token } = req.body;
    try {
        if (!token) {
            return res.status(400).json({ message: "Thiếu token token!" });
        }
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await db.User.findById(decoded.id);
        if (!user) {
            return res.status(404).json({ message: "Tài khoản không tồn tại!" });
        }
        if (user.status === "active") {
            return res.status(200).json({ message: "Tài khoản đã kích hoạt rồi!", alreadyActivated: true });
        }
        if (user.status === "banned") {
            return res.status(200).json({ message: "Tài khoản bị ban không thể kích hoạt!" });
        }
        await db.User.updateOne({ _id: decoded.id }, { $set: { status: "active" } });
        const accessToken = jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET, { expiresIn: "1d" });
        res.json({
            message: "Account activated successfully!",
            accessToken,
            accessTokenExp: jwtUtils.accessTokenExp,
            user: {
                _id: user._id,
                username: user.username,
                email: user.email,
                fullName: user.fullName,
                phoneNumber: user.phoneNumber,
                dob: user.dob,
                address: user.address,
                roles: user.roles,
                userAvatar: user.userAvatar,
                status: "active",
                notifications: user.notifications,
                activities: user.activities,
                projects: user.projects,
                teams: user.teams
            }
        });

    } catch (error) {
        console.error(error);

        if (error.name === "TokenExpiredError") {
            return res.status(400).json({ message: "Activation link expired!" });
        }
        res.status(400).json({ message: "Something went wrong!" });
    }
};



const register = async (req, res) => {
    try {
        const accountInfo = await authService.register(req);
        res.status(accountInfo.status).json(accountInfo);
    } catch (error) {
        res.status(400).json({
            message: error.message
        });
    }
};
const login = async (req, res) => {
    try {
        const { email, password, type } = req.body;
        const accountInfo = await authService.login(email, password, type);
        res.status(accountInfo.status).json(accountInfo);
    } catch (error) {
        res.status(400).json({
            message: error.message
        });
    }
};


const loginByGoogle = (req, res, next) => {
  const redirectPath = req.query.redirect || "/home"; 
  passport.authenticate('google-user', {
    scope: ['email', 'profile'],
    state: encodeURIComponent(redirectPath),
  })(req, res, next);
};

const loginByGoogleAdmin = passport.authenticate('google-admin', { scope: ['email', 'profile'] });

const loginByGoogleCallbackUser = async (req, res, next) => {
    try {
        const googleUser = req.user._json;
        const redirectPath = req.user.redirectPath || "/home";

    // tao password random cho account dang ki bang Google
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()-_=+";
    let randomPassword = "";
    for (let i = 0; i < 10; i++) {
        const randomIndex = Math.floor(Math.random() * charset.length);
        randomPassword += charset[randomIndex];
    }
    const hashedPassword = await bcryptUtils.encryptPassword(randomPassword, 10);

    // du lieu user
    const user = {
        username: googleUser.name,
        email: googleUser.email,
        password: hashedPassword,
        fullName: googleUser.given_name,
        avatar: googleUser.picture,
        googleId: googleUser.sub
    }
    // console.log(user);

    // check user co ton tai trong database
    const isUserExist = await db.User.findOne({ email: user.email });
    // user de gui len frontend
    let accessToken;
    if (!isUserExist) {
        // user chua ton tai -> tao account moi trong database
        const newUser = new db.User({
          email: googleUser.email,
          password: hashedPassword,
          fullName: `${googleUser.given_name} ${googleUser.family_name}`,
          phoneNumber: null,
          address: null,
          roles: ["user"],
          avatar: googleUser.picture ,
          bio: null,
          background: null,
          warningCount: 0,
          teams: [],
          googleId: googleUser.sub,
          status: "active",
        });
        const newlyCreatedUser = await newUser.save();
        accessToken = jwtUtils.generateAccessToken(newlyCreatedUser._id);
        const refreshToken = jwtUtils.generateRefreshToken(newlyCreatedUser._id);
        await redisUtils.setRefreshToken(newlyCreatedUser._id, refreshToken, jwtUtils.refreshTokenExp);
    }else{
         // user da ton tai va la tk dang ki bang google -> dang nhap
        if(isUserExist.googleId !== null){
            if(isUserExist.roles.includes('user')){
                accessToken = jwtUtils.generateAccessToken(isUserExist._id);
                const refreshToken = jwtUtils.generateRefreshToken(isUserExist._id);
                await redisUtils.setRefreshToken(isUserExist._id, refreshToken, jwtUtils.refreshTokenExp);
            }else{
                const newError = new Error(
                  "Chỉ có thể đăng nhập bằng tài khoản quản trị viên có quyền người dùng"
                );
                newError.status = 403;
                throw newError;
            }

        }else{
            const newError =  new Error("Tài khoản đã đăng kí bằng cách thông thường! Hãy đăng nhập bằng email và mật khẩu")
            newError.status = 403;
            throw newError;
        }
    }


    // gui thong tin len frontend qua http only cookie
    res.cookie("accessToken", accessToken, {
        maxAge: jwtUtils.accessTokenExp*1000,
        httpOnly: true,
        sameSite: "lax"
    })
     res.redirect(`${process.env.FE_URL_USER}/login?isLoginByGoogle=true&redirect=${encodeURIComponent(redirectPath)}`);
    } catch (error) {
        console.log(error.message)
        res.redirect(`${process.env.FE_URL_USER}/login?isLoginByGoogle=false&message=`+ error.message);
    }
    
};

const loginByGoogleCallbackAdmin = async (req, res, next) => {
    try {
        const googleUser = req.user._json;


    // tao password random cho account dang ki bang Google
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()-_=+";
    let randomPassword = "";
    for (let i = 0; i < 10; i++) {
        const randomIndex = Math.floor(Math.random() * charset.length);
        randomPassword += charset[randomIndex];
    }
    const hashedPassword = await bcryptUtils.encryptPassword(randomPassword, 10);

    // du lieu user
    const user = {
        username: googleUser.name,
        email: googleUser.email,
        password: hashedPassword,
        fullName: googleUser.given_name,
        avatar: googleUser.picture,
        googleId: googleUser.sub
    }
    console.log(googleUser);

    // check user co ton tai trong database
    const isUserExist = await db.User.findOne({ email: user.email });
    console.log(isUserExist)
    // user de gui len frontend
    let accessToken;
    if (!isUserExist) {
        const newError =  new Error("Tài khoản không tồn tại")
        newError.status = 403;
        throw newError;
    }else{
         // user da ton tai va la tk dang ki bang google -> dang nhap
        if(isUserExist.googleId !== null){
            if(isUserExist.roles.includes('admin')){
                accessToken = jwtUtils.generateAccessToken(isUserExist._id);
                const refreshToken = jwtUtils.generateRefreshToken(isUserExist._id);
                await redisUtils.setRefreshToken(isUserExist._id, refreshToken, jwtUtils.refreshTokenExp);
            }else{
                const newError = new Error(
                  "Không thể đăng nhập bằng tài khoản người dùng thông thường"
                );
                newError.status = 403;
                throw newError;
            }
            
        }else{
            const newError =  new Error("Tài khoản đã đăng kí bằng cách thông thường! Hãy đăng nhập bằng email và mật khẩu")
            newError.status = 403;
            throw newError;
        }
    }


    // gui thong tin len frontend qua http only cookie
    res.cookie("accessToken", accessToken, {
        maxAge: jwtUtils.accessTokenExp*1000,
        httpOnly: true,
        sameSite: "lax"
    })
    res.redirect(`${process.env.FE_URL_ADMIN}/login?isLoginByGoogle=true`);
    } catch (error) {
        console.log(error.message)
        res.redirect(`${process.env.FE_URL_ADMIN}/login?isLoginByGoogle=false&message=`+ error.message);
    }
    
};


const getUserByAccessToken = async (req, res, next) => {
    try {
        const user = await authService.getUserByAccessToken(req.cookies.accessToken);
        res.status(200).json({
            message: "Get user by access token successfully !",
            user: user,
            accessToken: req.cookies.accessToken
        })
    } catch (error) {
        res.status(Number(error.status) || 400).json({
          message: error.message,
          status: Number(error.status) || 400,
          token: error.token,
        });
    }
}


const getRefreshToken = async (req, res) => {
    try {
        // lay refresh token theo user id
        const refreshToken = await authService.getRefreshToken(req.body.id);
        res.status(200).json(refreshToken);
    } catch (error) {
        res.status(400).json({ 
            message: error.message 
        });
    }
}

const refreshAccessToken = async (req, res) => {
    try {
        // lay access token moi dua tren refresh token va user id
        const result = await authService.refreshAccessToken(req, res);
        res.status(200).json(result);
    } catch (error) {
        res.status(400).json({ 
            message: error.message 
        });
    }
}

const logout = async (req, res) => {
    try {
        // xoa refresh token trong redis
        await authService.logout(req.body.id);
        res.status(200).json({ message: "Thoát đăng nhập thành công!" });
    } catch (error) {
        res.status(400).json({ 
            message: error.message 
        });
    }
}

const checkLoginStatus = async (req, res) => {
    try {
        res.status(200).json({ message: "Checked!" });
    } catch (error) {
        res.status(400).json({ 
            message: error.message 
        });
    }
}

const AuthController = {
    forgotPassword,
    resetPassword, logout,
    sendActivationEmail,
    verifyAccount,
    login,
    register,
    loginByGoogleCallbackUser,
    loginByGoogleCallbackAdmin,
    getUserByAccessToken,
    loginByGoogle,
    loginByGoogleAdmin,
    getRefreshToken,
    refreshAccessToken,
    checkLoginStatus,
}

module.exports = AuthController
