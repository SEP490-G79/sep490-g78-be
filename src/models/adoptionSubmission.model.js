const mongoose = require("mongoose");

const adoptionSubmissionSchema = new mongoose.Schema(
  {
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    adoptionForm: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AdoptionForm",
      required: true,
    },
    answers: [
      {
        questionId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Question",
          required: true,
        },
        selections: [
          {
            type: String,
          },
        ],
      },
    ],
    interview: {
      interviewId: {
        type: mongoose.Schema.Types.ObjectId,
        default: () => new mongoose.Types.ObjectId(),
      },
      availableFrom: {
        type: Date,
        validate: [
          {
            validator: function (v) {
              return !this.availableTo || v < this.availableTo;
            },
            message: "Thời gian bắt đầu phải trước thời gian kết thúc.",
          },
        
        ],
      },
      availableTo: {
        type: Date,
        validate: [
          {
            validator: function (v) {
              return !this.availableFrom || v > this.availableFrom;
            },
            message: "Thời gian kết thúc phải sau thời gian bắt đầu.",
          },
          {
            validator: function (v) {
              return !this.createdAt || v > this.createdAt;
            },
            message: "Thời gian kết thúc phải sau ngày tạo lịch phỏng vấn.",
          },
        ],
      },
      selectedSchedule: {
        type: Date,
      },
      scheduleAt: {
        type: Date,
      },
      method: {
        type: String,
      },
      feedback: {
        type: String,
      },
      performedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      note: {
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

    adoptionsLastMonth: {
      type: Number,
      default: 0,
    },
    total: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["pending", "scheduling", "interviewing", "approved", "rejected", "reviewed"],
      default: "pending",
    },
  },
  { timestamps: true }
);

const AdoptionSubmission = mongoose.model(
  "AdoptionSubmission",
  adoptionSubmissionSchema
);
module.exports = AdoptionSubmission;
