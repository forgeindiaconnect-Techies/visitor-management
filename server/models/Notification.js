const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    eventId: {
      type: String,
      sparse: true,
      unique: true,
      index: true
    },
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
      role: { type: String },
      userId: { type: String },
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    }],
    readBy: [{
      userId: { type: String },
      readAt: { type: Date, default: Date.now }
    }],
    visitorId: {
      type: String,
      default: null
    },
    visitorType: {
      type: String,
      enum: ['PRE_BOOKING', 'DIRECT_VISIT', null],
      default: null
    },
    preBookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PreBooking',
      default: null,
    },
    type: {
      type: String,
      enum: ['info', 'warning', 'success', 'error'],
      default: 'info',
    },
    module: {
      type: String,
      default: 'System',
      trim: true,
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
      
      let query = { 
        fcmToken: { $exists: true, $ne: '' },
        status: 'Active'
      };
      
      if (doc.recipient) {
        query._id = doc.recipient;
      } else {
        if (doc.type === 'Attendance') {
          query.role = { $in: ['Super Admin', 'Company Admin'] };
        }
        
        if (doc.companyId && doc.companyId !== 'SYSTEM') {
          query.companyId = new RegExp(`^${doc.companyId}$`, 'i');
          if (doc.roles && doc.roles.length > 0) {
            query.role = { $in: doc.roles };
          }
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
