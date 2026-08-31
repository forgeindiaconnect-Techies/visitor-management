const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/zmvms').then(async () => {
  try {
    const db = mongoose.connection.db;
    const collections = await db.collections();
    
    for (let collection of collections) {
      console.log(`Clearing ${collection.collectionName}...`);
      await collection.deleteMany({});
    }
    
    console.log('Database successfully cleared!');
  } catch (err) {
    console.error('Error clearing database:', err);
  } finally {
    process.exit(0);
  }
});
