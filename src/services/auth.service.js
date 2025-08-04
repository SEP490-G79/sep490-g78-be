
const jwt = require("jsonwebtoken");
const {User} = require("../models/");
const {bcryptUtils, jwtUtils, redisUtils} = require("../utils")
require("../middlewares/auth.middleware");
const mailer = require("../configs/mailer.config")
const bcrypt = require("bcrypt");


const register = async (req) => {
    const { fullName, email, password} = req.body;
    // console.log(req.body)
    const isEmailExisted = await User.findOne({email: email});
    if (isEmailExisted) {
        return {
            status: 400,
            message: "Email  đã tồn tại!"
        };
    }
    const hashedPassword = await bcryptUtils.encryptPassword(password, 10);
    const newUser = new User({
          email,
        password: hashedPassword,
        fullName: fullName,
        phoneNumber: null,
        address: null,
        roles: ["user"],
        avatar: "https://res.cloudinary.com/dpaht6o2y/image/upload/v1753883950/1aa8d75f3498784bcd2617b3e3d1e0c4_fvgwde.jpg",
        bio: null,
        background: "https://res.cloudinary.com/dpaht6o2y/image/upload/v1753884093/2746ae1e9f480a1a5c459355340449aa_zmqvf0.jpg",
        warningCount: 0,
        teams: [],
        googleId: null,
        status: "verifying",
    });
    await newUser.save();
    const activeToken = jwt.sign(
        { id: newUser._id, email: newUser.email },
        process.env.JWT_SECRET,
        { expiresIn: "15m" }
    )
    return {
        status: 200,
        message: "Đăng kí thành công!",
        account: newUser,
        activeToken: activeToken
     };
};


const login = async (email, password, type) => {
  const user = await User.findOne({ email: email });

  // console.log(usernameOrEmail, password)
  if (!user) {
    return {
      status: 400,
      message: "Email không tồn tại!",
    };
  }

  // check co phai account dk bang google
  if (user.googleId !== null) {
    return {
      status: 400,
      message:
        "Tài khoản đã đăng kí bằng Google! Làm ơn hãy đăng nhập bằng Google",
    };
  }

  const isMatch = await bcryptUtils.comparePassword(password, user.password);
  // console.log(isMatch)
  if (!isMatch) {
    return {
      status: 400,
      message: "Sai mật khẩu!",
    };
  }

  const validRole = user.roles.includes(type);
  if (!validRole) {
    return {
      status: 400,
      message: "Tài khoản không có quyền đăng nhập hệ thống!",
    };
  }


  // Nếu tài khoản chưa kích hoạt, gửi token về FE để kích hoạt
  if (user.status === "verifying") {
    const activeToken = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );
    return {
      status: 403,
      message: "Tài khoản chưa kích hoạt!...",
      activeToken,
    };
  }
  if (user.status === "banned") {
    return {
      status: 400,
      message: "Tài khoản đã bị khóa!",
    };
  }

  // accessToken
  const accessToken = jwtUtils.generateAccessToken(user._id);
  // refresh token
  const refreshToken = jwtUtils.generateRefreshToken(user._id);
  // luu vao trong redis
  await redisUtils.setRefreshToken(
    user._id,
    refreshToken,
    jwtUtils.refreshTokenExp
  );
  return {
    status: 200,
    message: "Đăng nhập thành công!",
    accessToken: accessToken,
    user: {
      userId: user._id,
      fullName: user.fullName,
      email: user.email,
      avatar: user.avatar,
      roles: user.roles,
      status: user.status,
    },
  };
};


const logout = async (userId) => {
    await redisUtils.deleteRefreshToken(userId);
    return {
        status: 200,
        message: "Thoát đăng nhập thành công!"
    };
}


const getRefreshToken = async (userId) => {
    const refreshToken = await redisUtils.getRefreshToken(userId);
    if (!refreshToken) {
        throw new Error("Refresh token not found!");
    }
    return refreshToken;
}

