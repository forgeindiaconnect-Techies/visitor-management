const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' });
const bcrypt = require('bcrypt');

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const User = require('./models/User');
  const users = await User.find({});
  
  for (let u of users) {
    // Make the password the user's name in lowercase, removing spaces
    const namePassword = u.name.toLowerCase().replace(/\s+/g, '');
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(namePassword, salt);
    
    await User.updateOne({ _id: u._id }, { password: hash, plainPassword: namePassword });
  }
  
  console.log('All passwords updated to match their names!');
  process.exit(0);
});
