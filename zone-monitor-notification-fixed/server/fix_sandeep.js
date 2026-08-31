require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

// Use the Atlas URI but force IPv4 to avoid ECONNREFUSED on some networks
const MONGO_URI = process.env.MONGO_URI || process.env.VITE_MONGO_URI;

console.log('Connecting to MongoDB at', MONGO_URI, '...');
mongoose.connect(MONGO_URI, { family: 4 }).then(async () => {
  const db = mongoose.connection.db;
  console.log('✅ Connected!');

  // 1. Find the company that has the 89 walkins
  const companyCounts = await db.collection('visitors').aggregate([
    { $group: { _id: '$companyId', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]).toArray();
  
  console.log('\n--- Visitor Counts by Company ---');
  console.log(companyCounts);

  let targetCompanyId = 'FIC001';
  if (companyCounts.length > 0) {
    targetCompanyId = companyCounts[0]._id; // The one with the most visitors
  }

  console.log(`\n=> Target CompanyId with most visitors is: ${targetCompanyId}`);

  // 2. Find sandeep@gmail.com
  const user = await db.collection('users').findOne({ email: 'sandeep@gmail.com' });
  if (user) {
    console.log(`\nFound sandeep@gmail.com! Current companyId: ${user.companyId}`);
    
    if (user.companyId !== targetCompanyId) {
      console.log(`Fixing Sandeep's companyId to ${targetCompanyId}...`);
      await db.collection('users').updateOne(
        { email: 'sandeep@gmail.com' },
        { $set: { companyId: targetCompanyId } }
      );
      console.log('✅ FIXED! Sandeep is now linked to the correct company data.');
    } else {
      console.log('Sandeep is already linked to the target company. The issue might be branch filtering.');
      // Update branch to All Branches just in case
      if (user.branch !== 'All Branches') {
        console.log(`Fixing Sandeep's branch to "All Branches"...`);
        await db.collection('users').updateOne(
          { email: 'sandeep@gmail.com' },
          { $set: { branch: 'All Branches' } }
        );
        console.log('✅ FIXED! Sandeep branch is now All Branches.');
      }
    }
  } else {
    console.log('❌ Could not find sandeep@gmail.com in the database!');
  }

  process.exit(0);
}).catch(err => {
  console.error('❌ Connection failed:', err.message);
  process.exit(1);
});
