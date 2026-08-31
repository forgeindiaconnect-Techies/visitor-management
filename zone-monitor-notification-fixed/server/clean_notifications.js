const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!MONGO_URI) throw new Error('MONGO_URI is required');

async function runCleanup() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGO_URI);
  console.log('✅ MongoDB connected successfully');

  const Notification = require('./models/Notification');
  const notifications = await Notification.find({});
  
  console.log(`Analyzing ${notifications.length} notifications...`);
  
  // Group duplicates
  const groups = {};
  for (const notif of notifications) {
    if (notif.recipient) {
      const pKey = notif.preBookingId ? String(notif.preBookingId) : '';
      const vKey = notif.visitorId ? String(notif.visitorId) : '';
      const key = `${pKey}_${vKey}_${notif.type || ''}_${notif.title || ''}_${(notif.message || '').slice(0, 50)}`;
      
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(notif);
    }
  }

  let mergedCount = 0;
  let deletedCount = 0;
  let singleConvertedCount = 0;

  for (const key of Object.keys(groups)) {
    const list = groups[key];
    
    // Sort by createdAt ascending (oldest first)
    list.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    // Separate into subgroups based on time differences (within 5 minutes)
    const subgroups = [];
    for (const item of list) {
      let placed = false;
      for (const sub of subgroups) {
        const firstItem = sub[0];
        const timeDiff = Math.abs(new Date(item.createdAt) - new Date(firstItem.createdAt));
        if (timeDiff <= 5 * 60 * 1000) { // 5 minutes
          sub.push(item);
          placed = true;
          break;
        }
      }
      if (!placed) {
        subgroups.push([item]);
      }
    }

    for (const sub of subgroups) {
      if (sub.length > 1) {
        const mainNotif = sub[0];
        // Get all recipient IDs
        const recipientIds = sub.map(item => String(item.recipient));
        const uniqueRecipientIds = [...new Set(recipientIds)];

        // Update mainNotification
        mainNotif.recipients = uniqueRecipientIds.map(id => ({
          userId: id,
          user: id
        }));
        
        // Unset recipient
        mainNotif.recipient = undefined;
        await mainNotif.save();
        mergedCount++;

        // Delete duplicates
        for (let i = 1; i < sub.length; i++) {
          await Notification.deleteOne({ _id: sub[i]._id });
          deletedCount++;
        }
      } else {
        // Single notification with recipient field, convert to recipients array
        const notif = sub[0];
        notif.recipients = [{
          userId: String(notif.recipient),
          user: notif.recipient
        }];
        notif.recipient = undefined;
        await notif.save();
        singleConvertedCount++;
      }
    }
  }

  console.log('-------------------------------------------');
  console.log(`Merge/cleanup complete:`);
  console.log(`- Merged duplicate groups: ${mergedCount}`);
  console.log(`- Deleted duplicate records: ${deletedCount}`);
  console.log(`- Converted single records: ${singleConvertedCount}`);
  console.log('-------------------------------------------');

  await mongoose.disconnect();
  console.log('Disconnected from MongoDB.');
}

runCleanup().catch(err => {
  console.error('Cleanup failed:', err);
  process.exit(1);
});
