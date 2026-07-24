const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  companyId: {
    type: String,
    required: true,
    default: 'FIC001',
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  mobileNumber: {
    type: String,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  plainPassword: {
    type: String
  },
  role: {
    type: String,
    required: true,
    enum: ['SaaS Super Admin', 'Super Admin', 'Company Admin', 'Admin', 'MD', 'HR', 'Receptionist', 'Security Guard', 'Security', 'Employee', 'Visitor']
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive', 'Blocked'],
    default: 'Active'
  },
  statusReason: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  branchId: {
    type: String,
    required: true,
    default: 'All Branches'
  },
  branch: {
    type: String
  },
  fcmToken: {
    type: String,
    default: ""
  },
  createdBy: {
    type: String,
    default: 'System'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Transform _id to id in JSON response
userSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: function (doc, ret) {
    delete ret._id;
  }
});

module.exports = mongoose.model('User', userSchema);
