const mongoose = require('mongoose');
require('dotenv').config();
const Company = require('./models/Company');
const User = require('./models/User');
const Visitor = require('./models/Visitor');
const http = require('http');

async function makeRequest(companyId) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: '/api/visitors',
      method: 'GET',
      headers: {
        'X-Company-Id': companyId,
        'X-User-Role': 'Super Admin'
      }
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    req.end();
  });
}

async function run() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/vms');
  console.log('Connected to DB');

  // Create Company A
  let compA = await Company.findOne({ code: 'COMPA' });
  if (!compA) {
    compA = await Company.create({ name: 'Company A', code: 'COMPA', subscription: 'Enterprise', status: 'Active', subscriptionExpiresAt: new Date(Date.now() + 86400000) });
  }
  
  // Create Company B
  let compB = await Company.findOne({ code: 'COMPB' });
  if (!compB) {
    compB = await Company.create({ name: 'Company B', code: 'COMPB', subscription: 'Enterprise', status: 'Active', subscriptionExpiresAt: new Date(Date.now() + 86400000) });
  }

  // Clear existing visitors for testing
  await Visitor.deleteMany({ companyId: { $in: ['COMPA', 'COMPB'] } });

  // Add Visitors
  await Visitor.create({ companyId: 'COMPA', profileId: 'PA1', visitorName: 'Alice (A)', mobileNumber: '1111', hostName: 'Host A', purpose: 'Meeting', visitDate: '2026-07-17', branch: 'Branch A' });
  await Visitor.create({ companyId: 'COMPA', profileId: 'PA2', visitorName: 'Alex (A)', mobileNumber: '2222', hostName: 'Host A', purpose: 'Interview', visitDate: '2026-07-17', branch: 'Branch A' });
  
  await Visitor.create({ companyId: 'COMPB', profileId: 'PB1', visitorName: 'Bob (B)', mobileNumber: '3333', hostName: 'Host B', purpose: 'Meeting', visitDate: '2026-07-17', branch: 'Branch B' });
  
  const visitorsA = await makeRequest('COMPA');
  const visitorsB = await makeRequest('COMPB');

  console.log(`Company A Visitors count: ${visitorsA.length}`);
  if (visitorsA.length > 0) {
    console.log(`  Names: ${visitorsA.map(v => v.visitorName).join(', ')}`);
  }

  console.log(`Company B Visitors count: ${visitorsB.length}`);
  if (visitorsB.length > 0) {
    console.log(`  Names: ${visitorsB.map(v => v.visitorName).join(', ')}`);
  }

  if (visitorsA.length === 2 && visitorsB.length === 1) {
    console.log('✅ MULTI-TENANT ISOLATION IS WORKING PERFECTLY!');
  } else {
    console.log('❌ MULTI-TENANT ISOLATION FAILED!');
  }

  mongoose.connection.close();
}

run().catch(console.error);
