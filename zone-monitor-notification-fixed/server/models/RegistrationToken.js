const mongoose = require('mongoose');

const registrationTokenSchema = new mongoose.Schema(
  {
    token: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    companyId: {
      type: String,
      required: true,
      index: true
    },
    visitorName: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true,
      index: true
    },
    mobileNumber: {
      type: String
    },
    companyName: {
      type: String,
      default: 'Forge India Connect Private Limited'
    },
    purpose: {
      type: String,
      default: 'Business Visit'
    },
    visitDate: {
      type: String
    },
    visitTime: {
      type: String
    },
    branch: {
      type: String,
      default: 'Head Office(KRISHNAGIRI)'
    },
    visitorCount: {
      type: Number,
      default: 1
    },
    notes: {
      type: String
    },
    dob: {
      type: String
    },
    hostEmployee: {
      type: String
    },
    expiresAt: {
      type: Date,
      required: true
    },
    used: {
      type: Boolean,
      default: false
    },
    cancelled: {
      type: Boolean,
      default: false
    },
    status: {
      type: String,
      enum: ['Pending Invitation', 'Invitation Sent', 'Registration Pending', 'Registered', 'Visitor Pass Generated', 'Completed', 'Cancelled', 'Expired'],
      default: 'Pending Invitation'
    },
    visitorId: {
      type: String
    },
    bookingId: {
      type: String
    },
    createdBy: {
      type: String
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('RegistrationToken', registrationTokenSchema);
