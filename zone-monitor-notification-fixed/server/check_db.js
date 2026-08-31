const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/zmvms').then(async () => {
  try {
    const user = await mongoose.connection.db.collection('users').findOne({ email: 'tamil@gmail.com' });
    console.log(user);
    const allUsers = await mongoose.connection.db.collection('users').find({}).toArray();
    console.log(allUsers.map(u => ({ email: u.email, pwd: u.password })));
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
});
