require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const Visitor = require('./models/Visitor');

async function checkPhotoUrl() {
  await mongoose.connect(process.env.MONGO_URI);
  const visitors = await Visitor.find().sort({ createdAt: -1 }).limit(1);
  console.log(visitors[0]);
  process.exit(0);
}
checkPhotoUrl();
