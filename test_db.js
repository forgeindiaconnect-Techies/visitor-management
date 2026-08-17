const mongoose = require('mongoose');

const uri = "mongodb+srv://zone:zone12@cluster0.qpt2tel.mongodb.net/?appName=Cluster0";

mongoose.connect(uri)
  .then(async () => {
    console.log("Connected to Atlas!");
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    console.log("Collections:", collections.map(c => c.name).join(', '));
    
    const users = await db.collection('users').find({}).toArray();
    console.log("Users:", users.map(u => ({ email: u.email, companyId: u.companyId })));
    
    const visitors = await db.collection('visitors').find({}).toArray();
    console.log("Total Visitors:", visitors.length);
    
    process.exit(0);
  })
  .catch(err => {
    console.error("Error:", err);
    process.exit(1);
  });
