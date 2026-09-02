const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Visitor = require('../models/Visitor');
const authMiddleware = require('../middleware/authMiddleware');
const logAction = require('../utils/auditLogger');
const getTenantFilter = require('../utils/tenantFilter');

// Public route to fetch HR users for dropdown (accessible without login)
router.get('/hr', async (req, res) => {
  try {
    const targetCompanyId = (req.query.companyId || req.headers['x-company-id'] || '').trim().toUpperCase();
    const query = {
      role: { $in: ['HR', 'MD', 'Admin', 'Company Admin', 'Super Admin', 'Senior HR', 'Employee'] },
      status: 'Active',
      name: { $nin: [/monika/i, /adithya/i, /adithiya/i, /test/i] }
    };
    if (targetCompanyId) {
      query.companyId = targetCompanyId;
    }
    const hrUsers = await User.find(query, 'name email role companyId');
    res.json({ success: true, data: hrUsers, users: hrUsers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.use(authMiddleware);

// Save FCM Token securely for authenticated user
router.put('/fcm-token', async (req, res) => {
  try {
    const user = await User.findOneAndUpdate(
      {
        _id: req.userId,
        companyId: req.companyId
      },
      {
        $set: {
          fcmToken: req.body.fcmToken
        }
      },
      {
        new: true
      }
    ).select("_id name companyId role");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found in this company"
      });
    }

    return res.json({
      success: true,
      message: "Notification device registered"
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Unable to save notification token"
    });
  }
});

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
    if (req.query.branch && req.query.branch !== 'All Branches') {
      query.branch = req.query.branch;
    }
    const users = await User.find(query)
      .select("-password")
      .sort({ createdAt: -1 });

    const sanitizedUsers = users.map(user => {
      const u = user.toJSON ? user.toJSON() : user;
      delete u.password;
      u.branch = u.branchId || u.branch;
      return u;
    });

    return res.json({
      success: true,
      count: sanitizedUsers.length,
      data: sanitizedUsers
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Unable to fetch users"
    });
  }
});

