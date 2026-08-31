const mongoose = require('mongoose');

async function test() {
  await mongoose.connect('mongodb://localhost:27017/zmvms');
  const Visitor = require('./models/Visitor');
  const all = await Visitor.find({});
  console.log(JSON.stringify(all, null, 2));
  process.exit(0);
}

test();
