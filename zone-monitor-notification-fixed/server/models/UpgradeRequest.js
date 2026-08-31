const mongoose = require('mongoose');

const upgradeRequestSchema = new mongoose.Schema(
  {
    companyId: {
      type: String,
      required: true,
      index: true
    },
    companyName: {
      type: String,
      required: true
    },
    requestedPlan: {
      type: String,
      required: true,
      enum: ['Basic', 'Standard', 'Professional', 'Enterprise', 'One Day Trial']
    },
    amount: {
      type: Number,
      required: true
    },
    durationDays: {
      type: Number,
      required: true
    },
    status: {
      type: String,
      enum: ['Pending', 'Approved', 'Rejected'],
      default: 'Pending'
    },
    requestedBy: {
      type: String
    },
    processedBy: {
      type: String
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('UpgradeRequest', upgradeRequestSchema);
