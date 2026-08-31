const mongoose = require('mongoose');
require('dotenv').config({path: '../.env'});
mongoose.connect(process.env.MONGO_URI).then(async () => {
  const collections = await mongoose.connection.db.collections();
  let visitorsCollection;
  for (let collection of collections) {
    if (collection.collectionName === 'visitors') {
      visitorsCollection = collection;
    }
  }
  if (visitorsCollection) {
    const result = await visitorsCollection.deleteMany({ 
      visitorName: { $nin: ['MANU', 'manju', 'Sindhuja', 'sindhuja'] } 
    });
    console.log('Deleted ' + result.deletedCount + ' visitors');
  }
  process.exit(0);
}).catch(console.error);
