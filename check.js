const mongoose = require('mongoose');
const MONGO_URI = 'mongodb://localhost:27017/zmvms';

mongoose.connect(MONGO_URI).then(async () => {
  try {
    const users = await mongoose.connection.db.collection('users').find({}).toArray();
    console.log("=== USERS IN DATABASE ===");
    users.forEach(u => {
      console.log(`Name: ${u.name}, Email: ${u.email}, Role: ${u.role}`);
    });
  } catch (err) {
    console.error("Error reading database:", err);
  } finally {
    process.exit(0);
  }
});
