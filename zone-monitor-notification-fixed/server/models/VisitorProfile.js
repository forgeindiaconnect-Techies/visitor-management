const mongoose = require('mongoose');

const visitorProfileSchema = new mongoose.Schema({
  companyId: {
    type: String,
    required: true,
    default: 'FIC001',
    index: true
  },
  profileId: { type: String, required: true },
  mobileNumber: { type: String, required: true },
  visitorName: { type: String, required: true },
  email: { type: String },
  companyName: { type: String },
  photoUrl: { type: String }
}, { timestamps: true });

visitorProfileSchema.index({ companyId: 1, profileId: 1 }, { unique: true });
visitorProfileSchema.index({ companyId: 1, mobileNumber: 1 }, { unique: true });

visitorProfileSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: function (doc, ret) {
    delete ret._id;
  }
});

module.exports = mongoose.model('VisitorProfile', visitorProfileSchema);