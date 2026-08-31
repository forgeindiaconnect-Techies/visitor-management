const Notification = require('../models/Notification');

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
  companyId,
  branchId = 'All Branches',
  io = null
}) => {
  try {
    const normalizedCompanyId = String(companyId || '').trim().toUpperCase();
    if (!normalizedCompanyId) {
      throw new Error('companyId is required when creating a notification');
    }

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
        companyId: normalizedCompanyId,
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

    // Broadcast only to the owning tenant (or SYSTEM for SaaS events).
    if (io) {
      const room = `company:${normalizedCompanyId}`;
      io.to(room).emit('notification-created', notification);
      io.to(room).emit('notification:new', notification);
      io.to(room).emit('notification:updated', { eventId, notification });
    }

    // Notification.js owns FCM dispatch and filters recipients by companyId.

    return notification;
  } catch (err) {
    console.error('Error creating central notification:', err);
    throw err;
  }
};

const VMS_NOTIFICATION_ROLES = [
  'Super Admin',
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
