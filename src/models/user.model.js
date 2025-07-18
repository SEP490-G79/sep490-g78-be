const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    password: {
      type: String,
      required: function () {
        return !this.googleId;
      },
      minlength: 8,
      validate: {
        validator: function (value) {
          return !/\s/.test(value);
        },
        message: "Password không được chứa khoảng trắng!",
      },
    },
    googleId: {
      type: String,
      sparse: true,
    },
    fullName: {
      type: String,
      minLength: 6,
      match: /^[a-zA-ZÀ-Ỹà-ỹ\s]+$/,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      match: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/,
    },
    avatar: {
      type: String,
      default:
        "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRTgD14vQ6I-UBiHTcwxZYnpSfLFJ2fclwS2A&s",
    },
    bio: {
      type: String,
    },
    dob: {
      type: Date,
      validate: {
        validator: function (value) {
          return value <= new Date();
        },
        message: "Ngày sinh không được lớn hơn ngày hiện tại!",
      },
      default: null,
    },
    phoneNumber: {
      type: String,
      match: /^(0[3|5|7|8|9])+([0-9]{8})$/,
    },
    background: {
      type: String,
      default: "",
    },
    address: {
      type: String,
    },
    location: {
      lat: {
        type: Number,
        default: 0,
      },
      lng: {
        type: Number,
        default: 0,
      },
    },
    roles: [
      {
        type: String,
        enum: ["admin", "user"],
        default: "user",
      },
    ],
    wishList: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Pet",
      },
    ],
    status: {
      type: String,
      enum: ["verifying", "active", "banned"],
      default: "verifying",
    },
    notifications: [
      {
        _id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "notification",
        },
        isSeen: {
          type: Boolean,
          default: false,
        },
      },
    ],
    warningCount: {
      type: Number,
      default: 0,
      min: 0,
      //warningCount = 3 => status = "banned",
    },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);
module.exports = User;
