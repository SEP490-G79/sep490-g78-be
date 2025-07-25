const { Shelter } = require("../models");

const isShelterManager = async (req, res, next) => {
  try {
    const { id } = req.payload; // id của người dùng
    const { shelterId } = req.params;

    const shelter = await Shelter.findById(shelterId);
    if (!shelter) {
      return res.status(404).json({ message: "Không tìm thấy trạm cứu hộ!" });
    }

    const isManager = shelter.members.some(
      (member) =>
        member._id.toString() === id && member.roles.includes("manager")
    );

    if (isManager) {
      return next();
    } else {
      throw new Error("Tài khoản không phải là quản lý của trạm cứu hộ");
    }
  } catch (error) {
    next(error);
  }
};

const isShelterMember = async (req, res, next) => {
  try {
    const { id } = req.payload; // id của người dùng
    const { shelterId } = req.params;
    const shelter = await Shelter.findById(shelterId);
    if (!shelter) {
      return res.status(404).json({ message: "Không tìm thấy trạm cứu hộ!" });
    }

    const isMember = shelter.members.some(
      (member) => member._id.toString() === id
    );

    if (isMember) {
      return next();
    } else {
      throw new Error("Tài khoản không phải là quản lý của trạm cứu hộ");
    }
  } catch (error) {
    next(error);
  }
};

const isShelterStaff = async (req, res, next) => {
  try {
    const { id } = req.payload; // id của người dùng
    const { shelterId } = req.params;

    const shelter = await Shelter.findById(shelterId);
    if (!shelter) {
      return res.status(404).json({ message: "Không tìm thấy trạm cứu hộ!" });
    }

    const isManager = shelter.members.some(
      (member) => member._id.toString() === id && member.roles.includes("staff")
    );

    if (isManager) {
      return next();
    } else {
      throw new Error("Tài khoản không phải là staff của trạm cứu hộ");
    }
  } catch (error) {
    next(error);
  }
};

const shelterMiddleware = {
  isShelterMember,
  isShelterStaff,
  isShelterManager,
};

module.exports = shelterMiddleware;
