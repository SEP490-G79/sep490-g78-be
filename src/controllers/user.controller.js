const userService = require("../services/user.service");
const fs = require("fs/promises");

const getAllUsers = async (req, res) => {
  try {
    const users = await userService.getAllUsers();
    res.status(200).json(users);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const getUserById = async (req, res) => {
  try {
    const user = await userService.getUserById(req.params.userId);
    res.status(200).json(user);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const getUserByToken = async (req, res) => {
  try {
    const user = await userService.getUserById(req.payload.id);
    res.status(200).json(user);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const changePassword = async (req, res) => {
  const { oldPassword, newPassword, confirmPassword } = req.body;
  try {
    const result = await userService.changePassword(
      req.payload.id,
      oldPassword,
      newPassword,
      confirmPassword
    );
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const editProfile = async (req, res) => {
  try {
    // console.log("Req body:", req.body);
    // console.log("Req files:", req.files);
    const profileData = req.body;
    const result = await userService.editProfile(
      req.payload.id,
      profileData,
      req.files
    );
    res.status(200).json(result);
  } catch (error) {
    const { avatar, background } = req.files || {};
    if (avatar?.length) {
      await fs.unlink(avatar[0].path).catch(() => {});
    }
    if (background?.length) {
      await fs.unlink(background[0].path).catch(() => {});
    }
    console.error("Lỗi khi cập nhật thông tin:", error.message);
    res.status(400).json({ message: error.message });
  }
};

const wishListPet = async (req, res) => {
  try {
    const userId = req.payload.id;
    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }
    const { petId } = req.params;
    if (!petId) {
      return res.status(400).json({ message: "Pet ID is required" });
    }
    const result = await userService.wishListPet(userId, petId);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};



// ADMIN
const getUsersList = async (req, res) => {
  try {
    const users = await userService.getAllUsers();
    const formattedOutput = users.map(user => {
      return {
        _id: user._id,
      avatar: user.avatar,
      fullName: user.fullName || null,
      email: user.email,
      roles: user.roles,
      status: user.status,
      phoneNumber: user.phoneNumber,
      warningCount: user.warningCount,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    }})
    res.status(200).json({
      status: 200,
      usersList: formattedOutput
    });
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
};
const addUser = async (req, res) => {
  try {
    const userData = req.body;
    const newUser = await userService.addUser(userData);
    res.status(201).json(newUser);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

const changeUserRole = async (req, res) => {
  const { userId } = req.params;
  const roles = req.body.roles;
  try {
    const updatedUser = await userService.changeUserRole(userId, roles);
    res.status(200).json(updatedUser);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const banUser = async (req, res) => {
  const { userId } = req.params;
  try {
    const updatedUser = await userService.banUser(userId);
    res.status(200).json(updatedUser);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const unbanUser = async (req, res) => {
  const { userId } = req.params;
  try {
    const updatedUser = await userService.unbanUser(userId);
    res.status(200).json(updatedUser);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const userController = {
  //USER
  getAllUsers,
  getUserById,
  changePassword,
  editProfile,
  getUserByToken,
  wishListPet,

  //ADMIN
  getUsersList,
  addUser,
  changeUserRole,
  banUser,
  unbanUser,
};

module.exports = userController;
