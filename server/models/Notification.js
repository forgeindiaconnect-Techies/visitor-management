const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    companyId: {
      type: String,
      index: true
    },
    branchId: {
      type: String,
    },
    userId: {
      type: String,
    },
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    recipients: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    }],
    preBookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PreBooking',
      default: null,
    },
    type: {
      type: String,
      default: 'info',
      // The frontend can map these to icons/colors
      // Keeping original enums just in case of old data, plus new ones
      enum: ['success', 'warning', 'error', 'info', 'Tenant', 'Visitor', 'Security', 'Attendance', 'Subscription', 'System', 'Announcement', 'Branch', 'Admin', 'PREBOOKING_CREATED', 'PREBOOKING_APPROVED', 'PREBOOKING_REJECTED'],
    },
    module: {
      type: String,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    createdBy: {
      type: String,
    },
    roles: [
      {
        type: String,
      },
    ],
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

notificationSchema.pre('save', function() {
  this.wasNew = this.isNew;
});

notificationSchema.post('save', async function(doc) {
  if (doc.wasNew) {
    try {
      const User = mongoose.model('User');
      const sendPushNotification = require('../utils/pushNotificationService');
      
      let query = { fcmToken: { $exists: true, $ne: '' } };
      
      if (doc.recipient) {
        query._id = doc.recipient;
      } else {
        if (doc.type === 'Attendance') {
          query.role = 'Super Admin';
        }
        
        if (doc.companyId && doc.companyId !== 'SYSTEM') {
          query.companyId = doc.companyId;
          if (doc.branchId && doc.branchId !== 'All Branches') {
            query.$or = [
              { branch: doc.branchId },
              { branch: 'All Branches' },
              { branchId: doc.branchId },
              { branchId: 'All Branches' }
            ];
          }
        } else if (doc.companyId === 'SYSTEM') {
          query.role = 'SaaS Super Admin';
        }
      }

      const usersToNotify = await User.find(query);
      const tokens = usersToNotify.map(u => u.fcmToken);

      if (tokens.length > 0) {
        await sendPushNotification(tokens, doc.title, doc.message, {
          notificationId: doc._id.toString(),
          module: doc.module || 'System',
          companyId: doc.companyId || 'SYSTEM'
        });
      }
    } catch (err) {
      console.error('Push notification auto-dispatch error:', err);
    }
  }
});

module.exports = mongoose.model("Notification", notificationSchema);
