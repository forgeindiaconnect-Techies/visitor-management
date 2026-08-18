const mongoose = require("mongoose");

const preBookingSchema = new mongoose.Schema(
  {
    visitorId: {
      type: String,
      unique: true,
      required: true,
    },
    trackingToken: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    trackingTokenExpiresAt: {
      type: Date,
      default: null,
    },

    bookingType: {
      type: String,
      default: "PRE_BOOKING",
      enum: ["PRE_BOOKING"]
    },

    activeBookingKey: {
      type: String,
      default: null,
      index: true
    },

    activeEmailLock: {
      type: String,
      default: null,
      index: { unique: true, sparse: true }
    },

    activeMobileLock: {
      type: String,
      default: null,
      index: { unique: true, sparse: true }
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
      match: [/^[6-9]\d{9}$/, "Please enter a valid 10-digit mobile number starting with 6, 7, 8, or 9"]
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

    idType: {
      type: String,
      trim: true,
    },

    idProofUrl: {
      type: String,
      trim: true,
    },

    assignedHr: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
      index: true,
    },

    facePhoto: {
      type: String,
      required: true,
    },

    visitorType: {
      type: String,
      enum: ["NORMAL", "NEW_VISITOR"],
      default: "NORMAL",
      index: true
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
  approvalStatus: {
    type: String,
    enum: [
      "PENDING",
      "APPROVED",
      "REJECTED",
      "DATE_CHANGED",
      "TIME_CHANGED",
      "CANCELLED",
      "CHECKED_IN",
      "CHECKED_OUT"
    ],
    default: "PENDING"
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
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    approvedByRole: {
      type: String,
      default: null
    },
    rejectedAt: {
      type: Date,
      default: null,
    },
    rejectionReason: {
      type: String,
      default: null
    },
    approvalDetails: {
      approvedBy: String,
      approvedByRole: String,
      approvedAt: Date,
      method: String
    },
    statusHistory: [{
      status: String,
      changedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      },
      changedByRole: String,
      changedAt: { type: Date, default: Date.now },
      reason: String
    }]
  },
  {
    timestamps: true,
  }
);

preBookingSchema.index(
  { activeBookingKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      activeBookingKey: { $type: "string" }
    }
  }
);

module.exports = mongoose.model("PreBooking", preBookingSchema);