// GET single user
router.get('/:id', async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const u = user.toJSON();
    delete u.password;
    u.branch = u.branchId || u.branch;
    res.json(u);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/users/invite - Send one-time employee activation link
router.post('/invite', async (req, res) => {
  try {
    const loggedInCompanyId = req.companyId || req.user?.companyId;

    if (!loggedInCompanyId || loggedInCompanyId === 'SYSTEM') {
      return res.status(400).json({
        success: false,
        message: 'Unable to identify company for employee invitation'
      });
    }

    const { name, email, role, department, branch, mobileNumber } = req.body;

    if (!name || !email || !role) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and role are required'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if user already exists in this company
    const existingUser = await User.findOne({
      companyId: loggedInCompanyId,
      email: normalizedEmail
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'This email is already registered in your company'
      });
    }

    // Generate secure 24-hour setup token
    const crypto = require('crypto');
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const user = await User.create({
      name,
      email: normalizedEmail,
      mobileNumber: mobileNumber || '',
      password: await require('bcrypt').hash(crypto.randomBytes(16).toString('hex'), 12),
      role,
      department: department || 'General',
      branch: branch || 'Main Branch',
      branchId: branch || 'Main Branch',
      companyId: loggedInCompanyId,
      status: 'Active',
      mustSetPassword: true,
      passwordSetupTokenHash: tokenHash,
      passwordSetupExpiresAt: expiresAt,
      createdBy: req.userName || 'Company Super Admin'
    });

    // Send invitation email
    const Company = require('../models/Company');
    const company = await Company.findOne({ code: loggedInCompanyId });
    const { sendEmail } = require('../utils/emailService');

    const baseUrl = process.env.FRONTEND_URL || 'https://visitor-management-indol.vercel.app';
    const activationLink = `${baseUrl.replace(/\/$/, '')}/activate-account/${rawToken}`;

    await sendEmail({
      to: normalizedEmail,
      subject: `Employee Invitation - Set Up Your ${company?.name || 'Company'} Account`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
          <div style="background-color: #1E1B6E; color: white; padding: 24px; text-align: center;">
            <h2 style="margin: 0;">Account Invitation</h2>
            <p style="margin: 6px 0 0; color: #c7d2fe;">${company?.name || 'Zone Monitor'}</p>
          </div>
          <div style="padding: 24px; color: #334155;">
            <p>Hello <strong>${name}</strong>,</p>
            <p>You have been invited to join <strong>${company?.name || 'Zone Monitor'}</strong> as <strong>${role}</strong>.</p>
            <div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin: 16px 0;">
              <p style="margin: 4px 0;"><strong>Company Code:</strong> ${loggedInCompanyId}</p>
              <p style="margin: 4px 0;"><strong>Role:</strong> ${role}</p>
              <p style="margin: 4px 0;"><strong>Branch:</strong> ${branch || 'Main Branch'}</p>
              <p style="margin: 4px 0;"><strong>Email:</strong> ${normalizedEmail}</p>
            </div>
            <p>Click the button below to set up your password and activate your employee account. This secure link expires in 24 hours.</p>
            <div style="text-align: center; margin: 24px 0;">
              <a href="${activationLink}" style="background-color: #1E1B6E; color: white; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Activate Account</a>
            </div>
            <p style="font-size: 12px; color: #64748b;">If the button does not work, copy and paste this URL into your browser:<br/><a href="${activationLink}">${activationLink}</a></p>
          </div>
        </div>
      `
    });

    return res.status(201).json({
      success: true,
      message: `Invitation email sent to ${normalizedEmail}`,
      user,
      activationLink
    });
  } catch (error) {
    console.error('Employee invitation error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send invitation link'
    });
  }
});

// POST new user
router.post('/', async (req, res) => {
  try {
    const loggedInCompanyId =
      req.companyId || req.user?.companyId;

    if (
      !loggedInCompanyId ||
      loggedInCompanyId === "SYSTEM"
    ) {
      return res.status(400).json({
        success: false,
        message: "Unable to identify the company"
      });
    }

    const {
      name,
      email,
      password,
      role,
      department,
      branch,
      mobileNumber,
      createdBy
    } = req.body;

    const normalizedEmail = (email || '').trim().toLowerCase();

    // Check if email already exists in this company
    const existingUser = await User.findOne({
      companyId: loggedInCompanyId,
      email: normalizedEmail
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "This email already exists in your company"
      });
    }

    // Force branch if creator role is passed and not Super Admin
    let userBranch = branch;
    if (req.body.createdByRole && req.body.createdByRole !== 'Super Admin') {
      userBranch = req.body.creatorBranch || branch;
    }

    // Enforce Plan Limits for Security and Admin Staff
    if (['Security', 'Admin', 'Branch Admin', 'MD', 'Company Admin'].includes(role)) {
      const Company = require('../models/Company');
      const planLimits = require('../config/plans');
      const company = await Company.findOne({ code: loggedInCompanyId });
      if (company && company.subscription) {
        const limits = planLimits[company.subscription];

        if (role === 'Security' && limits && limits.securityUsers !== -1) {
          const count = await User.countDocuments({ companyId: loggedInCompanyId, role: 'Security' });
          if (count >= limits.securityUsers) {
            return res.status(403).json({
              success: false,
              message: `Maximum security users reached. Your current plan (${company.subscription}) only allows up to ${limits.securityUsers} security staff members. Please upgrade your plan.`
            });
          }
        }

        if (['Admin', 'Branch Admin', 'MD', 'Company Admin'].includes(role) && limits && limits.admins !== -1) {
          const count = await User.countDocuments({ companyId: loggedInCompanyId, role: { $in: ['Admin', 'Branch Admin', 'MD', 'Company Admin'] } });
          if (count >= limits.admins) {
            return res.status(403).json({
              success: false,
              message: `Maximum admin users reached. Your current plan (${company.subscription}) only allows up to ${limits.admins} admin members. Please upgrade your plan.`
            });
          }
        }
      }
    }

    const bcrypt = require("bcrypt");
    const hashedPassword = await bcrypt.hash(password || "123456", 12);

    const user = await User.create({
      name,
      email: normalizedEmail,
      mobileNumber: mobileNumber || '',
      password: hashedPassword,
      plainPassword: password,
      role,
      department,
      branch: userBranch,
      branchId: userBranch,
      companyId: loggedInCompanyId,
      status: req.body.status || 'Active',
      createdBy: createdBy || req.userName || 'Company Admin'
    });

    const safeUser = user.toObject();
    delete safeUser.password;
    safeUser.branch = safeUser.branchId || safeUser.branch;

    // Trigger Notification for User added to this company
    try {
      const Notification = require('../models/Notification');
      const newNotification = await Notification.create({
        eventId: `USER_CREATED_${user._id}`,
        companyId: loggedInCompanyId,
        branchId: user.branch || "All Branches",
        type: "USER_CREATED",
        module: "User Management",
        title: "New User Created",
        message: `${user.name} was added as ${user.role}.`,
        createdBy: String(req.userId),
        roles: [
          "Super Admin",
          "Company Admin",
          "Admin",
          "MD",
          "HR",
          "Senior HR"
        ]
      });

      const io = req.app.get('io');
      if (io) {
        io.to(`company:${loggedInCompanyId}`).emit(
          'new_notification',
          newNotification
        );
      }
    } catch (notifErr) {
      console.warn('Could not create notification for new user:', notifErr.message);
    }

    // Audit Log
    await logAction(req, `Added User`, 'User Management', {
      userId: req.user ? req.user._id : undefined,
      description: `User ${user.name} was added as ${user.role}`,
      status: 'Success'
    });

    return res.status(201).json({
      success: true,
      message: "User created successfully",
      data: safeUser,
      ...safeUser
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Unable to create user: " + error.message
    });
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
      { new: true, runValidators: true }
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
        io.to(`company:${superAdminNotif.companyId}`).emit('new_notification', superAdminNotif);

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
        io.to(`company:${newBranchNotif.companyId}`).emit('new_notification', newBranchNotif);
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
          io.to(`company:${blockNotif.companyId}`).emit('new_notification', blockNotif);
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
          io.to(`company:${unblockNotif.companyId}`).emit('new_notification', unblockNotif);
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
