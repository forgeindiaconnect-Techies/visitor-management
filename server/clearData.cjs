const mongoose = require('mongoose');
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
require('dotenv').config();

// Mongoose Models
const visitorSchema = new mongoose.Schema({}, { strict: false });
const preBookingSchema = new mongoose.Schema({}, { strict: false });
const notificationSchema = new mongoose.Schema({}, { strict: false });

const Visitor = mongoose.model('Visitor', visitorSchema, 'visitors');
const PreBooking = mongoose.model('PreBooking', preBookingSchema, 'prebookings');
const Notification = mongoose.model('Notification', notificationSchema, 'notifications');

const clearDatabase = async () => {
  try {
    const MONGO_URI = process.env.MONGO_URI;
    if (!MONGO_URI) {
      console.error('MONGO_URI is missing from .env');
      process.exit(1);
    }

    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected.');

    console.log('Clearing Visitors, PreBookings, and Notifications...');
    
    const vRes = await Visitor.deleteMany({});
    console.log(`Deleted ${vRes.deletedCount} Visitors.`);
    
    const pRes = await PreBooking.deleteMany({});
    console.log(`Deleted ${pRes.deletedCount} Pre-Bookings.`);
    
    const nRes = await Notification.deleteMany({});
    console.log(`Deleted ${nRes.deletedCount} Notifications.`);

    console.log('🎉 All test data cleared successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error clearing data:', err);
    process.exit(1);
  }
};

clearDatabase();

