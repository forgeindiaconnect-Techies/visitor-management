const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  companyId: {
    type: String,
    required: true,
    index: true
  },
  companyName: {
    type: String
  },
  userId: {
    type: String
  },
  userName: {
    type: String,
    required: true
  },
  role: {
    type: String,
    required: true
  },
  action: {
    type: String,
    required: true
  },
  module: {
    type: String,
    required: true
  },
  description: {
    type: String
  },
  ipAddress: {
    type: String
  },
  deviceInfo: {
    type: String
  },
  status: {
    type: String,
    default: 'Success'
  }
}, { timestamps: true });

module.exports = mongoose.model('AuditLog', auditLogSchema);