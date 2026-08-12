const mongoose = require("mongoose");

const preBookingSchema = new mongoose.Schema(
  {
    visitorId: {
      type: String,
      unique: true,
      required: true,
    },

    fullName: {
      type: String,
      required: true,
      trim: true,
    },

    mobileNumber: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
    },

    visitingCompany: {
      type: String,
      trim: true,
    },

    hostEmployee: {
      type: String,
      required: true,
    },

    visitPurpose: {
      type: String,
      required: true,
    },

    visitDate: {
      type: Date,
      required: true,
    },

    expectedTime: {
      type: String,
      required: true,
    },

    branchLocation: {
      type: String,
      required: true,
    },

    vehicleNumber: {
      type: String,
      trim: true,
    },

    facePhoto: {
      type: String,
      required: true,
    },

    status: {
      type: String,
      enum: [
        "PENDING",
        "APPROVED",
        "REJECTED",
        "CHECKED_IN",
        "CHECKED_OUT",
        "Pending",
        "Approved",
        "Rejected",
        "Checked In",
        "Checked Out",
        "Pre-Booked"
      ],
      default: "PENDING",
    },

    qrToken: {
      type: String,
      unique: true,
      sparse: true,
    },

    checkInTime: {
      type: Date,
      default: null,
    },

    checkOutTime: {
      type: Date,
      default: null,
    },

    checkInBy: {
      type: String,
      default: null,
    },

    checkOutBy: {
      type: String,
      default: null,
    },

    checkOutNotes: {
      type: String,
      default: null,
    },

    exitNotes: {
      type: String,
      default: "",
      trim: true,
    },

    approvedAt: {
      type: Date,
      default: null,
    },

    rejectedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("PreBooking", preBookingSchema);
