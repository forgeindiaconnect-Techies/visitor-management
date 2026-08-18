const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/fic_vms';

async function run() {
  await mongoose.connect(MONGO_URI);
  const PreBooking = require('./models/PreBooking');
  const docs = await PreBooking.find({});
  console.log('Total PreBookings count:', docs.length);
  docs.forEach((d, i) => {
    console.log(`${i + 1}. [${d.visitorId}] Name: ${d.fullName} | Status: "${d.status}" | BookingType: "${d.bookingType}" | CompanyId: "${d.companyId}" | VisitDate: "${d.visitDate}"`);
  });
  mongoose.disconnect();
}

run().catch(console.error);
