const mongoose = require('mongoose');
const dns = require('dns');
require('dotenv').config();

dns.setServers(['8.8.8.8', '8.8.4.4']);

const SaasLead = require('./models/SaasLead');
const Company = require('./models/Company');
const User = require('./models/User');

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    const leads = await SaasLead.find({})
      .select('companyName email convertedCompanyId');

    const companyIds = leads
      .map((lead) => lead.convertedCompanyId)
      .filter(Boolean);

    const companies = await Company.find({
      _id: { $in: companyIds }
    }).select('name code');

    const companyCodes = companies.map(
      (company) => company.code
    );

    const users = await User.find({
      companyId: { $in: companyCodes }
    }).select('name email role companyId');

    console.log('SaaS leads:', leads);
    console.log('Converted companies:', companies);
    console.log('Company users:', users);

    console.log('\nCounts:');
    console.log('Leads:', leads.length);
    console.log('Companies:', companies.length);
    console.log('Users:', users.length);
  } catch (error) {
    console.error(error);
  } finally {
    await mongoose.disconnect();
  }
})();
