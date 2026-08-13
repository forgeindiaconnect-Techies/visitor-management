const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Visitor = require('../models/Visitor');
const authMiddleware = require('../middleware/authMiddleware');
const logAction = require('../utils/auditLogger');

// Public route to fetch HR users for dropdown (accessible without login)
router.get('/hr', async (req, res) => {
  try {
    const hrUsers = await User.find({
      role: { $in: ['HR', 'MD', 'Admin', 'Company Admin', 'Employee'] },
      status: 'Active',
      name: { $nin: [/monika/i, /adithya/i, /adithiya/i, /test/i] }
    }, 'name email role');
    res.json({ success: true, data: hrUsers, users: hrUsers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.use(authMiddleware);

// GET branch summary
router.get('/branch-summary', async (req, res) => {
  try {
    const branch = req.query.branch;
    if (!branch) {
      return res.status(400).json({ message: 'Branch query parameter is required' });
    }

    const security = await User.countDocuments({ companyId: req.companyId, role: 'Security', branch });
    const admins = await User.countDocuments({ companyId: req.companyId, role: { $in: ['Admin', 'Branch Admin', 'MD'] }, branch });
    const visitors = await Visitor.countDocuments({ companyId: req.companyId, branch });

    res.json({ security, admins, visitors });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Temp route
router.get('/fix-branches', async (req, res) => {
  try {
    await User.updateMany({ branch: 'Thirupathur' }, { $set: { branch: 'Tirupattur' } });
    await User.updateMany({ branch: 'Dharmapuri (Palakodu)' }, { $set: { branch: 'Salem' } });
    await User.updateMany({ branch: 'Bangalore' }, { $set: { branch: 'Chennai' } });

    await Visitor.updateMany({ branch: 'Thirupathur' }, { $set: { branch: 'Tirupattur' } });
    await Visitor.updateMany({ branch: 'Dharmapuri (Palakodu)' }, { $set: { branch: 'Salem' } });
    await Visitor.updateMany({ branch: 'Bangalore' }, { $set: { branch: 'Chennai' } });
    res.json({ message: 'Branches fixed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET all users
router.get('/', async (req, res) => {
  try {
    let query = { companyId: req.companyId };
    if (req.query.branch) {
      query.branch = req.query.branch;
    }
    const users = await User.find(query).sort({ createdAt: -1 });
    // Remove passwords before sending to frontend
    const sanitizedUsers = users.map(user => {
      const u = user.toJSON();
      delete u.password;
      u.branch = u.branchId;
      return u;
    });
    res.json(sanitizedUsers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET single user
router.get('/:id', async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const u = user.toJSON();
    delete u.password;
    u.branch = u.branchId;
    res.json(u);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST new user
router.post('/', async (req, res) => {
  try {
    // Check if email already exists
    const existingUser = await User.findOne({ email: req.body.email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already exists' });
    }

    // Force branch if creator role is passed and not Super Admin
    let userBranch = req.body.branch;
    if (req.body.createdByRole && req.body.createdByRole !== 'Super Admin') {
      userBranch = req.body.creatorBranch || req.body.branch;
    }

    // Enforce Plan Limits for Security and Admin Staff
    if (['Security', 'Admin', 'Branch Admin', 'MD', 'Company Admin'].includes(req.body.role)) {
      const Company = require('../models/Company');
      const planLimits = require('../config/plans');
      const company = await Company.findOne({ code: req.companyId });
      if (company && company.subscription) {
        const limits = planLimits[company.subscription];

        if (req.body.role === 'Security' && limits && limits.securityUsers !== -1) {
          const count = await User.countDocuments({ companyId: req.companyId, role: 'Security' });
          if (count >= limits.securityUsers) {
            return res.status(403).json({
              message: `Maximum security users reached. Your current plan (${company.subscription}) only allows up to ${limits.securityUsers} security staff members. Please upgrade your plan.`
            });
          }
        }

        if (['Admin', 'Branch Admin', 'MD', 'Company Admin'].includes(req.body.role) && limits && limits.admins !== -1) {
          const count = await User.countDocuments({ companyId: req.companyId, role: { $in: ['Admin', 'Branch Admin', 'MD', 'Company Admin'] } });
          if (count >= limits.admins) {
            return res.status(403).json({
              message: `Maximum admin users reached. Your current plan (${company.subscription}) only allows up to ${limits.admins} admin members. Please upgrade your plan.`
            });
          }
        }
      }
    }

    const user = new User({
      companyId: req.companyId,
      name: req.body.name,
      email: req.body.email,
      mobileNumber: req.body.mobileNumber,
      password: req.body.password, // Plain text as requested for testing
      role: req.body.role,
      branch: userBranch,
      status: req.body.status || 'Active',
      createdBy: req.body.createdBy
    });

    const newUser = await user.save();

    // Trigger Notification for User added
    if (newUser.role === 'Admin' || newUser.role === 'Branch Admin' || newUser.role === 'Security') {
      const Notification = require('../models/Notification');
      const typeStr = newUser.role === 'Security' ? 'Security' : 'Admin';
      const titleStr = newUser.role === 'Security' ? '👮 Security Added' : '👤 Admin Added';
      const newNotification = await Notification.create({
        companyId: req.companyId,
        branchId: newUser.branch,
        type: 'success',
        module: 'Users',
        title: titleStr,
        message: `${newUser.name} was added as ${newUser.role} for ${newUser.branchId} Branch.`,
        createdBy: req.body.createdBy || 'System'
      });
      const io = req.app.get('io');
      if (io) {
        io.emit('new_notification', newNotification);
      }
    }

    // Audit Log
    await logAction(req, `Added User`, 'User Management', {
      userId: req.user ? req.user._id : undefined,
      description: `User ${newUser.name} was added as ${newUser.role}`,
      status: 'Success'
    });

    const u = newUser.toJSON();
    delete u.password;
    u.branch = u.branchId;
    res.status(201).json(u);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PATCH update user
router.patch('/:id', async (req, res) => {
  try {
    const AuditLog = require('../models/AuditLog');
    const Notification = require('../models/Notification');
    const oldUser = await User.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!oldUser) return res.status(404).json({ message: 'User not found' });

    const updatedUser = await User.findOneAndUpdate(
      { _id: req.params.id, companyId: req.companyId },
      { $set: req.body },
      { new: true }
    );

    // Audit & Notifications
    const performedBy = req.headers['x-user-role'] === 'Super Admin' ? 'SaaS Super Admin' : 'Admin';

    if (req.body.branch && req.body.branch !== oldUser.branch) {
      await AuditLog.create({
        companyId: req.companyId,
        userId: updatedUser._id,
        userName: updatedUser.name,
        action: 'Branch Changed',
        details: `${updatedUser.name} moved from ${oldUser.branch} to ${updatedUser.branch}`,
        performedBy
      });

      // Notification to Super Admin
      const io = req.app.get('io');
      if (io) {
        const superAdminNotif = await Notification.create({
          companyId: req.companyId,
          branchId: 'All Branches',
          type: 'info',
          module: 'Users',
          title: 'User Transfer',
          message: `User transferred successfully. ${updatedUser.name} moved from ${oldUser.branch} to ${updatedUser.branch}.`,
          createdBy: performedBy
        });
        io.emit('new_notification', superAdminNotif);

        // Notification to New Branch
        const newBranchNotif = await Notification.create({
          companyId: req.companyId,
          branchId: updatedUser.branch,
          type: 'info',
          module: 'Users',
          title: 'New User Assigned',
          message: `${updatedUser.name} has been assigned to ${updatedUser.branch} Branch.`,
          createdBy: performedBy
        });
        io.emit('new_notification', newBranchNotif);
      }
    }

    if (req.body.status && req.body.status !== oldUser.status) {
      const isBlocking = req.body.status === 'Blocked';
      const isUnblocking = oldUser.status === 'Blocked' && req.body.status === 'Active';
      const reasonText = isBlocking && req.body.statusReason ? ` Reason: ${req.body.statusReason}` : '';

      await AuditLog.create({
        companyId: req.companyId,
        userId: updatedUser._id,
        userName: updatedUser.name,
        action: isBlocking ? 'Blocked' : 'Status Changed',
        details: isBlocking
          ? `${updatedUser.name} was blocked.${reasonText}`
          : `${updatedUser.name} status changed from ${oldUser.status} to ${updatedUser.status}`,
        performedBy
      });

      const io = req.app.get('io');
      if (io) {
        if (isBlocking) {
          // Notify Branch Admin
          const blockNotif = await Notification.create({
            companyId: req.companyId,
            branchId: updatedUser.branch,
            type: 'warning',
            module: 'Users',
            title: 'Security Account Blocked',
            message: `Security user ${updatedUser.name} was blocked by Super Admin.${reasonText}`,
            createdBy: performedBy
          });
          io.emit('new_notification', blockNotif);
        } else if (isUnblocking) {
          // Notify Branch Admin
          const unblockNotif = await Notification.create({
            companyId: req.companyId,
            branchId: updatedUser.branch,
            type: 'success',
            module: 'Users',
            title: 'Security Account Unblocked',
            message: `Security user ${updatedUser.name} was unblocked by Super Admin.`,
            createdBy: performedBy
          });
          io.emit('new_notification', unblockNotif);
        }
      }
    }

    const u = updatedUser.toJSON();
    delete u.password;
    u.branch = u.branchId;
    res.json(u);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE user (or soft delete)
router.delete('/:id', async (req, res) => {
  try {
    const user = await User.findOneAndDelete({ _id: req.params.id, companyId: req.companyId });
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
