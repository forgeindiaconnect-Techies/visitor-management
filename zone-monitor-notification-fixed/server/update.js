const mongoose = require('mongoose');
require('dotenv').config();

async function update() {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
  const Visitor = require('./models/Visitor');
  await Visitor.updateMany({}, { $set: { branch: 'Thirupathur' } });
  console.log('Updated remote db');
  process.exit(0);
}

update();
