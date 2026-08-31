require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const Company = require('./models/Company');

async function run() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected');

    let systemCompany = await Company.findOne({ code: 'SYSTEM' });
    if (!systemCompany) {
      console.log('Seeding SYSTEM company...');
      const expiry = new Date();
      expiry.setFullYear(expiry.getFullYear() + 50); // 50 years

      systemCompany = new Company({
        name: 'SaaS Platform Management',
        code: 'SYSTEM',
        subscription: 'Enterprise',
        status: 'Active',
        subscriptionExpiresAt: expiry
      });
      await systemCompany.save();
      console.log('✅ SYSTEM company seeded successfully');
    } else {
      console.log('SYSTEM company already exists');
    }
    process.exit(0);
  } catch (err) {
    console.error('Error seeding SYSTEM company:', err);
    process.exit(1);
  }
}

run();
