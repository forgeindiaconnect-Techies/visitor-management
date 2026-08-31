const mongoose = require('mongoose');
const PreBooking = require('./models/PreBooking');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI)
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
