const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config();

const mongoose = require('mongoose');
const Plan = require('../models/Plan');

const defaultPlans = [
  {
    name: 'One Day Trial',
    price: 0,
    durationDays: 1,
    visitorPasses: 25,
    branches: 1,
    users: 3,
    securityUsers: 1,
    admins: 1,
    reports: false,
    description: 'Try the essential visitor management features for 24 hours.',
    features: {
      qrPass: true,
      preBooking: true,
      emailNotifications: true,
      advancedReports: false,
      customBranding: false,
      apiAccess: false,
      prioritySupport: false
    },
    isActive: true
  },

  {
    name: 'Basic',
    price: 1999,
    durationDays: 30,
    visitorPasses: 500,
    branches: 1,
    users: 10,
    securityUsers: 5,
    admins: 2,
    reports: true,
    description: 'Suitable for small companies with one branch.',
    features: {
      qrPass: true,
      preBooking: true,
      emailNotifications: true,
      advancedReports: false,
      customBranding: false,
      apiAccess: false,
      prioritySupport: false
    },
    isActive: true
  },

  {
    name: 'Standard',
    price: 4999,
    durationDays: 30,
    visitorPasses: 3000,
    branches: 5,
    users: 50,
    securityUsers: 25,
    admins: 10,
    reports: true,
    description: 'Advanced reporting and branding for growing companies.',
    features: {
      qrPass: true,
      preBooking: true,
      emailNotifications: true,
      advancedReports: true,
      customBranding: true,
      apiAccess: false,
      prioritySupport: false
    },
    isActive: true
  },

  {
    name: 'Enterprise',
    price: 9999,
    durationDays: 30,
    visitorPasses: -1,
    branches: -1,
    users: -1,
    securityUsers: -1,
    admins: -1,
    reports: true,
    description: 'Unlimited usage with API access and priority support.',
    features: {
      qrPass: true,
      preBooking: true,
      emailNotifications: true,
      advancedReports: true,
      customBranding: true,
      apiAccess: true,
      prioritySupport: true
    },
    isActive: true
  }
];

const seedPlans = async () => {
  try {
    const mongoUri =
      process.env.MONGODB_URI ||
      process.env.MONGO_URI;

    if (!mongoUri) {
      throw new Error(
        'MongoDB connection URL is missing.'
      );
    }

    await mongoose.connect(mongoUri);

    for (const plan of defaultPlans) {
      await Plan.updateOne(
        { name: plan.name },
        {
          // Only create missing plans.
          // Existing SaaS Admin changes are preserved.
          $setOnInsert: {
            ...plan,
            updatedBy: 'Initial Setup'
          }
        },
        { upsert: true }
      );
    }

    console.log('Default plans created successfully.');
  } catch (error) {
    console.error(
      'Failed to create plans:',
      error.message
    );
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

seedPlans();
