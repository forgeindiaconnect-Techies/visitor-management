const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/zmvms').then(async () => {
  await mongoose.connection.db.collection('users').updateMany(
    { role: 'Branch Admin' },
    { $set: { role: 'Admin', name: 'Admin User' } }
  );
  console.log('Migration complete');
  process.exit(0);
});
