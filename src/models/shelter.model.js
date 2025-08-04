const mongoose = require("mongoose");

const shelterSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Tên trạm cứu hộ là bắt buộc"],
      trim: true,
    },
    shelterCode: {
      type: String,
      required: [true, "Mã trạm cứu hộ là bắt buộc"],
      min: [3, "Mã trạm phải có ít nhất 3 kí tự"],
      unique: true,
    },
    bio: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email là bắt buộc"],
      unique: true,
      match: [/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/, "Email không hợp lệ"],
    },
    hotline: {
      type: String,
      required: [true, "Hotline là bắt buộc"],
      match: [/^((\+84)|0)(3|5|7|8|9)\d{8}$/, "Hotline không đúng định dạng số điện thoại Việt Nam"]
    },
    avatar: {
      type: String,
      default: "https://res.cloudinary.com/dpaht6o2y/image/upload/v1753884169/0265e65863c0d910bf1553816c432275_qfl6nk.jpg",
    },
    address: {
      type: String,
      required: true,
      trim: true,
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
    background: {
      type: String,
      default:
        "https://res.cloudinary.com/dpaht6o2y/image/upload/v1753884183/279dcca3f058ad75a2f3d256799c4634_zt7z3j.jpg",
    },
    members: [
      {
        _id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: [true, "Thành viên cần có ID người dùng"],
        },
        roles: [
          {
            type: String,
            enum: {
              values: ["manager", "staff"],
              message: "Vai trò chỉ có thể là 'manager' hoặc 'staff'",
            },
            default: "staff",
            required: [true, "Vai trò của thành viên là bắt buộc"],
          },
        ],
      },
    ],
    invitations: [
      {
        _id: {
          type: mongoose.Schema.Types.ObjectId,
          default: () => new mongoose.Types.ObjectId(),
        },
        shelter: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Shelter",
          required: [true, "Trạm cứu hộ không thể trống"],
        },
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: [true, "User không thể trống"],
        },
        type: {
          type: String,
          enum: ["invitation", "request"]
        },
        roles: [{
          type: String,
          required: [true, "Người nhận lời mời phải được gắn ít nhất 1 vai trò"],
        }],
        status: {
          type: String,
          enum: {
            values: ["pending", "accepted", "declined", "expired", "cancelled"],
            message: "Trạng thái lời mời không hợp lệ",
          },
          default: "pending",
        },
        expireAt: {
          type: Date,
          default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
        updatedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    shelterLicense: {
      fileName: {
        type: String,
        required: [true, "Tên file giấy phép là bắt buộc"],
      },
      url: {
        type: String,
        required: [true, "Đường dẫn file giấy phép là bắt buộc"],
      },
      size: {
        type: Number,
      },
      mimeType: {
        type: String,
      },
      createAt: {
        type: Date,
        default: Date.now,
      },
      updateAt: {
        type: Date,
        default: Date.now,
      },
    },
    foundationDate: {
      type: Date,
      required: [true, "Ngày thành lập là bắt buộc"],
    },
    aspiration: {
      type: String,
      required: [true, "Nguyện vọng thành lập là bắt buộc"],
    },
    rejectReason: {
      type: String,
    },
    status: {
      type: String,
      enum: {
        values: ["verifying", "active", "banned", "rejected", "cancelled"],
        message: "Trạng thái không hợp lệ",
      },
      default: "verifying",
    },
    warningCount: {
      type: Number,
      default: 0,
      min: [0, "Số cảnh báo không thể âm"],
    },
  },
  { timestamps: true }
);

const Shelter = mongoose.model("Shelter", shelterSchema);
module.exports = Shelter;
