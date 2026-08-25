const Notification = require('../models/Notification');

exports.getNotifications = async (req, res) => {
  try {
    const role = req.userRole || req.user?.role || 'User';
    const userId = req.userId || req.user?.id || req.user?._id;
    const userCompanyId = req.companyId || req.user?.companyId || 'FIC001';

    const isSuperOrAdmin = ['Super Admin', 'SaaS Super Admin', 'Admin', 'Branch Admin', 'MD'].includes(role);
    const companyRegex = new RegExp(`^${userCompanyId}$`, 'i');

    let query;
    if (isSuperOrAdmin) {
      // Super Admins, Admins, and MDs have company-wide notification visibility
      query = {
        $or: [
          { companyId: companyRegex },
          { companyId: 'SYSTEM' },
          { companyId: null },
          { companyId: { $exists: false } }
        ]
      };
    } else {
      let orConditions = [
        { recipient: null },
        { recipient: { $exists: false } },
        { recipients: { $exists: false } },
        { recipients: null },
        { 'recipients.role': new RegExp(`^${role}$`, 'i') },
        { recipientRole: new RegExp(`^${role}$`, 'i') },
        { targetRole: new RegExp(`^${role}$`, 'i') },
        { roles: { $in: [role, 'All', 'ALL'] } },
        { roles: new RegExp(role, 'i') }
      ];

      if (userId) {
        orConditions.push({ 'recipients.userId': String(userId) });
        orConditions.push({ recipient: String(userId) });
        orConditions.push({ userId: String(userId) });
        if (require('mongoose').isValidObjectId(userId)) {
          orConditions.push({ 'recipients.user': userId });
        }
      }

      query = {
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
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    // Check returning visitors across recent prebookings and direct visitors
    const PreBooking = require('../models/PreBooking');
    const Visitor = require('../models/Visitor');
    const [allPreBookings, allVisitors] = await Promise.all([
      PreBooking.find({}, 'fullName mobileNumber isReturning returningVisitor').lean(),
      Visitor.find({}, 'visitorName fullName mobileNumber isReturning returningVisitor').lean()
    ]);

    const visitorNameCounts = {};
    const returningNameSet = new Set();

    for (const pb of (allPreBookings || [])) {
      const nameKey = (pb.fullName || '').trim().toLowerCase();
      if (nameKey) {
        visitorNameCounts[nameKey] = (visitorNameCounts[nameKey] || 0) + 1;
        if (pb.isReturning || pb.returningVisitor) returningNameSet.add(nameKey);
      }
    }

    for (const v of (allVisitors || [])) {
      const nameKey = (v.visitorName || v.fullName || '').trim().toLowerCase();
      if (nameKey) {
        visitorNameCounts[nameKey] = (visitorNameCounts[nameKey] || 0) + 1;
        if (v.isReturning || v.returningVisitor) returningNameSet.add(nameKey);
      }
    }

    for (const [name, count] of Object.entries(visitorNameCounts)) {
      if (count > 1) {
        returningNameSet.add(name);
      }
    }

    // Also scan existing notification titles/messages for any marked as "Returning"
    for (const n of (Array.isArray(notifications) ? notifications : [])) {
      if (n) {
        const title = (n.title || '').toLowerCase();
        const msg = (n.message || '').toLowerCase();
        if (title.includes('returning') || msg.includes('returning') || n.isReturning || n.returningVisitor) {
          let vName = (n.visitorName || '').trim().toLowerCase();
          if (!vName && n.message) {
            const m = n.message.match(/(?:for|visitor)\s+([A-Za-z0-9\s]+?)(?:\s+waiting|\s+has\s+been|\s+has\s+arrived|\s+has\s+checked|\s+was|\s+to|\.|$)/i);
            if (m) vName = m[1].trim().toLowerCase();
          }
          if (vName) returningNameSet.add(vName);
        }
      }
    }

    const cleanedNotifications = (Array.isArray(notifications) ? notifications : []).map(n => {
      if (n && typeof n.message === 'string') {
        n.message = n.message
          .replace(/vaideeswari[\.\s]*2007/gi, 'Vaideeswari')
          .replace(/([\w\s]+)\.\s*\d{4}(\s+has|\s+was|\s+is|\.)/gi, (match, p1, p2) => `${p1.trim()}${p2}`);

        const dashMatch = n.message.match(/^([A-Za-z\s]+)\s*—\s*(\d{1,2}\s+[A-Za-z]+\s+\d{4},?\s*.*)$/);
        if (dashMatch && (n.title?.includes('Reschedule') || n.title?.includes('Appointment'))) {
          const visitorName = n.visitorName || n.visitorId || 'Visitor';
          n.message = `${dashMatch[1].trim()} has rescheduled the appointment for visitor ${visitorName} to ${dashMatch[2]}.`;
        }

        // Extract visitor name from message or properties
        let detectedVisitorName = (n.visitorName || '').trim().toLowerCase();
        if (!detectedVisitorName) {
          const matchFor = n.message.match(/(?:for|visitor)\s+([A-Za-z0-9\s]+?)(?:\s+waiting|\s+has\s+been|\s+has\s+arrived|\s+has\s+checked|\s+was|\s+to|\.|$)/i);
          if (matchFor) {
            detectedVisitorName = matchFor[1].trim().toLowerCase();
          }
        }

        const isReturningVisitor = Boolean(
          n.isReturning || 
          n.returningVisitor || 
          (detectedVisitorName && returningNameSet.has(detectedVisitorName)) ||
          (detectedVisitorName && visitorNameCounts[detectedVisitorName] && visitorNameCounts[detectedVisitorName] > 1)
        );

        const rawName = n.visitorName || detectedVisitorName || 'Visitor';
        const nameCap = rawName.charAt(0).toUpperCase() + rawName.slice(1);

        // 1. Check In & Check Out Notifications
        if (
          n.title?.includes('Checked In') || 
          n.message?.includes('checked in') || 
          n.message?.includes('has arrived')
        ) {
          n.title = 'Visitor Checked In';
          n.message = `Visitor ${nameCap} has arrived and checked in.`;
        }
        else if (
          n.title?.includes('Checked Out') || 
          n.message?.includes('checked out')
        ) {
          n.title = 'Visitor Checked Out';
          n.message = `Visitor ${nameCap} has checked out.`;
        }
        // 2. Approved Notifications
        else if (
          n.title?.includes('Approved') || 
          n.message?.includes('approved') || 
          n.message?.includes('has been approved')
        ) {
          if (isReturningVisitor) {
            n.title = 'Returning Pre-Booking Approved';
            n.message = n.message
              .replace(/^Visitor pre-booking for/i, 'Returning visitor pre-booking for')
              .replace(/^New pre-booking for/i, 'Returning visitor pre-booking for')
              .replace(/^New visitor pre-booking for/i, 'Returning visitor pre-booking for');
          } else {
            n.title = 'Pre-Booking Approved';
            n.message = n.message
              .replace(/^Returning visitor pre-booking for/i, 'Visitor pre-booking for')
              .replace(/^New visitor pre-booking for/i, 'Visitor pre-booking for');
          }
        }
        // 3. Rejected Notifications
        else if (
          n.title?.includes('Rejected') || 
          n.message?.includes('rejected') || 
          n.message?.includes('has been rejected')
        ) {
          if (isReturningVisitor) {
            n.title = 'Returning Pre-Booking Rejected';
            n.message = n.message
              .replace(/^Visitor pre-booking for/i, 'Returning visitor pre-booking for')
              .replace(/^New pre-booking for/i, 'Returning visitor pre-booking for');
          } else {
            n.title = 'Pre-Booking Rejected';
          }
        }
        // 4. Rescheduled Notifications
        else if (
          n.title?.includes('Rescheduled') || 
          n.title?.includes('Appointment') || 
          n.message?.includes('rescheduled')
        ) {
          if (isReturningVisitor) {
            n.title = 'Returning Appointment Rescheduled';
            n.message = n.message
              .replace(/for visitor/i, 'for returning visitor')
              .replace(/for new visitor/i, 'for returning visitor');
          } else {
            n.title = 'Appointment Rescheduled';
            n.message = n.message.replace(/for returning visitor/i, 'for visitor');
          }
        }
        // 5. New Request / Registration Notifications
        else if (isReturningVisitor) {
          n.title = 'A Returning Visitor Request Received';
          n.message = `Returning visitor ${nameCap} waiting for approval`;
        } else {
          n.title = 'A New Visitor Request Received';
          n.message = `New visitor ${nameCap} waiting for approval`;
        }
      }
      return n;
    });

    res.status(200).json({
      success: true,
      notifications: cleanedNotifications
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
