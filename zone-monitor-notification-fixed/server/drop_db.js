const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/zmvms').then(async () => {
  try {
    await mongoose.connection.db.dropDatabase();
    console.log('Database dropped successfully!');
  } catch (err) {
    console.error('Error dropping database:', err);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
});
