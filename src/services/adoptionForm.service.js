const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../models/index");

async function getFormsByShelter(shelterId) {
  try {
    const forms = await db.AdoptionForm.find({ shelter: shelterId })
      .populate("pet", "_id name petCode")
      .populate("questions")
      .populate("createdBy", "fullName email avatar")
      .populate("shelter", "name")
      .lean();
    return forms?.map((form) => {
      return {
        ...form,
        shelter: form?.shelter?.name,
      };
    });
  } catch (error) {
    throw error;
  }
}

async function createForm(shelterId, petId, formData, createdBy) {
  try {
    const shelter = await db.Shelter.findOne({
      _id: shelterId,
      status: "active",
    });
    if (!shelter) {
      throw new Error("Không tìm thấy trung tâm");
    }

    const pet = await db.Pet.findOne({ _id: petId, status: "unavailable" });
    if (!pet) {
      throw new Error("Pet not found");
    }

    const newForm = new db.AdoptionForm({
      shelter: shelterId,
      pet: petId,
      title: formData.title,
      description: formData.description,
      questions: formData.questions || [],
      createdBy,
    });

    if (!formData.title) {
      throw new Error("Tiêu đề là bắt buộc");
    }

    const savedForm = await newForm.save();
    const populatedForm = await db.AdoptionForm.findById(savedForm._id)
      .populate("pet", "_id name petCode")
      .populate("questions")
      .populate("createdBy", "fullName email avatar")
      .populate("shelter", "name")
      .lean();
    if (!populatedForm) {
      throw new Error("Lỗi không tìm thấy form đã tạo");
    }
    return {
      ...populatedForm,
      shelter: populatedForm?.shelter?.name,
    };
  } catch (error) {
    throw error;
  }
}

async function editForm(formId, formData) {
  try {
    const form = await db.AdoptionForm.findById(formId);
    if (!form) {
      throw new Error("Không tìm thấy form");
    }
    if (form.status != "draft") {
      throw new Error("Chỉ có thể chỉnh sửa form ở trạng thái nháp");
    }
    const updateForm = await db.AdoptionForm.findOneAndUpdate(
      { _id: formId },
      formData,
      { new: true }
    )
      .populate("pet", "_id name petCode")
      .populate("questions")
      .populate("createdBy", "fullName email avatar")
      .lean();

    if (!updateForm) {
      throw new Error("Lỗi không tìm thấy form đã cập nhật");
    }

    return {
      ...updateForm,
      shelter: updateForm?.shelter?.name,
    };
  } catch (error) {
    throw error;
  }
}

async function changeFormStatus(formId, formData) {
  try {
    const updateForm = await db.AdoptionForm.findByIdAndUpdate(
      formId,
      { status: formData.status },
      { new: true }
    );
    if (!updateForm)
      throw new Error(
        "Lỗi khi cập nhập trạng thái form hoặc form không tồn tại!"
      );

    if (!updateForm.status || !["draft", "active"].includes(updateForm.status)) {
      throw new Error("Trạng thái form không hợp lệ!");
    }

    const petUpdate = await db.Pet.findOneAndUpdate(
      { _id: updateForm.pet._id, status: { $ne: "adopted" } },
      { status: formData.status == "active" ? "available" : "unavailable" },
      { new: true }
    );
    if (!petUpdate) {
      await db.AdoptionForm.findByIdAndUpdate(formId, { status: form.status });
      throw new Error("Lỗi khi cập nhập trạng thái thú nuôi!");
    }

    return updateForm;
  } catch (err) {
    throw err;
  }
}

async function deleteForm(formId) {
  try {
    const formExists = await db.AdoptionForm.findById(formId);
    if (!formExists) {
      throw new Error("Không tìm thấy form!");
    }
    if (formExists.status == "draft") {
      await db.AdoptionForm.findByIdAndDelete(formId);
    } else {
      throw new Error("Không thể xóa form!");
    }
    return "Xóa form thành công!";
  } catch (error) {
    throw error;
  }
}

// get form by petId
async function getFormsByPetId(petId) {
  try {
    const form = await db.AdoptionForm.findOne({ pet: petId, status: "active" })
      .populate("pet")
      .populate("createdBy", "fullName email avatar")
      .populate("shelter", "name")
      .populate("questions")
      .lean();

    return {
      ...form,
      shelter: form?.shelter?.name,
    };
  } catch (error) {
    throw error;
  }
}

const adoptionFormService = {
  getFormsByShelter,
  createForm,
  editForm,
  changeFormStatus,
  deleteForm,
  getFormsByPetId,
};

module.exports = adoptionFormService;
