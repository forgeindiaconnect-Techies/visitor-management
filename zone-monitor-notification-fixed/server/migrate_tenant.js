require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const Company = require('./models/Company');
const User = require('./models/User');
const Visitor = require('./models/Visitor');
const VisitorProfile = require('./models/VisitorProfile');
const SecurityAttendance = require('./models/SecurityAttendance');
const Alert = require('./models/Alert');
const Blacklist = require('./models/Blacklist');
const Notification = require('./models/Notification');
const Zone = require('./models/Zone');
const BranchSetting = require('./models/BranchSetting');

async function run() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB connected');

    // 1. Create Default Company if not exists
    let defaultCompany = await Company.findOne({ code: 'FIC001' });
    if (!defaultCompany) {
      console.log('Creating default company (FIC001)...');
      const expiry = new Date();
      expiry.setFullYear(expiry.getFullYear() + 10); // 10 years from now

      defaultCompany = new Company({
        name: 'FIC Group',
        code: 'FIC001',
        subscription: 'Enterprise',
        status: 'Active',
        subscriptionExpiresAt: expiry
      });
      await defaultCompany.save();
      console.log('✅ Default company created');
    } else {
      console.log('Default company already exists');
    }

    // 2. Migrate existing documents
    console.log('Migrating models...');
    const models = [
      { name: 'User', schema: User },
      { name: 'Visitor', schema: Visitor },
      { name: 'VisitorProfile', schema: VisitorProfile },
      { name: 'SecurityAttendance', schema: SecurityAttendance },
      { name: 'Alert', schema: Alert },
      { name: 'Blacklist', schema: Blacklist },
      { name: 'Notification', schema: Notification },
      { name: 'Zone', schema: Zone },
      { name: 'BranchSetting', schema: BranchSetting }
    ];

    for (const m of models) {
      const res = await m.schema.updateMany(
        { $or: [{ companyId: { $exists: false } }, { companyId: '' }] },
        { $set: { companyId: 'FIC001' } }
      );
      console.log(`Migrated ${m.name}: modified ${res.modifiedCount} documents (matched ${res.matchedCount})`);
    }

    console.log('Migration complete!');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

run();
