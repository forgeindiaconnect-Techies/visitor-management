const mongoose = require('mongoose');
require('dotenv').config({path: '../.env'});

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const collections = await mongoose.connection.db.collections();
  
  const pbCollection = collections.find(c => c.collectionName === 'prebookings');
  if (pbCollection) {
    const res = await pbCollection.deleteMany({
      fullName: { $regex: /pooja|agila|test|dummy/i }
    });
    console.log('Deleted ' + res.deletedCount + ' prebookings');
  }

  const vCollection = collections.find(c => c.collectionName === 'visitors');
  if (vCollection) {
    const res = await vCollection.deleteMany({
      visitorName: { $regex: /pooja|agila|test|dummy/i }
    });
    console.log('Deleted ' + res.deletedCount + ' visitors');
  }

  process.exit(0);
}).catch(console.error);
