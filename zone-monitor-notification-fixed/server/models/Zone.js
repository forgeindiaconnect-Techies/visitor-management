const mongoose = require('mongoose');

const zoneSchema = new mongoose.Schema({
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
  branch: {
    type: String,
    required: true
  },
  type: {
    type: String,
    required: true
  },
  accessLevel: {
    type: String,
    required: true
  },
  description: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Active'
  },
  restricted: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Transform _id to id in JSON response
zoneSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: function (doc, ret) {
    delete ret._id;
  }
});

module.exports = mongoose.model('Zone', zoneSchema);
