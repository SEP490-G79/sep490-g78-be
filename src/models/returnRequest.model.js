const mongoose = require("mongoose");

const returnRequestSchema = new mongoose.Schema(
  {
    shelter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shelter",
      required: true,
    },
    pet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pet",
      required: true,
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    photos: [
      {
        type: String,
      },
    ],
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    rejectReason: {
      type: String,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "cancelled"],
      default: "pending",
    },
  },
  { timestamps: true } 
);

const ReturnRequest = mongoose.model("ReturnRequest", returnRequestSchema);
module.exports = ReturnRequest;
