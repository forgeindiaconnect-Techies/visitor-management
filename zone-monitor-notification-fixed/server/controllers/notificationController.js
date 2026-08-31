const Notification = require('../models/Notification');

const buildNotificationFilter = (req) => {
  if (req.userRole === 'SaaS Super Admin') return { companyId: 'SYSTEM' };

  const userId = String(req.userId || req.user?.id || req.user?._id || '');
  return {
    companyId: req.companyId,
    $or: [
      { recipient: req.userId },
      { 'recipients.user': req.userId },
      { 'recipients.userId': userId },
      { roles: req.userRole },
      {
        recipient: { $exists: false },
        recipients: { $size: 0 },
        roles: { $size: 0 }
      }
    ]
  };
};

exports.getNotifications = async (req, res) => {
  try {
    const userId = req.userId || req.user?.id || req.user?._id;
    const filter = buildNotificationFilter(req);

    const rawNotifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    // Preserve isRead dynamic calculation for frontend compatibility
    const notifications = rawNotifications.map(n => ({
      ...n,
      isRead: n.readBy && n.readBy.some(r => r.userId === String(userId))
    }));

    return res.json({
      success: true,
      count: notifications.length,
      notifications: notifications,
      data: notifications
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      notifications: [],
      message: 'Unable to load notifications'
    });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const userId = req.userId || req.user?.id || req.user?._id;
    const query = {
      _id: req.params.id,
      companyId: req.userRole === 'SaaS Super Admin' ? 'SYSTEM' : req.companyId
    };

    const notification = await Notification.findOneAndUpdate(
      query,
      {
        $addToSet: {
          readBy: {
            userId: String(userId),
            readAt: new Date()
          }
        }
      },
      { new: true }
    ).lean();

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    
    notification.isRead = true;
    res.status(200).json(notification);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.markAllAsRead = async (req, res) => {
  try {
    const filter = buildNotificationFilter(req);

    await Notification.updateMany(filter, {
      $addToSet: {
        readBy: {
          userId: String(req.userId || req.user?.id || req.user?._id),
          readAt: new Date()
        }
      }
    });

    return res.json({
      success: true,
      message: "Notifications marked as read"
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Unable to mark notifications as read"
    });
  }
};

exports.deleteNotification = async (req, res) => {
  try {
    const query = {
      _id: req.params.id,
      companyId: req.userRole === 'SaaS Super Admin' ? 'SYSTEM' : req.companyId
    };

    const notification = await Notification.findOneAndDelete(query);
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    res.status(200).json({ message: 'Notification deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.registerFcmToken = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, message: 'FCM token is required.' });
    }

    const userId = req.userId || req.user?.id || req.user?._id;
    const role = req.userRole || req.user?.role || 'User';

    if (userId) {
      const User = require('../models/User');
      await User.findByIdAndUpdate(userId, {
        fcmToken: token,
        $addToSet: {
          fcmTokens: {
            token,
            createdAt: new Date(),
            lastUsedAt: new Date()
          }
        }
      });

      const FCMToken = require('../models/FCMToken');
      await FCMToken.findOneAndUpdate(
        { token },
        {
          userId,
          role,
          token,
          lastUsedAt: new Date()
        },
        { upsert: true, new: true }
      );
    }

    return res.status(200).json({ success: true, message: 'FCM token registered successfully.' });
  } catch (err) {
    console.error('Error registering FCM token:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};
