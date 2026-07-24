/**
 * Script to reactivate the FIC Admin account in MongoDB.
 * Run: node server/scripts/reactivate-admin.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI;

async function reactivateAdmin() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGO_URI);
  console.log('Connected.');

  const User = require('../models/User');

  // Find the account
  const user = await User.findOne({ email: 'info@forgeindiaconnect.com' });
  if (!user) {
    console.log('User info@forgeindiaconnect.com NOT found. Listing all users...');
    const all = await User.find({}, 'email role isActive status companyId').lean();
    console.table(all);
  } else {
    console.log('Found user:', user.email, '| isActive:', user.isActive, '| status:', user.status, '| role:', user.role);
    user.isActive = true;
    user.status = 'Active';
    await user.save();
    console.log('Account reactivated successfully!');
  }

  await mongoose.disconnect();
  process.exit(0);
}

reactivateAdmin().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
