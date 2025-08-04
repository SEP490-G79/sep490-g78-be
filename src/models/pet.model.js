const mongoose = require("mongoose");

const petSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    petCode: {
      type: String,
      required: true,
      unique: true,
    },
    isMale: {
      type: Boolean,
      required: true,
    },
    age: {
      // Age in months
      type: Number,
      min: 0,
    },
    weight: {
      type: Number,
      min: 0,
      required: true,
    },
    identificationFeature: {
      type: String,
    },
    sterilizationStatus: {
      type: Boolean, // tinh trang triet san
    },
    species: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Species",
      required: true,
    },
    breeds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Breed",
      },
    ],
    color: {
      type: String,
      trim: true,
      required: true,
    },
    bio: {
      type: String,
    },
    intakeTime: {
      type: Date,
      default: Date.now,
    },
    photos: [
      {
        type: String,
        required: true,
        default: "https://res.cloudinary.com/dpaht6o2y/image/upload/v1753884243/871b475bfbb2cb2274f44a01cc02a18a_caazkd.jpg",
      },
    ],
    foundLocation: {
      type: String,
      trim: true,
    },
    tokenMoney: {
      type: Number,
      default: 0,
      min: 0,
    },
    shelter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shelter",
      required: true,
    },
    adopter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    status: {
      type: String,
      enum: [
        "unavailable",
        "available",
        "adopted",
        "disabled",
        "booking",
        "delivered",
      ],
      default: "unavailable",
    },
  },
  { timestamps: true }
);

const Pet = mongoose.model("Pet", petSchema);
module.exports = Pet;
