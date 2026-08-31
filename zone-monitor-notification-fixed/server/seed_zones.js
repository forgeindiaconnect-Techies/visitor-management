require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const Zone = require('./models/Zone');

mongoose.connect(process.env.MONGO_URI).then(async () => {
  console.log('Connected to DB');

  const zonesToInsert = [
    { name: 'Reception', branch: 'Thirupathur', type: 'Public Area', accessLevel: 'Public', status: 'Active', description: 'Visitor Waiting Area' },
    { name: 'Waiting Area', branch: 'Thirupathur', type: 'Public Area', accessLevel: 'Public', status: 'Active', description: 'General Waiting Lounge' },
    { name: 'Meeting Room', branch: 'Thirupathur', type: 'Meeting', accessLevel: 'Approved Visitors', status: 'Active', description: 'General meetings' },
    { name: 'HR Cabin', branch: 'Thirupathur', type: 'Office', accessLevel: 'HR Only', status: 'Active', description: 'Human Resources Office' },
    { name: 'Admin Cabin', branch: 'Thirupathur', type: 'Office', accessLevel: 'Authorized Visitors', status: 'Active', description: 'Administrative Office' },
    { name: 'MD Cabin', branch: 'Thirupathur', type: 'Restricted', accessLevel: 'Special Approval', status: 'Active', description: 'Managing Director Office', restricted: true },
    { name: 'Conference Hall', branch: 'Thirupathur', type: 'Meeting', accessLevel: 'Approved Visitors', status: 'Active', description: 'Large meetings' },
    { name: 'Server Room', branch: 'Thirupathur', type: 'Restricted', accessLevel: 'No Visitor Access', status: 'Active', description: 'IT Infrastructure', restricted: true },
    { name: 'Production Area', branch: 'Thirupathur', type: 'Restricted', accessLevel: 'Staff Only', status: 'Active', description: 'Factory Floor', restricted: true }
  ];

  await Zone.deleteMany({});
  await Zone.insertMany(zonesToInsert);
  console.log('Corporate Zones successfully inserted into database!');
  
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
