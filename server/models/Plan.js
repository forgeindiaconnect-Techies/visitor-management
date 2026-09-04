const mongoose = require('mongoose');

const planSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      enum: [
        'One Day Trial',
        'Basic',
        'Standard',
        'Enterprise'
      ],
      trim: true
    },

    price: {
      type: Number,
      required: true,
      min: 0
    },

    durationDays: {
      type: Number,
      required: true,
      min: 1
    },

    visitorPasses: {
      type: Number,
      required: true
    },

    branches: {
      type: Number,
      required: true
    },

    users: {
      type: Number,
      required: true
    },

    securityUsers: {
      type: Number,
      required: true
    },

    admins: {
      type: Number,
      required: true
    },

    reports: {
      type: Boolean,
      default: false
    },

    description: {
      type: String,
      default: ''
    },

    features: {
      qrPass: {
        type: Boolean,
        default: true
      },

      preBooking: {
        type: Boolean,
        default: true
      },

      emailNotifications: {
        type: Boolean,
        default: true
      },

      advancedReports: {
        type: Boolean,
        default: false
      },

      customBranding: {
        type: Boolean,
        default: false
      },

      apiAccess: {
        type: Boolean,
        default: false
      },

      prioritySupport: {
        type: Boolean,
        default: false
      }
    },

    isActive: {
      type: Boolean,
      default: true
    },

    updatedBy: {
      type: String,
      default: 'System'
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Plan', planSchema);
