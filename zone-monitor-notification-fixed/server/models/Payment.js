const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  companyId: {
    type: String,
    required: true,
    ref: 'Company'
  },
  companyName: {
    type: String,
    required: true
  },
  plan: {
    type: String,
    required: true
  },
  invoiceNo: {
    type: String,
    unique: true,
    sparse: true
  },
  paymentId: {
    type: String
  },
  orderId: {
    type: String
  },
  signature: {
    type: String
  },
  amount: {
    type: Number,
    required: true
  },
  gst: {
    type: Number,
    default: 0
  },
  total: {
    type: Number,
    required: true
  },
  paymentDate: {
    type: Date,
    default: Date.now
  },
  expiryDate: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['Paid', 'Pending', 'Failed', 'Created'],
    default: 'Created'
  },
  durationDays: {
    type: Number,
    required: true
  },
  processedBy: {
    type: String,
    required: true
  }
}, { timestamps: true });

module.exports = mongoose.model('Payment', paymentSchema);
