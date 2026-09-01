const mongoose = require('mongoose');
const dns = require('dns');
require('dotenv').config();

dns.setServers(['8.8.8.8', '8.8.4.4']);

const SaasLead = require('./models/SaasLead');
const Company = require('./models/Company');
const User = require('./models/User');
const Notification = require('./models/Notification');

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    const leads = await SaasLead.find({})
      .select('_id companyName email convertedCompanyId');

    if (leads.length === 0) {
      console.log('No SaaS leads found to delete.');
      return;
    }

    const leadIds = leads.map((lead) => lead._id);
    const companyIds = leads
      .map((lead) => lead.convertedCompanyId)
      .filter(Boolean);

    const companies = await Company.find({
      _id: { $in: companyIds }
    }).select('code');

    const companyCodes = companies.map(
      (company) => company.code
    );

    // 1. Delete SaaS lead notifications
    const leadEventIds = leadIds.map((id) => `SAAS_LEAD_${id}`);
    const notificationResult = await Notification.deleteMany({
      $or: [
        { eventId: { $in: leadEventIds } },
        { eventId: { $in: leadIds } }
      ]
    });

    // 2. Delete Super Admin accounts created for converted companies
    const userResult = companyCodes.length > 0 
      ? await User.deleteMany({ companyId: { $in: companyCodes } })
      : { deletedCount: 0 };

    // 3. Delete converted companies
    const companyResult = companyIds.length > 0 
      ? await Company.deleteMany({ _id: { $in: companyIds } })
      : { deletedCount: 0 };

    // 4. Delete SaaS leads
    const leadResult = await SaasLead.deleteMany({ _id: { $in: leadIds } });

    console.log('\n--- Cleanup Summary ---');
    console.log('Deleted SaaS Leads:', leadResult.deletedCount);
    console.log('Deleted Converted Companies:', companyResult.deletedCount);
    console.log('Deleted Super Admin / Company Users:', userResult.deletedCount);
    console.log('Deleted SaaS Lead Notifications:', notificationResult.deletedCount);
  } catch (error) {
    console.error('Error during SaaS cleanup execution:', error);
  } finally {
    await mongoose.disconnect();
  }
})();