const getUserByAccessToken = async (accessToken) => {
    //decode access Token
    const decodedAccessToken = jwtUtils.decode(accessToken);

    // get user
    const user = await User.findById(decodedAccessToken.id).populate("roles");

    // Nếu tài khoản chưa kích hoạt, gửi token về FE để kích hoạt
  if (user.status === "verifying") {
    const token = jwt.sign(
        { id: user._id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: "10m" }
    );
    const error = new Error("Account not activated! Redirecting to activation page...");
    error.status = 403; 
    error.token = token;
    throw error;

    }
    return user;
}

const refreshAccessToken = async (req, res) => {
    // lay refresh token va user id
    const { refreshToken, id} = req.body;
    const user = await User.findById(id);

    // Xác thực refreshToken
    // console.log(refreshToken);
    const isValid = jwt.verify(refreshToken, process.env.REFRESH_JWT_SECRET);
    if (!isValid) {
        throw new Error("Refresh token is invalid!");
    }

    // Tạo accessToken mới
    const accessToken = jwtUtils.generateAccessToken(user._id);

    return {
        message: "Refresh access token successfully!",
        accessToken: accessToken,
    };
};


const forgotPassword = async (email) => {
  const user = await User.findOne({ email });
  if (!user) {
    throw new Error("Không tìm thấy tài khoản")
  }
  if(user.status === "banned"){
    throw new Error("Không thể đặt lại mật khẩu cho tài khoản đã bị ban")
  }
  if(user.googleId && user.googleId !== null){
    throw new Error("Không thể đặt lại mật khẩu cho tài khoản đăng kí bằng google")
  }
  // Tạo JWT token có thời hạn 10 phút
  const token = jwt.sign(
    { id: user._id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: "10m" }
  );
  // Gửi email mà không hiển thị token trong URL
  const link = `${process.env.FE_URL_USER}/forgot-password?tempToken=${token}`;
  const subject = "Yêu cầu đặt lại mật khẩu tài khoản";
const body = `
  <div style="font-family: Arial, sans-serif; padding: 20px;">
    <p>Xin chào,</p>
    <p>Chúng tôi đã nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn. Vui lòng nhấn nút bên dưới để tiếp tục:</p>
    <a href="${link}" style="display: inline-block; padding: 10px 20px; color: #fff; background: #1890ff; text-decoration: none; border-radius: 5px;">
      Đặt lại mật khẩu
    </a>
    <p style="margin-top: 20px;">Liên kết này có hiệu lực trong vòng 10 phút.</p>
    <p>Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.</p>
    <p>Trân trọng,<br />PawShelter</p>
  </div>
`;

  await mailer.sendEmail(email, subject, body);
  return { message: "Đã gửi email, vui lòng check inbox để đặt lại mật khẩu!", token }
};

const resetPassword = async (password, confirmPassword, token) => {
  console.log(password, confirmPassword, token)
  if (!token) {
    throw new Error("Thiếu token đặt lại mật khẩu")
  }

  if(!typeof password === "string" || password.trim().length < 8){
    throw new Error("Mật khẩu ít nhất phải chứa 8 kí tự và không có khoảng trống")
  }
    // Kiểm tra mật khẩu nhập lại
  if (password !== confirmPassword) {
    throw new Error("Mật khẩu nhập lại không khớp")
  }

  // Giải mã token JWT
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      throw new Error("Liên kết đặt lại mật khẩu đã hết hạn. Vui lòng yêu cầu lại.");
    }
    throw new Error("Token không hợp lệ.");
  }

  // Tìm user theo ID từ token
  const user = await User.findById(decoded.id);
  if (!user) {
    throw new Error("Tài khoản không tồn tại trong hệ thống!")
  }
  if(user.status === "banned"){
    throw new Error("Không thể đặt lại mật khẩu của tài khoản bị ban!")
  }
  // Hash mật khẩu mới
  const encryptedPassword = await bcrypt.hash(password, 10);

  // Cập nhật mật khẩu mới vào database
  await User.updateOne(
    { _id: decoded.id },
    { $set: { password: encryptedPassword } }
  );

  return {
    message: "Thay đổi mật khẩu thành công",
  };
};


const authService = {
    login,
    register,
    getUserByAccessToken,
    getRefreshToken,
    refreshAccessToken,logout,
    forgotPassword,
    resetPassword,
}

module.exports = authService;