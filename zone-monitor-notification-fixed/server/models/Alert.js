const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  companyId: {
    type: String,
    required: true,
    default: 'FIC001',
    index: true
  },
  visitId: { type: String, required: true },
  visitorName: { type: String, required: true },
  branch: { type: String, required: true },
  zoneName: { type: String, required: true },
  type: { type: String, default: 'Restricted Zone Violation' },
  message: { type: String, required: true },
  severity: { type: String, enum: ['Low', 'Medium', 'High', 'Critical'], default: 'High' },
  timestamp: { type: Date, default: Date.now },
  resolved: { type: Boolean, default: false },
  resolvedBy: { type: String },
  resolutionNotes: { type: String }
}, { timestamps: true });

alertSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: function (doc, ret) {
    delete ret._id;
  }
});

module.exports = mongoose.model('Alert', alertSchema);
