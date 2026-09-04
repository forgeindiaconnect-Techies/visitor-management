const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const Company = require('../models/Company');
const User = require('../models/User');

async function activate() {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/zone-monitor';
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);

    const expiryDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days active

    const company = await Company.findOneAndUpdate(
      { code: 'AGI123' },
      { 
        status: 'Active',
        subscription: 'Basic',
        subscriptionExpiresAt: expiryDate
      },
      { new: true }
    );

    if (company) {
      console.log(`✅ Company ${company.name} (${company.code}) activated! Plan: ${company.subscription}, Expires: ${company.subscriptionExpiresAt}`);
    } else {
      console.log('Company AGI123 not found.');
    }

    process.exit(0);
  } catch (err) {
    console.error('Error activating company:', err);
    process.exit(1);
  }
}

activate();
