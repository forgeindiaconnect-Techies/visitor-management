const mongoose = require('mongoose');

const branchSettingSchema = new mongoose.Schema({
  companyId: {
    type: String,
    required: true,
    default: 'FIC001',
    index: true
  },
  branchName: {
    type: String,
    required: true
  },
  latitude: {
    type: Number,
    required: true
  },
  longitude: {
    type: Number,
    required: true
  },
  radius: {
    type: Number,
    default: 50 // meters
  },
  checkInStart: {
    type: String, // format "HH:mm"
    default: "09:00"
  },
  checkInEnd: {
    type: String, // format "HH:mm"
    default: "09:30"
  },
  checkOutTime: {
    type: String, // format "HH:mm"
    default: "20:00"
  }
}, { timestamps: true });

branchSettingSchema.index({ companyId: 1, branchName: 1 }, { unique: true });

module.exports = mongoose.model('BranchSetting', branchSettingSchema);
