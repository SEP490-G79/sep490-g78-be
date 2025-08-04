const mongoose = require("mongoose");

const adoptionFormSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    pet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pet",
      required: true,
    },
    description: {
      type: String,
      trim: true,
    },
    questions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Question",
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    shelter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shelter",
      required: true,
    },
    status: {
      type: String,
      enum: ["draft", "active","archived"],
      default: "draft",
    },
  },
  { timestamps: true }
);

const AdoptionForm = mongoose.model("AdoptionForm", adoptionFormSchema);
module.exports = AdoptionForm;
