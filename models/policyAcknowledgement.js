const mongoose = require("mongoose");

const policyAcknowledgementSchema = new mongoose.Schema(
    {
        policyId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Policy",
            required: true,
        },
        employeeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Employee",
            required: true,
        },
        employeeName: {
            type: String,
            required: true,
        },
        acknowledgedAt: {
            type: Date,
            default: Date.now,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model(
    "PolicyAcknowledgement",
    policyAcknowledgementSchema
);