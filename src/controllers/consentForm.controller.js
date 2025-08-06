const db = require("../models");
const { consentFormService } = require("../services");
const fs = require("fs/promises");

async function getByShelter(req, res, next) {
  const { shelterId } = req.params;
  const selectedShelter = await db.Shelter.findOne({
    _id: shelterId,
    status: "active",
  });
  if (!selectedShelter) {
    return res
      .status(404)
      .json({ message: "Trung tâm không tồn tại hoặc không hoạt động" });
  }
  try {
    const consentForms = await consentFormService.getByShelter(shelterId);
    res.status(200).json(consentForms);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

async function getByUser(req, res, next) {
  const { id } = req.payload;
  const selectedUser = await db.User.findOne({
    _id: id,
    status: "active",
  });
  if (!selectedUser) {
    return res
      .status(404)
      .json({ message: "Người dùng không tồn tại hoặc không hoạt động" });
  }
  try {
    const consentForms = await consentFormService.getByUser(id);
    res.status(200).json(consentForms);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

async function getById(req, res, next) {
  const { consentFormId } = req.params;
  try {
    const consentForm = await consentFormService.getById(consentFormId);
    if (!consentForm) {
      return res
        .status(404)
        .json({ message: "Không tìm thấy bản đồng ý nhận nuôi!" });
    }
    res.status(200).json(consentForm);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

async function createForm(req, res, next) {
  const { shelterId } = req.params;
  const { id } = req.payload;
  const {
    title,
    commitments,
    tokenMoney,
    deliveryMethod,
    note,
    address,
    petId,
    adopterId,
  } = req.body;

  const attachments = req.files ||[];

  if (attachments.length > 2) {
    return res.status(400).json({
      message: "Không thể tải lên quá 2 tệp đính kèm.",
    });
  }

  const selectedShelter = await db.Shelter.findOne({
    _id: shelterId,
    status: "active",
  });
  if (!selectedShelter) {
    return res
      .status(404)
      .json({ message: "Trung tâm không tồn tại hoặc không hoạt động" });
  }
  const selectedPet = await db.Pet.findOne({
    _id: petId,
    status: "available",
  });
  if (!selectedPet) {
    return res.status(404).json({ message: "Thú cưng không khả dụng" });
  }
  if (
    !commitments ||
    commitments.trim() == "" ||
    deliveryMethod == "" ||
    !address
  ) {
    return res.status(400).json({ message: "Vui lòng điền đầy đủ thông tin" });
  }
  if (
    deliveryMethod.toLowerCase() != "pickup" &&
    deliveryMethod.toLowerCase() != "delivery"
  ) {
    return res
      .status(400)
      .json({ message: "Phương thức giao hàng không hợp lệ" });
  }

  if (!adopterId) {
    return res
      .status(400)
      .json({ message: "Vui lòng cung cấp người nhận nuôi" });
  }
  const selectedAdopter = await db.User.findOne({
    _id: adopterId,
    status: "active",
  });
  if (!selectedAdopter) {
    return res
      .status(404)
      .json({ message: "Người nhận nuôi không tồn tại hoặc không hoạt động" });
  }

  try {
    const newConsentForm = await consentFormService.createForm({
      title,
      shelter: shelterId,
      pet: petId,
      adopter: adopterId,
      commitments,
      tokenMoney,
      attachments,
      deliveryMethod,
      note,
      address,
      createdBy: id,
    });

    res.status(201).json(newConsentForm);
  } catch (error) {
    if (req.files?.length) {
      await Promise.allSettled(
        req.files.map((file) => fs.unlink(file.path).catch(() => {}))
      );
    }
    res.status(400).json({ message: error.message });
  }
}

async function editForm(req, res, next) {
  const { consentFormId } = req.params;
  const { title, commitments, tokenMoney, deliveryMethod, note, address } = req.body;
  const attachments = req.files ||[];

  if (attachments.length > 2) {
    return res.status(400).json({
      message: "Không thể tải lên quá 2 tệp đính kèm.",
    });
  }

  if (!title || !commitments || commitments.trim() == "" || deliveryMethod == "" || !address) {
    return res.status(400).json({ message: "Vui lòng điền đầy đủ thông tin" });
  }

  if (deliveryMethod.toLowerCase() != "pickup" && deliveryMethod.toLowerCase() != "delivery") {
    return res
      .status(400)
      .json({ message: "Phương thức giao hàng không hợp lệ" });
  }
  

  try {
    const updatedConsentForm = await consentFormService.editForm(
      consentFormId,
      {
        title,
        commitments,
        tokenMoney,
        deliveryMethod,
        note,
        attachments,
        address,
      }
    );
    res.status(200).json(updatedConsentForm);
  } catch (error) {
    if (req.files?.length) {
      await Promise.allSettled(
        req.files.map((file) => fs.unlink(file.path).catch(() => {}))
      );
    }
    res.status(400).json({ message: error.message });
  }
}

async function changeFormStatusShelter(req, res, next) {
  const { consentFormId } = req.params;
  const { status } = req.body;

  if (!["draft", "send", "approved"].includes(status)) {
    return res.status(400).json({ message: "Trạng thái không hợp lệ" });
  }

  try {
    const updatedConsentForm = await consentFormService.changeFormStatusShelter(
      consentFormId,
      status
    );
    res.status(200).json(updatedConsentForm);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}


async function changeFormStatusUser(req, res, next) {
  const { consentFormId } = req.params;
  const { id } = req.payload;
  const { status, note } = req.body;

  
  

  if (!["accepted", "cancelled", "rejected"].includes(status)) {
    return res.status(400).json({ message: "Trạng thái không hợp lệ" });
  }

  try {
    const updatedConsentForm = await consentFormService.changeFormStatusUser(
      consentFormId,
      status,
      note,
      id
    );
    res.status(200).json(updatedConsentForm);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

async function deleteForm(req, res, next) {
  const { consentFormId } = req.params;

  try {
    const deletedConsentForm = await consentFormService.deleteForm(
      consentFormId
    );
    res.status(200).json(deletedConsentForm);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

const consentFormController = {
  getByShelter,
  getByUser,
  getById,
  createForm,
  editForm,
  changeFormStatusShelter,
  changeFormStatusUser,
  deleteForm,
};

module.exports = consentFormController;
