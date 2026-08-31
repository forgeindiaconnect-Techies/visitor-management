const mongoose = require('mongoose');
require('dotenv').config();
const Company = require('./models/Company');
const User = require('./models/User');

async function run() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/vms');
  
  // Ensure Company B exists
  let compB = await Company.findOne({ code: 'COMPB' });
  if (!compB) {
    compB = await Company.create({ name: 'Company B', code: 'COMPB', subscription: 'Enterprise', status: 'Active', subscriptionExpiresAt: new Date(Date.now() + 86400000) });
  }

  // Ensure Admin B exists
  let adminB = await User.findOne({ email: 'adminb@gmail.com' });
  if (!adminB) {
    await User.create({
      companyId: 'COMPB',
      name: 'Admin B',
      email: 'adminb@gmail.com',
      password: 'password123',
      role: 'Super Admin',
      branch: 'All Branches',
      status: 'Active'
    });
    console.log("Created Admin B");
  } else {
    // reset password just in case
    adminB.password = 'password123';
    await adminB.save();
    console.log("Updated Admin B");
  }
  
  console.log("Done");
  process.exit(0);
}
run();
