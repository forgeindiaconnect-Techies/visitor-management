const Notification = require('../models/Notification');

exports.getNotifications = async (req, res) => {
  try {
    const role = req.userRole || req.user?.role || 'User';
    const userId = req.userId || req.user?.id || req.user?._id;
    const userCompanyId = req.companyId || req.user?.companyId || 'FIC001';

    const isSuperOrAdmin = ['Super Admin', 'SaaS Super Admin', 'Admin', 'Branch Admin', 'MD'].includes(role);
    const companyRegex = new RegExp(`^${userCompanyId}$`, 'i');

    // All dashboards have complete company notification visibility from starting to ending
    const query = {
      $or: [
        { companyId: companyRegex },
        { companyId: 'SYSTEM' },
        { companyId: null },
        { companyId: { $exists: false } }
      ]
    };
    // Auto-create/sync missing registration notifications for pending prebookings & direct visits
    try {
      const PreBooking = require('../models/PreBooking');
      const Visitor = require('../models/Visitor');
      
      const [pendingPBs, pendingVis] = await Promise.all([
        PreBooking.find({ status: { $in: ['PENDING', 'Pending', 'PENDING APPROVAL', 'Pending Approval'] } }).lean(),
        Visitor.find({ status: { $in: ['PENDING', 'Pending', 'PENDING APPROVAL', 'Pending Approval'] } }).lean()
      ]);

      const syncPromises = [];
      const testRegex = /^(test|test 1|test 3|lokeee)$/i;

      for (const pb of (pendingPBs || [])) {
        const nameCap = pb.fullName || pb.visitorName || 'Visitor';
        if (testRegex.test(nameCap)) continue;

        const isRet = Boolean(pb.isReturning || pb.returningVisitor);
        const eventId = `REGISTERED_${pb._id}`;
        
        syncPromises.push(
          Notification.findOneAndUpdate(
            { eventId },
            {
              $setOnInsert: {
                eventId,
                companyId: pb.companyId || userCompanyId || 'FIC001',
                branchId: pb.branchLocation || pb.branch,
                roles: ['Super Admin', 'SaaS Super Admin', 'Admin', 'Branch Admin', 'MD', 'Senior HR', 'HR', 'Security', 'Receptionist'],
                visitorId: pb.visitorId || null,
                visitorName: nameCap,
                preBookingId: pb._id,
                type: 'Visitor',
                module: 'PreBooking',
                title: isRet ? 'A Returning Visitor Request Received' : 'A New Visitor Request Received',
                message: `${isRet ? 'Returning' : 'New'} visitor ${nameCap} waiting for approval`,
                isRead: false,
                createdAt: pb.createdAt || new Date()
              }
            },
            { upsert: true }
          )
        );
      }

      for (const v of (pendingVis || [])) {
        const nameCap = v.visitorName || v.fullName || 'Visitor';
        if (testRegex.test(nameCap)) continue;

        const isRet = Boolean(v.isReturning || v.returningVisitor);
        const eventId = `DIRECT_VISIT_CREATED_${v._id}`;
        
        syncPromises.push(
          Notification.findOneAndUpdate(
            { eventId },
            {
              $setOnInsert: {
                eventId,
                companyId: v.companyId || userCompanyId || 'FIC001',
                branchId: v.branchLocation || v.branch,
                roles: ['Super Admin', 'SaaS Super Admin', 'Admin', 'Branch Admin', 'MD', 'Senior HR', 'HR', 'Security', 'Receptionist'],
                visitorId: v.visitorId || v.visitId || null,
                visitorName: nameCap,
                type: 'Visitor',
                module: 'Visitors',
                title: isRet ? 'A Returning Visitor Request Received' : 'A New Visitor Request Received',
                message: `${isRet ? 'Returning' : 'New'} visitor ${nameCap} waiting for approval`,
                isRead: false,
                createdAt: v.createdAt || new Date()
              }
            },
            { upsert: true }
          )
        );
      }

      if (syncPromises.length > 0) {
        await Promise.all(syncPromises);
      }
    } catch (syncErr) {
      console.warn('Sync pending notifications warning:', syncErr.message);
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    const PreBooking = require('../models/PreBooking');
    const Visitor = require('../models/Visitor');
    
    // Find strictly returning records
    const returningPBs = await PreBooking.find({
      $or: [
        { registrationType: 'Returning' },
        { isReturning: true },
        { returningVisitor: true }
      ]
    }, 'fullName visitorName mobileNumber').lean();
    
    const returningVis = await Visitor.find({
      $or: [
        { registrationType: 'Returning' },
        { isReturning: true },
        { returningVisitor: true }
      ]
    }, 'visitorName fullName mobileNumber').lean();

    const returningNameSet = new Set();
    for (const r of [...(returningPBs || []), ...(returningVis || [])]) {
      const name = (r.fullName || r.visitorName || '').trim().toLowerCase();
      if (name) returningNameSet.add(name);
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

        // Strictly check if candidate was registered via Returning Visitor flow
        const visitorRawName = (n.visitorName || '').trim().toLowerCase();
        const isReturningVisitor = Boolean(
          (n.registrationType === 'Returning') ||
          (visitorRawName && returningNameSet.has(visitorRawName))
        );

        const rawName = n.visitorName || 'Visitor';
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
