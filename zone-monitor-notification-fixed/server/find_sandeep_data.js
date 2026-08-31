/**
 * DIAGNOSTIC SCRIPT: Find Sandeep's data and companyId mismatch
 * Run from: c:\PROJECTS\VMS\fic-visitor-1\server\
 * Command:  node find_sandeep_data.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

const MONGO_URI = "mongodb://localhost:27017/zmvms";

console.log('Connecting to MongoDB at', MONGO_URI, '...');
mongoose.connect(MONGO_URI).then(async () => {
  const db = mongoose.connection.db;
  console.log('✅ Connected!\n');

  // 1. Find sandeep@gmail.com and his companyId
  const user = await db.collection('users').findOne({ email: 'sandeep@gmail.com' });
  if (user) {
    console.log('=== SANDEEP USER ACCOUNT ===');
    console.log(`  Email:     ${user.email}`);
    console.log(`  CompanyId: ${user.companyId}`);
    console.log(`  Role:      ${user.role}`);
    console.log(`  Branch:    ${user.branch}`);
    console.log(`  _id:       ${user._id}`);
  } else {
    console.log('❌ sandeep@gmail.com NOT FOUND in users collection!');
  }

  // 2. Count ALL visitors by companyId
  console.log('\n=== VISITOR COUNT BY COMPANY ===');
  const companyCounts = await db.collection('visitors').aggregate([
    { $group: { _id: '$companyId', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]).toArray();
  companyCounts.forEach(c => {
    console.log(`  CompanyId: "${c._id}" → ${c.count} visitors`);
  });

  // 3. Count prebookings by companyId
  console.log('\n=== PRE-BOOKING COUNT BY COMPANY ===');
  const pbCounts = await db.collection('prebookings').aggregate([
    { $group: { _id: '$companyId', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]).toArray();
  pbCounts.forEach(c => {
    console.log(`  CompanyId: "${c._id}" → ${c.count} pre-bookings`);
  });

  // 4. If sandeep found, show what companyId his data is ACTUALLY querying
  if (user) {
    const cid = user.companyId;
    console.log(`\n=== VISITORS FOR "${cid}" (Sandeep's company) ===`);
    const visitors = await db.collection('visitors')
      .find({ companyId: cid })
      .sort({ createdAt: -1 })
      .limit(5)
      .toArray();
    console.log(`  Total visitors for ${cid}: ${await db.collection('visitors').countDocuments({ companyId: cid })}`);
    visitors.forEach(v => {
      console.log(`  - ${v.visitorName} | ${v.branch} | ${v.status} | ${v.createdAt?.toISOString?.() || v.createdAt}`);
    });
  }

  // 5. Find all companies in companies collection
  console.log('\n=== ALL COMPANIES ===');
  const companies = await db.collection('companies').find({}).toArray();
  companies.forEach(c => {
    console.log(`  Code: "${c.code}" | Name: "${c.name}" | Status: ${c.status}`);
  });

  // 6. Show ALL user accounts for reference
  console.log('\n=== ALL USER ACCOUNTS ===');
  const allUsers = await db.collection('users').find({}).toArray();
  allUsers.forEach(u => {
    console.log(`  ${u.email} | companyId: ${u.companyId} | role: ${u.role}`);
  });

  process.exit(0);
}).catch(err => {
  console.error('❌ Connection failed:', err.message);
  process.exit(1);
});
