const mongoose = require('mongoose');

const subscriptionUsageSchema = new mongoose.Schema(
  {
    companyId: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true
    },

    plan: {
      type: String,
      required: true,
      enum: ['One Day Trial', 'Basic', 'Standard', 'Enterprise']
    },

    cycleStart: {
      type: Date,
      required: true
    },

    cycleEnd: {
      type: Date,
      required: true
    },

    visitorPassesUsed: {
      type: Number,
      default: 0,
      min: 0
    },

    lastPassGeneratedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// One usage record per company for each subscription cycle.
subscriptionUsageSchema.index(
  {
    companyId: 1,
    cycleStart: 1,
    cycleEnd: 1
  },
  {
    unique: true
  }
);

module.exports = mongoose.model(
  'SubscriptionUsage',
  subscriptionUsageSchema
);
