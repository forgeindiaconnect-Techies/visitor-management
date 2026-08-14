const mongoose = require('mongoose');
require('dotenv').config({path: '../.env'});

mongoose.connect(process.env.MONGO_URI).then(async () => {
  try {
    const collections = await mongoose.connection.db.collections();
    
    const query = {
      $or: [
        { fullName: { $regex: /pooja|agila|test|dummy/i } },
        { email: { $regex: /pooja|agila|test|dummy/i } },
        { visitorName: { $regex: /pooja|agila|test|dummy/i } }
      ]
    };

    // 1. Clear PreBookings
    const pbCollection = collections.find(c => c.collectionName === 'prebookings');
    if (pbCollection) {
      // Using an OR condition that accounts for both fullName (PreBooking) and visitorName (others)
      const res = await pbCollection.deleteMany(query);
      console.log('Deleted ' + res.deletedCount + ' dummy prebookings');
    }

    // 2. Clear Invitations (RegistrationToken)
    const invCollection = collections.find(c => c.collectionName === 'registrationtokens');
    if (invCollection) {
      const res = await invCollection.deleteMany(query);
      console.log('Deleted ' + res.deletedCount + ' dummy invitations (RegistrationTokens)');
    }

    // 3. Clear Visitors
    const vCollection = collections.find(c => c.collectionName === 'visitors');
    if (vCollection) {
      const res = await vCollection.deleteMany(query);
      console.log('Deleted ' + res.deletedCount + ' dummy visitors');
    }

    console.log("Dummy data cleared successfully.");
  } catch(e) {
    console.error("Error clearing dummy data:", e);
  } finally {
    process.exit(0);
  }
}).catch(console.error);
