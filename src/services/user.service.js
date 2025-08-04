const db = require("../models/");
const bcrypt = require("bcrypt");
const { cloudinary } = require("../configs/cloudinary");
const fs = require("fs/promises");

const getAllUsers = async () => {
  try {
    const users = await db.User.find();
    return users;
  } catch (error) {
    throw error;
  }
};

const getUserById = async (userId) => {
  try {
    const user = await db.User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }
    const result = {
      _id: user._id || null,
      username: user.username || null,
      fullName: user.fullName || null,
      email: user.email || null,
      avatar: user.avatar || null,
      bio: user.bio || null,
      dob: user.dob || null,
      phoneNumber: user.phoneNumber || null,
      address: user.address || null,
      background: user.background || null,
      wishList: user.wishList || null,
      googleId: user.googleId || null,
      roles: user.roles || null,
      status: user.status || null,
      location: user.location || null,
      warningCount: user.warningCount || 0,
      createdAt: user.createdAt || null,
      updatedAt: user.updatedAt || null,
    };
    return result;
  } catch (error) {
    throw error;
  }
};

const changePassword = async (
  userId,
  oldPassword,
  newPassword,
  confirmPassword
) => {
  try {
    const user = await db.User.findById(userId);
    if (!user) throw new Error("Không tìm thấy người dùng");
    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) throw new Error("Mật khẩu cũ không chính xác");
    if (newPassword == "" || confirmPassword == "")
      throw new Error("Mật khẩu mới và xác nhận mật khẩu không được để trống");
    if (newPassword !== confirmPassword)
      throw new Error("Mật khẩu mới và xác nhận mật khẩu không khớp");
    if (newPassword.length < 8)
      throw new Error("Mật khẩu mới phải có ít nhất 8 ký tự");
    if (/\s/.test(newPassword))
      throw new Error("Mật khẩu mới không được chứa khoảng trắng");
    const isNewPasswordSameAsOld = await bcrypt.compare(
      newPassword,
      user.password
    );
    if (isNewPasswordSameAsOld)
      throw new Error("Mật khẩu mới không được trùng với mật khẩu cũ");
    if (!/[A-Z]/.test(newPassword) || !/\d/.test(newPassword))
      throw new Error(
        "Mật khẩu mới phải chứa ít nhất một chữ hoa và một chữ số"
      );

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.User.findByIdAndUpdate(userId, {
      password: hashedPassword,
    });
    return { message: "Đổi mật khẩu thành công" };
  } catch (error) {
    throw error;
  }
};

const editProfile = async (userId, profileData, files) => {
  try {
    const user = await db.User.findById(userId);
    if (!user) throw new Error("Không tìm thấy người dùng");

    // Parse location
    let parsedLocation = user.location;
    if (profileData.location) {
      try {
        parsedLocation = JSON.parse(profileData.location);
        if (
          typeof parsedLocation.lat !== "number" ||
          typeof parsedLocation.lng !== "number"
        ) {
          throw new Error("Location không hợp lệ!");
        }
      } catch (err) {
        console.error("Không thể parse location:", err);
        throw new Error("Dữ liệu location gửi lên không hợp lệ!");
      }
    }

    // Xử lý ảnh đại diện và ảnh nền
    let newAvatar = user.avatar;
    let newBackground = user.background;

    // Xử lý ảnh avatar 
    if (files?.avatar?.length > 0) {
      const avatarFile = files.avatar[0];
      try {
        const uploadResult = await cloudinary.uploader.upload(avatarFile.path, {
          folder: "user_profiles",
          resource_type: "image",
        });
        newAvatar = uploadResult.secure_url;
        await fs.unlink(avatarFile.path);
      } catch (error) {
        console.error("Cloudinary Upload Error (Avatar):", error);
        await fs.unlink(avatarFile.path).catch(() => {});
        throw new Error("Lỗi khi tải lên ảnh đại diện. Vui lòng thử lại.");
      }
    }

    // Xử lý ảnh background
    if (files?.background?.length > 0) {
      const backgroundFile = files.background[0];
      try {
        const uploadResult = await cloudinary.uploader.upload(
          backgroundFile.path,
          {
            folder: "user_profiles",
            resource_type: "image",
          }
        );
        newBackground = uploadResult.secure_url;
        await fs.unlink(backgroundFile.path);
      } catch (error) {
        console.error("Cloudinary Upload Error (Background):", error);
        await fs.unlink(backgroundFile.path).catch(() => {});
        throw new Error("Lỗi khi tải lên ảnh nền. Vui lòng thử lại.");
      }
    }

    // Validate dữ liệu đầu vào
    if (
      !profileData.fullName &&
      !profileData.bio &&
      !profileData.dob &&
      !profileData.phoneNumber &&
      !profileData.address &&
      !parsedLocation
    ) {
      throw new Error("Hãy điền thông tin để cập nhật hồ sơ của bạn");
    }

    // Validate họ tên
    if (profileData.fullName) {
      const fullName = profileData.fullName.trim();
      if (fullName.length < 2 || fullName.length > 50) {
        throw new Error("Họ và tên phải từ 2 đến 50 ký tự.");
      }
      const nameParts = fullName.split(/\s+/);
      if (nameParts.length < 2) {
        throw new Error("Họ và tên phải bao gồm ít nhất 2 từ (họ và tên).");
      }
      const nameRegex = /^[A-ZÀ-Ỹ][a-zà-ỹ]+(?:\s[A-ZÀ-Ỹ][a-zà-ỹ]+)+$/u;
      if (!nameRegex.test(fullName)) {
        throw new Error(
          "Họ và tên không hợp lệ. Mỗi từ nên viết hoa đầu, không chứa số/ký tự đặc biệt."
        );
      }
    }

    // Validate tiểu sử (bio)
    if (profileData.bio) {
      const wordCount = profileData.bio.trim().split(/\s+/).length;
      if (wordCount > 300) {
        throw new Error("Tiểu sử không được vượt quá 300 từ.");
      }
    }

    // Validate số điện thoại
    if (
      profileData.phoneNumber &&
      !/^(0[0-9])+([0-9]{8})$/.test(profileData.phoneNumber)
    ) {
      throw new Error(
        "Số điện thoại không hợp lệ. Phải bắt đầu bằng 0 và có 10 số."
      );
    }

    // Validate ngày sinh
    if (profileData.dob) {
      const dob = new Date(profileData.dob);
      const today = new Date();
      const age = today.getFullYear() - dob.getFullYear();
      const hasBirthdayPassed =
        today.getMonth() > dob.getMonth() ||
        (today.getMonth() === dob.getMonth() &&
          today.getDate() >= dob.getDate());
      const exactAge = hasBirthdayPassed ? age : age - 1;
      if (exactAge < 16) {
        throw new Error("Ngày sinh không hợp lệ. Bạn phải đủ 16 tuổi trở lên");
      }
    }

    const newProfile = {
      fullName: profileData.fullName || user.fullName,
      bio: profileData.bio || user.bio,
      dob: profileData.dob ? new Date(profileData.dob) : user.dob,
      phoneNumber: profileData.phoneNumber || user.phoneNumber,
      address: profileData.address || user.address,
      location: parsedLocation,
      avatar: newAvatar,
      background: newBackground,
    };

    const updatedUser = await db.User.findByIdAndUpdate(
      userId,
      { $set: newProfile },
      { new: true }
    );

    return updatedUser;
  } catch (error) {
    console.error("Lỗi khi cập nhật thông tin:", error.message);
    throw error;
  }
};

