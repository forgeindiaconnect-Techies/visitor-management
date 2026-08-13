const Notification = require('../models/Notification');

exports.getNotifications = async (req, res) => {
  try {
    const role = req.userRole;
    let query = {};

    // Role-based filtering based on Step 4 of user request
    if (role === 'SaaS Super Admin') {
      // SaaS Super Admin sees platform-level notifications AND notifications they sent
      query.$or = [
        { type: { $in: ['Tenant', 'Subscription', 'System', 'Branch', 'Admin', 'Announcement'] } },
        { createdBy: 'SaaS Super Admin' },
        { companyId: 'SYSTEM' },
        { recipient: req.userId }
      ];
    } else if (role === 'Super Admin') {
      // Tenant Super Admin sees everything for their own company
      query.companyId = req.companyId;
      query.$or = [
        { recipient: { $exists: false } },
        { recipient: null },
        { recipient: req.userId }
      ];
    } else if (role === 'Admin' || role === 'MD' || role === 'Company Admin') {
      // Admin sees their own branch
      query.companyId = req.companyId;
      query.branchId = req.branchId;
      query.$or = [
        { recipient: req.userId },
        {
          recipient: { $exists: false },
          type: { $nin: ['Attendance', 'PREBOOKING_CREATED', 'Visitor', 'visitor'] }
        }
      ];
    } else if (role === 'Security') {
      // Security sees their own branch
      query.companyId = req.companyId;
      query.branchId = req.branchId;
      query.$or = [
        { recipient: req.userId },
        {
          recipient: { $exists: false },
          type: { $nin: ['Attendance', 'PREBOOKING_CREATED', 'Visitor', 'visitor'] }
        }
      ];
    } else {
      // Fallback (like HR)
      query.companyId = req.companyId;
      query.$or = [
        { recipient: req.userId },
        {
          recipient: { $exists: false },
          type: { $nin: ['Attendance', 'PREBOOKING_CREATED', 'Visitor', 'visitor'] }
        }
      ];
    }

    // Explicit query overrides
    if (req.query.companyId && role === 'SaaS Super Admin') {
        query.companyId = req.query.companyId;
    }
    
    if (req.query.branchId || req.query.branch) {
      const b = req.query.branchId || req.query.branch;
      if (role === 'SaaS Super Admin' || role === 'Super Admin') {
         query.branchId = b;
      }
    }
    
    if (req.query.type) {
      query.type = req.query.type;
    }

    const notifications = await Notification.find(query).sort({ createdAt: -1 });
    res.status(200).json(notifications);
  } catch (error) {
    res.status(500).json({ message: error.message });
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

exports.clearAllNotifications = async (req, res) => {
  try {
    const { role, companyId: userCompanyId, branch: userBranch } = req.user || {};
    let query = {};

    if (role !== 'SaaS Super Admin' && role !== 'Super Admin') {
       query.companyId = req.companyId || userCompanyId;
       if (role === 'Branch Admin' || role === 'Security') {
         query.branchId = userBranch;
       }
    }

    await Notification.deleteMany(query);
    res.status(200).json({ message: 'All notifications cleared' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
