const mongoose = require('mongoose');
require('dotenv').config();
mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI).then(async () => {
  const User = mongoose.connection.collection('users');
  const Visitor = mongoose.connection.collection('visitors');
  
  await User.updateMany({ branch: 'Thirupathur' }, { $set: { branch: 'Tirupattur' } });
  await User.updateMany({ branch: 'Dharmapuri (Palakodu)' }, { $set: { branch: 'Salem' } });
  await User.updateMany({ branch: 'Bangalore' }, { $set: { branch: 'Chennai' } });
  
  await Visitor.updateMany({ branch: 'Thirupathur' }, { $set: { branch: 'Tirupattur' } });
  await Visitor.updateMany({ branch: 'Dharmapuri (Palakodu)' }, { $set: { branch: 'Salem' } });
  await Visitor.updateMany({ branch: 'Bangalore' }, { $set: { branch: 'Chennai' } });
  
  console.log("Branches updated in DB.");
  process.exit(0);
}).catch(console.error);
