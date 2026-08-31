require('dotenv').config();
const mongoose = require('mongoose');

const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/zmvms";

mongoose.connect(uri)
  .then(async () => {
    const db = mongoose.connection.db;
    const visitors = await db.collection('visitors').find({}).sort({ createdAt: -1 }).limit(10).toArray();
    console.log("Recent Visitors in DB:");
    visitors.forEach(v => {
      console.log(`- ${v.visitorName} | host: ${v.hostName} | branch: ${v.branch} | count: ${v.visitorCount} | createdAt: ${v.createdAt}`);
    });
    
    // Check todays-summary logic
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    
    const todays = visitors.filter(v => v.createdAt >= startOfDay && v.createdAt <= endOfDay);
    console.log("\nVisitors Today:");
    todays.forEach(v => {
      console.log(`- ${v.visitorName} | host: ${v.hostName} | branch: ${v.branch} | count: ${v.visitorCount}`);
    });

    process.exit(0);
  });
