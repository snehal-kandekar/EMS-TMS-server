const mongoose = require("mongoose");

const leaveSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  leaveType: { type: String, enum: ["SL", "CL", "LWP"], required: true }, // Sick / Casual
  dateTo: { type: Date, required: true },
  dateFrom: { type: Date, required: true },
  duration: { type: String, enum: ["full", "half"], default: "full" },
  reportingManager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    // required: true,
  },
  reason: { type: String, required: true },
  status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
  appliedAt: { type: Date, default: Date.now },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  approvedByRole: {
    type: String,
    enum: ["manager", "admin", "Team_Leader", "hr", "ceo", "coo", "md"]
  },//rutuja 07-04-26
  //approvedByName: { type: String }, // save approver name
  isSandwich: { type: Boolean, default: false }, // 👈 new field
  totalDays: { type: Number, default: 0 },
  paidDays: { type: Number, default: 0 },
  lwpDays: { type: Number, default: 0 },
groupId: { type: String, default: null },

actionReason: {
  type: String,
  trim: true,
  maxlength: 200,
},

isMerged: {type: Boolean,default: false}
});

module.exports = mongoose.model("Leave", leaveSchema);
