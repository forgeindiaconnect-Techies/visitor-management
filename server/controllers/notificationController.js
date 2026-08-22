const Notification = require('../models/Notification');

exports.getNotifications = async (req, res) => {
  try {
    const role = req.userRole || req.user?.role || 'User';
    const userId = req.userId || req.user?.id || req.user?._id;
    const userCompanyId = req.companyId || req.user?.companyId || 'FIC001';

    let orConditions = [
      { recipient: null },
      { recipients: { $size: 0 } },
      { recipients: { $exists: false } },
      { recipients: null },
      { 'recipients.role': new RegExp(`^${role}$`, 'i') },
      { recipientRole: new RegExp(`^${role}$`, 'i') },
      { targetRole: new RegExp(`^${role}$`, 'i') },
      { roles: new RegExp(`^${role}$`, 'i') },
      { roles: { $in: [role] } }
    ];

    if (userId) {
      orConditions.push({ 'recipients.userId': String(userId) });
      orConditions.push({ 'recipients.user': userId });
      orConditions.push({ recipient: String(userId) });
      orConditions.push({ userId: String(userId) });
    }

    const companyRegex = new RegExp(`^${userCompanyId}$`, 'i');
    const query = {
      $and: [
        {
          $or: [
            { companyId: companyRegex },
            { companyId: 'SYSTEM' },
            { companyId: null },
            { companyId: { $exists: false } }
          ]
        },
        { $or: orConditions }
      ]
    };

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    res.status(200).json({
      success: true,
      notifications: Array.isArray(notifications) ? notifications : []
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
    const query = { _id: req.params.id };
    
    // Safety check if not SaaS Super Admin
    if (req.userRole !== 'SaaS Super Admin') {
       query.companyId = req.companyId;
    }

    const notification = await Notification.findOneAndUpdate(
      query,
      { isRead: true },
      { new: true }
    );
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    res.status(200).json(notification);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.markAllAsRead = async (req, res) => {
  try {
    const role = req.userRole;
    let query = { isRead: false };

    if (role !== 'SaaS Super Admin') {
       query.companyId = req.companyId;
       if (role === 'Security' || role === 'Admin' || role === 'MD') {
         query.branchId = req.branchId;
       }
    }

    await Notification.updateMany(query, { isRead: true });
    res.status(200).json({ message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteNotification = async (req, res) => {
  try {
    const query = { _id: req.params.id };
    
    if (req.userRole !== 'SaaS Super Admin') {
       query.companyId = req.companyId;
    }

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
