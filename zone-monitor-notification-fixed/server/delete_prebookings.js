const mongoose = require('mongoose');
require('dotenv').config({path: '../.env'});

const PreBooking = require('./models/PreBooking');

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(async () => {
  try {
    const result = await PreBooking.deleteMany({});
    console.log('Deleted ' + result.deletedCount + ' pre-bookings.');
    process.exit(0);
  } catch (error) {
    console.error('Error deleting pre-bookings:', error);
    process.exit(1);
  }
}).catch(console.error);
