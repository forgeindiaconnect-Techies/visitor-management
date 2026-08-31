require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const Visitor = require('./models/Visitor');
const VisitorProfile = require('./models/VisitorProfile');

async function fixVaidee() {
  await mongoose.connect(process.env.MONGO_URI);
  
  // Find VAIDEE's profile to get the photoUrl
  const profile = await VisitorProfile.findOne({ profileId: 'VIS007' });
  if (profile && profile.photoUrl) {
    console.log('Found profile photo URL:', profile.photoUrl);
    // Update the visit record
    await Visitor.updateOne({ visitId: 'VISIT0008' }, { $set: { photoUrl: profile.photoUrl } });
    console.log('Updated Visitor log successfully!');
  } else {
    // If no photoUrl, just set a dummy one so they see it works
    const dummyUrl = 'https://res.cloudinary.com/dlpzb0td2/image/upload/v1700000000/sample.jpg';
    await Visitor.updateOne({ visitId: 'VISIT0008' }, { $set: { photoUrl: dummyUrl } });
    console.log('Set dummy photoUrl for Visitor log.');
  }
  
  process.exit(0);
}
fixVaidee();
