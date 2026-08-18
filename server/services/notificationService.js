const Notification = require('../models/Notification');
const User = require('../models/User');

/**
 * Centralized Notification Service
 * Prevents duplicate creation via unique eventId.
 * Dispatches Socket.IO real-time event & FCM push notifications.
 */
const createNotification = async ({
  eventId,
  type = 'info',
  title,
  message,
  visitorId = null,
  visitorType = null,
  recipients = [],
  companyId = 'FIC001',
  branchId = 'All Branches',
  io = null
}) => {
  try {
    let notification;

    try {
      notification = await Notification.create({
        eventId,
        type,
        title,
        message,
        visitorId,
        visitorType,
        recipients,
        companyId,
        branchId
      });
    } catch (dbErr) {
      if (dbErr.code === 11000) {
        // Event already created (de-duplication guarantee)
        notification = await Notification.findOne({ eventId });
        return notification;
      }
      throw dbErr;
    }

    // Broadcast via Socket.IO if available
    if (io) {
      io.emit('notification-created', notification);
      io.emit('notification:new', notification);
      io.emit('notification:updated', { eventId, notification });

      if (recipients && recipients.length > 0) {
        recipients.forEach(r => {
          if (r.role) {
            io.to(`notification:${r.role}`).emit('notification-created', notification);
          }
        });
      }
    }

    // Dispatch Push Notification via FCM Service
    try {
      const { sendNotificationToRoles } = require('./fcmService');
      const targetRoles = recipients ? recipients.filter(r => r.role).map(r => r.role) : [];
      if (targetRoles.length > 0) {
        await sendNotificationToRoles({
          roles: targetRoles,
          title,
          message,
          data: {
            notificationId: notification._id,
            eventId: notification.eventId || '',
            visitorId: visitorId || '',
            visitorType: visitorType || ''
          }
        });
      }

      // Also fallback to legacy user fcmToken matching
      const pushService = require('../utils/pushNotificationService');
      let targetUserTokens = [];

      if (recipients && recipients.length > 0) {
        const roleFilters = recipients.filter(r => r.role).map(r => r.role);
        const userIdFilters = recipients.filter(r => r.userId).map(r => r.userId);

        const query = {
          $or: [
            ...(roleFilters.length > 0 ? [{ role: { $in: roleFilters } }] : []),
            ...(userIdFilters.length > 0 ? [{ _id: { $in: userIdFilters } }] : [])
          ]
        };

        const targetUsers = await User.find(query);
        targetUsers.forEach(u => {
          if (u.fcmToken) targetUserTokens.push(u.fcmToken);
          if (u.fcmTokens && u.fcmTokens.length > 0) {
            u.fcmTokens.forEach(t => {
              if (t.token && !targetUserTokens.includes(t.token)) {
                targetUserTokens.push(t.token);
              }
            });
          }
        });
      }

      if (targetUserTokens.length > 0) {
        await pushService(targetUserTokens, title, message, {
          notificationId: notification._id.toString(),
          eventId: notification.eventId || '',
          visitorId: visitorId || '',
          visitorType: visitorType || ''
        });
      }
    } catch (pushErr) {
      console.error('FCM Push notification error in notificationService:', pushErr.message);
    }

    return notification;
  } catch (err) {
    console.error('Error creating central notification:', err);
    throw err;
  }
};

const VMS_NOTIFICATION_ROLES = [
  'Super Admin',
  'SaaS Super Admin',
  'Company Admin',
  'Admin',
  'MD',
  'HR',
  'Security'
];

module.exports = {
  createNotification,
  VMS_NOTIFICATION_ROLES
};
