const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const Plan = require('../models/Plan');
const Company = require('../models/Company');

async function check() {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/zone-monitor';
    console.log('Connecting to:', mongoUri);
    await mongoose.connect(mongoUri);
    
    const plans = await Plan.find({});
    console.log('=== PLANS IN DB ===');
    console.log(JSON.stringify(plans, null, 2));

    const companies = await Company.find({});
    console.log('=== COMPANIES IN DB ===');
    console.log(JSON.stringify(companies.map(c => ({
      name: c.name,
      code: c.code,
      status: c.status,
      subscription: c.subscription,
      subscriptionExpiresAt: c.subscriptionExpiresAt
    })), null, 2));

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

check();
