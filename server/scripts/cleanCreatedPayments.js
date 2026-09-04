const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const Payment = require('../models/Payment');

async function clean() {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/zone-monitor';
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    
    const res = await Payment.deleteMany({ status: 'Created' });
    console.log(`✅ Cleaned up ${res.deletedCount} uncompleted draft payment orders ('Created').`);

    process.exit(0);
  } catch (err) {
    console.error('Error cleaning created payments:', err);
    process.exit(1);
  }
}

clean();
