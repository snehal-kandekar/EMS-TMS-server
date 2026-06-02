const mongoose = require("mongoose");

const taskWorkLogSchema = new mongoose.Schema(
  {
    tasks: [{
      task: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Task",
        required: true,
      },
      startTime: {
        type: String,
        required: true,
      },
      endTime: {
        type: String,
        required: true,
      },
      totalHours: {
        type: Number,
        required: true,
      },
      status: {
        type: String,
        enum: ["Submitted", "In Progress", "Pending", "Approved", "Rejected"],
        default: "Pending",
      },
      progressToday: {
        type: Number,
        min: 0,
        max: 100,
        required: function() {
          return this.status === "In Progress";
        },
      },
    }],

    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    date: {
      type: Date,
      required: true,
    },

    challengesFaced: {
      type: String,
    },

    whatLearnedToday: {
      type: String,
    },

    remarks: {
      type: String,
    },
    
    rating: {
      type: Number,
      min: 1,
      max: 5,
      default: null,
    },
    
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    approvedAt: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model("TaskWorkLog", taskWorkLogSchema);