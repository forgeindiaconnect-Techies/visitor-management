const mongoose = require('mongoose');

const securityAttendanceSchema = new mongoose.Schema(
  {
    companyId: {
      type: String,
      required: true,
      default: 'FIC001',
      index: true
    },
    attendanceId: {
      type: String,
      required: true,
      unique: true,
    },
    securityId: {
      type: String,
      required: true,
    },
    securityName: {
      type: String,
      required: true,
    },
    branch: {
      type: String,
      required: true,
    },
    date: {
      type: String,
      required: true,
    },
    checkInTime: {
      type: String,
    },
    checkInPhoto: {
      type: String, // Base64 image
    },
    checkOutTime: {
      type: String,
    },
    checkOutPhoto: {
      type: String, // Base64 image
    },
    workingHours: {
      type: String,
    },
    attendanceStatus: {
      type: String,
      enum: ['Present', 'Auto Checked-Out', 'Check-In Closed', 'Completed'],
      default: 'Present',
    },
    checkInLocation: {
      type: Object, // { lat: Number, lng: Number }
    },
    checkOutLocation: {
      type: Object,
    },
    autoCheckout: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true,
  }
);

// Ensure a user can only have one attendance record per day
securityAttendanceSchema.index({ securityId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('SecurityAttendance', securityAttendanceSchema);
