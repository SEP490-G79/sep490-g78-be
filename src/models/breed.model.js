const mongoose = require("mongoose");

const breedSchema = new mongoose.Schema(
  {
    species: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Species",
      required: true,
    },
    name: {
      type: String,
      required: true,
      max: [100, "Tên giống chỉ cho phép tối đa 100 ký tự"],
      trim: true,
    },
    description: {
      type: String,
      max: [1000, "Miêu tả chỉ cho phép tối đa 1000 ký tự"],
      trim: true,
    },
  },
  { timestamps: true }
);

const Breed = mongoose.model("Breed", breedSchema);
module.exports = Breed;
