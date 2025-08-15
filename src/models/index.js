const mongoose = require("mongoose");
const User = require("./user.model");
const AdoptionForm = require("./adoptionForm.model");
const AdoptionSubmission = require("./adoptionSubmission.model");
const AdoptionTemplate = require("./adoptionTemplate.model");
const Blog = require("./blog.model");
const Breed = require("./breed.model");
const Comment = require("./comment.model");
const ConsentForm = require("./consentForm.model");
const Conversation = require("./conversation.model");
const Donation = require("./donation.model");
const MedicalRecord = require("./medicalRecord.model");
const Message = require("./message.model");
const Notification = require("./notification.model");
const Pet = require("./pet.model");
const Post = require("./post.model");
const Question = require("./question.model");
const Report = require("./report.model");
const ReturnRequest = require("./returnRequest.model");
const Shelter = require("./shelter.model");
const Species = require("./species.model");

const db = {
  User,
  AdoptionForm,
  AdoptionSubmission,
  AdoptionTemplate,
  Blog,
  Breed,
  Comment,
  ConsentForm,
  Conversation,
  Donation,
  MedicalRecord,
  Message,
  Notification,
  Pet,
  Post,
  Question,
  Report,
  ReturnRequest,
  Shelter,
  Species,
};

db.connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Đã kết nối tới MongoDB");
  } catch (err) {
    console.error("Lỗi kết nối MongoDB:", err);
    process.exit(1); // Kết thúc quá trình nếu có lỗi
  }
};

module.exports = db;
