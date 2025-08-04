const mongoose = require("mongoose");

const consentFormSchema = new mongoose.Schema(
  { 
    title: {
      type: String,
      required: true,
      trim: true,
    },
    adopter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    shelter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shelter",
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    pet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pet",
      required: true,
    },
    commitments: {
      type: String,
      required: true,
    },
    tokenMoney: {
      type: Number,
      default: 0,
      min: 0,
    },
    deliveryMethod: {
      type: String,
      enum: ["pickup", "delivery"],
      default: "pickup",
    },
    note: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
      required:true
    },
    status: {
      type: String,
      enum: ["draft", "send", "accepted", "approved", "cancelled", "rejected"],
      default: "draft",
    },
    attachments: [
      {
        fileName: { type: String, required: true },
        url: { type: String, required: true },
        size: { type: Number },
        mimeType: { type: String },
        createAt: { type: Date, default: Date.now },
        updateAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

const ConsentForm = mongoose.model("ConsentForm", consentFormSchema);
module.exports = ConsentForm;
