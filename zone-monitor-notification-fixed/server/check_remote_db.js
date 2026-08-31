require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URI).then(async () => {
  try {
    const user = await mongoose.connection.db.collection('users').findOne({ email: 'tamil@gmail.com' });
    console.log('Found user:', user);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
});
