const mongoose = require('mongoose');

const companySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },

  code: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true
  },

  subscription: {
    type: String,
    enum: ['One Day Trial', 'Basic', 'Standard', 'Enterprise'],
    default: 'Basic'
  },

  status: {
    type: String,
    enum: ['Active', 'Inactive', 'Suspended', 'Expired'],
    default: 'Active'
  },

  branding: {
    logoUrl: {
      type: String,
      default: ''
    },
    primaryColor: {
      type: String,
      default: '#1E1B6E'
    }
  },

  approvalRoles: {
    type: [String],
    default: ['Super Admin', 'MD', 'Senior HR', 'IT']
  },

  subscriptionExpiresAt: {
    type: Date,
    required: true
  },

  // Controls features available to this company
  features: {
    preBookingEnabled: {
      type: Boolean,
      default: true
    }
  },

  upgradeHistory: [{
    plan: String,
    startDate: Date,
    endDate: Date,
    updatedBy: String,
    date: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Transform _id to id in JSON responses
companySchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: function (doc, ret) {
    delete ret._id;
  }
});

module.exports = mongoose.model('Company', companySchema);
