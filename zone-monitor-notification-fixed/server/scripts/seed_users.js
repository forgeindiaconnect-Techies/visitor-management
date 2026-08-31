const dns = require('dns');
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config();

const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

async function seed() {
  const MONGO_URI = process.env.MONGO_URI;
  if (!MONGO_URI) {
    console.error('❌ MONGO_URI not found in environment!');
    process.exit(1);
  }

  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected successfully to MongoDB.');

  const User = require('../models/User');
  const Company = require('../models/Company');

  // 1. Create or ensure SYSTEM company exists
  const expiry = new Date();
  expiry.setFullYear(expiry.getFullYear() + 50);

  let systemCompany = await Company.findOne({ code: 'SYSTEM' });
  if (!systemCompany) {
    systemCompany = await Company.create({
      name: 'SaaS Platform Management',
      code: 'SYSTEM',
      subscription: 'Enterprise',
      status: 'Active',
      subscriptionExpiresAt: expiry
    });
    console.log('✅ Created SYSTEM company.');
  }

  // 2. Create or ensure FIC001 default demo company exists
  let defaultCompany = await Company.findOne({ code: 'FIC001' });
  if (!defaultCompany) {
    defaultCompany = await Company.create({
      name: 'Forge India Connect',
      code: 'FIC001',
      subscription: 'Enterprise',
      status: 'Active',
      subscriptionExpiresAt: expiry
    });
    console.log('✅ Created default FIC001 company.');
  }

  // 3. Create SaaS Super Admin
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('admin123', salt);

  const saasUser = await User.findOneAndUpdate(
    { email: 'saas@fic.com' },
    {
      companyId: 'SYSTEM',
      name: 'SaaS Super Admin',
      email: 'saas@fic.com',
      password: passwordHash,
      plainPassword: 'admin123',
      role: 'SaaS Super Admin',
      status: 'Active',
      isActive: true,
      branchId: 'All Branches',
      mobileNumber: '9999999999'
    },
    { upsert: true, new: true }
  );
  console.log('✅ SaaS Super Admin created/updated:');
  console.log('   Email:    saas@fic.com');
  console.log('   Password: admin123');
  console.log('   Role:     SaaS Super Admin');

  // 4. Create Company Super Admin
  await User.findOneAndUpdate(
    { email: 'admin@fic.com' },
    {
      companyId: 'FIC001',
      name: 'Super Admin',
      email: 'admin@fic.com',
      password: passwordHash,
      plainPassword: 'admin123',
      role: 'Super Admin',
      status: 'Active',
      isActive: true,
      branchId: 'All Branches',
      mobileNumber: '8888888888'
    },
    { upsert: true, new: true }
  );
  console.log('✅ Company Super Admin created/updated:');
  console.log('   Email:    admin@fic.com');
  console.log('   Password: admin123');
  console.log('   Role:     Super Admin');

  console.log('\n🎉 Database seeding complete!');
  await mongoose.disconnect();
  process.exit(0);
}

seed().catch(err => {
  console.error('❌ Seeding error:', err);
  process.exit(1);
});
