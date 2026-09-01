const mongoose = require('mongoose');
const dns = require('dns');
require('dotenv').config();

dns.setServers(['8.8.8.8', '8.8.4.4']);

const Company = require('./models/Company');
const User = require('./models/User');
const Visitor = require('./models/Visitor');
const PreBooking = require('./models/PreBooking');
const Notification = require('./models/Notification');
const BranchSetting = require('./models/BranchSetting');
const SaasLead = require('./models/SaasLead');

const confirmed =
  process.argv[2] === 'DELETE_TENANTS';

const run = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI is missing');
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB connected');

    const companies = await Company.find({
      code: { $ne: 'SYSTEM' }
    }).select('_id name code');

    const companyCodes = companies.map(
      (company) => company.code
    );

    console.log('\nCompanies selected for deletion:');

    companies.forEach((company) => {
      console.log(`${company.code} - ${company.name}`);
    });

    const counts = {
      companies: companies.length,
      users: await User.countDocuments({
        role: { $ne: 'SaaS Super Admin' }
      }),
      visitors: await Visitor.countDocuments({
        companyId: { $in: companyCodes }
      }),
      preBookings: await PreBooking.countDocuments({
        companyId: { $in: companyCodes }
      }),
      branches: await BranchSetting.countDocuments({
        companyId: { $in: companyCodes }
      }),
      leads: await SaasLead.countDocuments({}),
      notifications: await Notification.countDocuments({})
    };

    console.log('\nRecords selected:', counts);

    if (!confirmed) {
      console.log('\nPreview only. Nothing was deleted.');
      console.log(
        'Run again with DELETE_TENANTS to confirm.'
      );
      return;
    }

    const results = {};

    results.visitors = await Visitor.deleteMany({
      companyId: { $in: companyCodes }
    });

    results.preBookings = await PreBooking.deleteMany({
      companyId: { $in: companyCodes }
    });

    results.branches = await BranchSetting.deleteMany({
      companyId: { $in: companyCodes }
    });

    results.users = await User.deleteMany({
      role: { $ne: 'SaaS Super Admin' }
    });

    results.leads = await SaasLead.deleteMany({});

    results.notifications =
      await Notification.deleteMany({});

    results.companies = await Company.deleteMany({
      _id: {
        $in: companies.map((company) => company._id)
      }
    });

    console.log('\n✅ Tenant cleanup completed');
    console.log({
      companies: results.companies.deletedCount,
      users: results.users.deletedCount,
      visitors: results.visitors.deletedCount,
      preBookings: results.preBookings.deletedCount,
      branches: results.branches.deletedCount,
      leads: results.leads.deletedCount,
      notifications:
        results.notifications.deletedCount
    });

    const remainingAdmins = await User.find({
      role: 'SaaS Super Admin'
    }).select('name email role companyId');

    console.log(
      '\nRemaining SaaS Super Admin accounts:',
      remainingAdmins
    );
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

run();
