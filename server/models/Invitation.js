const mongoose = require("mongoose");

const invitationSchema = new mongoose.Schema(
  {
    visitorName: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },

    mobile: {
      type: String,
      trim: true,
    },

    companyName: {
      type: String,
      trim: true,
    },

    purposeOfVisit: {
      type: String,
      trim: true,
    },

    visitDate: {
      type: String,
      required: true,
    },

    visitTime: {
      type: String,
      required: true,
    },

    branch: {
      type: String,
      required: true,
    },

    numberOfVisitors: {
      type: Number,
      default: 1,
    },

    notes: {
      type: String,
      trim: true,
    },

    tokenHash: {
      type: String,
      required: true,
      unique: true,
    },

    expiresAt: {
      type: Date,
      required: true,
    },

    status: {
      type: String,
      enum: [
        "PENDING",
        "APPROVED",
        "REJECTED",
        "EXPIRED",
        "USED",
      ],
      default: "PENDING",
    },

    used: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

const Invitation = mongoose.model(
  "Invitation",
  invitationSchema
);

module.exports = Invitation;
