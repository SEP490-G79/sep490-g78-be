const mongoose = require("mongoose");

const speciesSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      max: [100, "Tên loài chỉ cho phép tối đa 100 ký tự"],
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      max: [1000, "Miêu tả chỉ cho phép tối đa 1000 ký tự"],
      trim: true,
    },
  },
  { timestamps: true } // tự động tạo createAt và updateAt
);

const Species = mongoose.model("Species", speciesSchema);
module.exports = Species;
