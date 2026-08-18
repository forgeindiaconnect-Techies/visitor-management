const dns = require('dns');
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {
  console.warn('Could not set custom DNS servers:', e.message);
}

const mongoose = require('mongoose');
const PreBooking = require('./models/PreBooking');
const Visitor = require('./models/Visitor');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb+srv://zone:zone12@cluster0.qpt2tel.mongodb.net/?appName=Cluster0';

async function cleanDuplicatePreBookings() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB for cleanup...');

    // 1. Clean PreBooking collection duplicates
    const allPreBookings = await PreBooking.find().sort({ createdAt: -1 });
    const seenPbKeys = new Set();
    const pbToDelete = [];

    for (const pb of allPreBookings) {
      const email = (pb.email || '').trim().toLowerCase();
      const mobile = (pb.mobileNumber || '').replace(/\D/g, '').slice(-10);
      const name = (pb.fullName || pb.visitorName || '').trim().toLowerCase();
      const status = (pb.status || '').trim().toUpperCase();

      const identityKey = `${name}|${mobile}|${email}|${status}`;
      if (seenPbKeys.has(identityKey)) {
        pbToDelete.push(pb._id);
      } else {
        seenPbKeys.add(identityKey);
      }
    }

    if (pbToDelete.length > 0) {
      const resPb = await PreBooking.deleteMany({ _id: { $in: pbToDelete } });
      console.log(`Deleted ${resPb.deletedCount} duplicate PreBooking records.`);
    } else {
      console.log('No duplicate PreBooking records found.');
    }

    // 2. Clean Visitor collection duplicates
    const allVisitors = await Visitor.find().sort({ createdAt: -1 });
    const seenVisKeys = new Set();
    const visToDelete = [];

    for (const vis of allVisitors) {
      const email = (vis.email || '').trim().toLowerCase();
      const mobile = (vis.mobileNumber || '').replace(/\D/g, '').slice(-10);
      const name = (vis.visitorName || vis.fullName || '').trim().toLowerCase();
      const status = (vis.status || vis.approvalStatus || '').trim().toUpperCase();

      const identityKey = `${name}|${mobile}|${email}|${status}`;
      if (seenVisKeys.has(identityKey)) {
        visToDelete.push(vis._id);
      } else {
        seenVisKeys.add(identityKey);
      }
    }

    if (visToDelete.length > 0) {
      const resVis = await Visitor.deleteMany({ _id: { $in: visToDelete } });
      console.log(`Deleted ${resVis.deletedCount} duplicate Visitor records.`);
    } else {
      console.log('No duplicate Visitor records found.');
    }

    console.log('Cleanup completed successfully.');
  } catch (err) {
    console.error('Error during cleanup:', err);
  } finally {
    await mongoose.disconnect();
  }
}

cleanDuplicatePreBookings();
