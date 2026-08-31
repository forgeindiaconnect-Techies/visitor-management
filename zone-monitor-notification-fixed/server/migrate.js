const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' });
const Visitor = require('./models/Visitor');
mongoose.connect(process.env.MONGO_URI).then(async () => {
  const visitors = await Visitor.find();
  let count = 0;
  for (let v of visitors) {
     if (v.hostName) {
       const match = v.hostName.match(/\(([^)]+)\)/);
       if (match && match[1]) {
         v.hostTeam = match[1].trim();
         await v.save();
         count++;
       } else {
         v.hostTeam = 'General';
         await v.save();
         count++;
       }
     }
  }
  console.log('Updated ' + count + ' visitors');
  process.exit(0);
});
