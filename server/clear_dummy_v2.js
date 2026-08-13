const dns = require('dns');
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {
  console.warn('Could not set custom DNS servers:', e.message);
}

const mongoose = require('mongoose');
const PreBooking = require('./models/PreBooking');

mongoose.connect('mongodb+srv://zone:zone12@cluster0.qpt2tel.mongodb.net/?appName=Cluster0')
  .then(async () => {
    console.log('Connected to DB');
    const result = await PreBooking.deleteMany({
      $or: [
        { hostEmployee: 'New Visitors' },
        { hostEmployee: 'New Visitor' },
        { visitorType: 'NEW_VISITOR' },
        { fullName: { $in: ['josii', 'Deepuu', 'VERMA', 'Deepu', 'deepu', 'verma'] } }
      ]
    });
    console.log('Deleted dummy pre-bookings:', result.deletedCount);
    mongoose.disconnect();
  })
  .catch(err => console.error(err));