const wishListPet = async (userId, petId) => {
  try {
    const user = await db.User.findById(userId);
    const pet = await db.Pet.findById(petId);

    if (!user) throw new Error("Không tìm thấy người dùng");
    if (!pet) throw new Error("Không tìm thấy thú cưng");

    const isWished = user.wishList.includes(petId);

    let message = "";
    if (isWished) {
      user.wishList.pull(petId);
      message = "Đã xoá khỏi danh sách yêu thích";
    } else {
      user.wishList.push(petId);
      message = "Đã thêm vào danh sách yêu thích";
    }

    await user.save();

    return {
      message,
      isWished: !isWished,
      wishList: user.wishList,
    };
  } catch (error) {
    throw new Error("Lỗi khi cập nhật wishlist: " + error.message);
  }
};

//ADMIN
const addUser = async (data) => {
  try {
    const userData = {
      fullName: data.fullName,
      email: data.email,
      password: await bcrypt.hash(data.password, 10),
      roles: data.roles || ["user"],
      status: "active",
      googleId: null,
    };
    const newUser = await db.User.create(userData);
    return {
      message: "User added successfully",
      user: {
        id: newUser._id,
        fullName: newUser.fullName,
        email: newUser.email,
        avatar: newUser.avatar,
        roles: newUser.roles,
        status: newUser.status,
        createdAt: newUser.createdAt,
        updatedAt: newUser.updatedAt,
      },
    };
  } catch (error) {
    throw new Error("Error adding user: " + error.message);
  }
};

const changeUserRole = async (userId, roles) => {
  try {
    const user = await db.User.findById(userId);
    if (!user) {
      throw new Error("Không tìm thấy tài khoản!");
    }
    if (roles.length < 1) {
      throw new Error("Mỗi tài khoản phải có ít nhất 1 vai trò");
    }
    const updatedUser = await db.User.findByIdAndUpdate(
      userId,
      { roles: roles },
      { new: true }
    );
    return {
      message: "Thay đổi vai trò tài khoản thành công",
      user: {
        id: updatedUser._id,
        fullName: updatedUser.fullName,
        email: updatedUser.email,
        avatar: updatedUser.avatar,
        roles: updatedUser.roles,
        status: updatedUser.status,
        createdAt: updatedUser.createdAt,
        updatedAt: updatedUser.updatedAt,
      },
    };
  } catch (error) {
    throw new Error("Error changing user role: " + error.message);
  }
};

const banUser = async (userId) => {
  try {
    const user = await db.User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }
    const updatedUser = await db.User.findByIdAndUpdate(
      userId,
      { status: "banned" },
      { new: true }
    );
    return {
      message: "User banned successfully",
      user: {
        id: updatedUser._id,
        fullName: updatedUser.fullName,
        email: updatedUser.email,
        avatar: updatedUser.avatar,
        roles: updatedUser.roles,
        status: updatedUser.status,
        createdAt: updatedUser.createdAt,
        updatedAt: updatedUser.updatedAt,
      },
    };
  } catch (error) {
    throw new Error("Error banning user: " + error.message);
  }
};

const unbanUser = async (userId) => {
  try {
    const user = await db.User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }
    const updatedUser = await db.User.findByIdAndUpdate(
      userId,
      { status: "active", warningCount: 2 },
      { new: true }
    );
    return {
      message: "User unbanned successfully",
      user: {
        id: updatedUser._id,
        fullName: updatedUser.fullName,
        email: updatedUser.email,
        avatar: updatedUser.avatar,
        roles: updatedUser.roles,
        status: updatedUser.status,
        createdAt: updatedUser.createdAt,
        updatedAt: updatedUser.updatedAt,
      },
    };
  } catch (error) {
    throw new Error("Error unbanning user: " + error.message);
  }
};

const userService = {
  //USER
  getAllUsers,
  getUserById,
  changePassword,
  editProfile,
  wishListPet,

  //ADMIN
  addUser,
  changeUserRole,
  banUser,
  unbanUser,
};

module.exports = userService;
