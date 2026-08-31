const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' });
const bcrypt = require('bcrypt');

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const User = require('./models/User');
  const users = await User.find({ plainPassword: null });
  const users2 = await User.find({ plainPassword: { $exists: false } });
  
  const allUsers = [...users, ...users2];
  
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash('admin123', salt);
  
  for (let u of allUsers) {
    await User.updateOne({ _id: u._id }, { password: hash, plainPassword: 'admin123' });
  }
  
  console.log('Passwords updated successfully for ' + allUsers.length + ' users.');
  process.exit(0);
});
