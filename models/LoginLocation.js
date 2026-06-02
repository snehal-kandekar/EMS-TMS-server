const mongoose = require("mongoose");

const loginLocationSchema = new mongoose.Schema({

 employeeId: String,
  employeeName: String,
//  employee: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: "User",
//     required: true,
//   },

  latitude: Number,
  longitude: Number,
  address: String,

  loginTime: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model(
  "LoginLocation",
  loginLocationSchema
);