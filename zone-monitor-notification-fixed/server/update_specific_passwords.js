const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' });
const bcrypt = require('bcrypt');

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const User = require('./models/User');
  
  const updatePassword = async (email, plainPassword) => {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(plainPassword, salt);
    await User.updateOne({ email }, { password: hash, plainPassword });
    console.log(`Updated ${email} password to: ${plainPassword}`);
  };

  await updatePassword('rsandhiya@gmail.com', 'sandhiya');
  await updatePassword('monika@gmail.com', 'monika');
  
  console.log('Passwords updated successfully!');
  process.exit(0);
});
