require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const Zone = require('./models/Zone');

mongoose.connect(process.env.MONGO_URI).then(async () => {
  console.log('Connected to DB');

  // Delete all zones to clear the dummy data
  await Zone.deleteMany({});

  console.log('All zones successfully deleted from database!');
  
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
