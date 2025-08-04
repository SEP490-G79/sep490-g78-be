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
      return res.status(401).json({ message: "Tài khoản không phải là quản lý của trạm cứu hộ" });
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
      return res.status(401).json({ message: "Tài khoản không phải là thành viên của trạm cứu hộ" });
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

    const isStaff = shelter.members.some(
      (member) => member._id.toString() === id && member.roles.includes("staff")
    );

    if (isStaff) {
      return next();
    } else {
      return res.status(401).json({ message: "Tài khoản không phải là staff của trạm cứu hộ" });
    }
  } catch (error) {
    next(error);
  }
};


const isNotShelterMember = async (req, res, next) => {
  try {
    const { id } = req.payload; 
    const { shelterId } = req.params;

    const shelter = await Shelter.findById(shelterId);
    if (!shelter) {
      return res.status(404).json({ message: "Không tìm thấy trạm cứu hộ!" });
    }

    const isMember = shelter.members.some(
      (member) => member._id.toString() === id
    );

    if (isMember) {
      return res.status(400).json({
        message: "Bạn là thành viên của trạm cúu hộ này, bạn không thể gửi yêu cầu nhận nuôi cho trạm cúu hộ này",
      });
    }

    return next();
  } catch (error) {
    next(error);
  }
};


const shelterMiddleware = {
  isShelterMember,
  isShelterStaff,
  isShelterManager,
  isNotShelterMember
};

module.exports = shelterMiddleware;
