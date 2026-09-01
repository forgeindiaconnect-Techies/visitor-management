const mongoose = require('mongoose');

const saasLeadSchema = new mongoose.Schema({
  companyName: {
    type: String,
    required: true
  },
  contactPerson: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    lowercase: true
  },
  mobileNumber: {
    type: String,
    required: true
  },
  expectedBranches: {
    type: Number,
    default: 1
  },
  expectedEmployees: {
    type: Number,
    default: 1
  },
  message: String,
  status: {
    type: String,
    enum: [
      'New',
      'Contacted',
      'Demo Scheduled',
      'Negotiation',
      'Won',
      'Lost'
    ],
    default: 'New'
  },
  convertedCompanyId: {
    type: String,
    default: null
  },
  logoUrl: {
    type: String,
    default: ''
  },
  notes: {
    type: String,
    default: ''
  },
  followUpAt: {
    type: Date,
    default: null
  },
  lastContactedAt: {
    type: Date,
    default: null
  },
  communicationHistory: [{
    subject: String,
    message: String,
    sentAt: {
      type: Date,
      default: Date.now
    },
    sentBy: String
  }]
}, { timestamps: true });

module.exports = mongoose.model('SaasLead', saasLeadSchema);
