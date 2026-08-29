const express = require('express');
const router = express.Router();
const Company = require('../models/Company');
const User = require('../models/User');
const Visitor = require('../models/Visitor');
const authMiddleware = require('../middleware/authMiddleware');
const logAction = require('../utils/auditLogger');

// Require SaaS Super Admin role for all super-admin endpoints
router.use(authMiddleware);
router.use((req, res, next) => {
  if (req.userRole !== 'SaaS Super Admin') {
    return res.status(403).json({ message: 'Forbidden: SaaS Super Admin access required' });
  }
  next();
});

// GET all companies (with counts)
router.get('/companies', async (req, res) => {
  try {
    const companies = await Company.find().sort({ createdAt: -1 });
    const BranchSetting = require('../models/BranchSetting');
    const PreBooking = require('../models/PreBooking');
    const planLimits = require('../config/plans');

    const enriched = await Promise.all(companies.map(async (comp) => {
      const [adminUser, userCount, securityCount, visitorCount, branchCount, preBookingCount] = await Promise.all([
        User.findOne({ companyId: comp.code, role: { $in: ['Super Admin', 'Company Admin'] } }).select('email'),
        User.countDocuments({ companyId: comp.code }),
        User.countDocuments({ companyId: comp.code, role: 'Security' }),
        Visitor.countDocuments({ companyId: comp.code }),
        BranchSetting.countDocuments({ companyId: comp.code }),
        PreBooking.countDocuments({ companyId: comp.code })
      ]);
      const limits = planLimits[comp.subscription] || planLimits['Basic'];

      return {
        ...comp.toJSON(),
        _id: comp._id.toString(),  // Explicitly include _id for frontend operations
        companyId: comp.code,
        companyName: comp.name,
        adminEmail: adminUser ? adminUser.email : 'N/A',
        plan: comp.subscription,
        status: comp.status,
        expiryDate: comp.subscriptionExpiresAt,
        branchCount,
        userCount,
        securityCount,
        visitorCount,
        preBookingCount,
        limits
      };
    }));

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH update company details
router.patch('/companies/:id', async (req, res) => {
  try {
    const { name, subscription, status, subscriptionExpiresAt, durationDays } = req.body;
    const comp = await Company.findById(req.params.id);
    if (!comp) return res.status(404).json({ message: 'Company not found' });

    let statusChanged = false;
    let subscriptionChanged = false;
    let oldPlan = comp.subscription;
    let newExpiry = subscriptionExpiresAt ? new Date(subscriptionExpiresAt) : comp.subscriptionExpiresAt;

    if (name !== undefined && comp.name !== name) {
      comp.name = name;
    }

    if (subscription !== undefined && comp.subscription !== subscription) {
      comp.subscription = subscription;
      subscriptionChanged = true;
    }

    if (durationDays) {
      if (comp.subscriptionExpiresAt && comp.status !== 'Expired' && new Date(comp.subscriptionExpiresAt) > new Date()) {
        newExpiry = new Date(comp.subscriptionExpiresAt);
      } else {
        newExpiry = new Date();
      }
      newExpiry.setDate(newExpiry.getDate() + parseInt(durationDays, 10));
      comp.subscriptionExpiresAt = newExpiry;
      subscriptionChanged = true;

      // If we are extending, ensure status becomes active
      if (comp.status === 'Expired') {
        comp.status = 'Active';
        statusChanged = true;
      }
    } else if (subscriptionExpiresAt !== undefined) {
      comp.subscriptionExpiresAt = newExpiry;
    }

    if (status !== undefined && comp.status !== status) {
      comp.status = status;
      statusChanged = true;
    }

    if (subscriptionChanged) {
      comp.upgradeHistory.push({
        plan: comp.subscription,
        startDate: new Date(),
        endDate: comp.subscriptionExpiresAt,
        updatedBy: req.userRole || 'SaaS Super Admin'
      });

      // Calculate amount based on config
      const planLimits = require('../config/plans');
      const planPrice = planLimits[comp.subscription]?.price || 0;
      let durationMultiplier = 1;
      if (durationDays) {
        if (parseInt(durationDays, 10) === 90) durationMultiplier = 3;
        else if (parseInt(durationDays, 10) === 365) durationMultiplier = 12;
      }

      const Payment = require('../models/Payment');
      const invoiceNo = `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const amount = planPrice * durationMultiplier;
      const gst = Math.round(amount * 0.18);
      await Payment.create({
        invoiceNo,
        companyId: comp.code,
        companyName: comp.name,
        plan: comp.subscription,
        amount: amount,
        gst: gst,
        total: amount + gst,
        expiryDate: comp.subscriptionExpiresAt,
        durationDays: parseInt(durationDays || 30, 10),
        processedBy: req.userRole || 'SaaS Super Admin',
        status: 'Paid'
      });
    }

    await comp.save();

    // Trigger Notifications for SaaS Super Admin
    const Notification = require('../models/Notification');
    const io = req.app.get('io');

    if (statusChanged) {
      const typeStr = status === 'Active' ? 'Subscription Activated' : 'Subscription Deactivated';
      const icon = status === 'Active' ? '✅' : '❌';
      const newNotif = await Notification.create({
        companyId: 'SYSTEM',
        type: status === 'Active' ? 'success' : 'warning',
        module: 'Subscription',
        title: `${icon} ${typeStr}`,
        message: `${comp.name} subscription has been ${status.toLowerCase()}.`,
        createdBy: req.userRole || 'System'
      });
      if (io) io.emit('new_notification', newNotif);
    } else if (subscriptionChanged) {
      const newNotif = await Notification.create({
        companyId: 'SYSTEM',
        type: 'info',
        module: 'Subscription',
        title: '💳 Subscription Updated',
        message: `${comp.name} updated to ${comp.subscription} plan. Payment recorded.`,
        createdBy: req.userRole || 'System'
      });
      if (io) io.emit('new_notification', newNotif);

      // Also notify the tenant
      const tenantNotif = await Notification.create({
        companyId: comp.code,
        type: 'success',
        module: 'Subscription',
        title: '💳 Subscription Renewed',
        message: `Your subscription has been successfully renewed to the ${comp.subscription} plan.`,
        createdBy: 'System'
      });
      if (io) io.emit('new_notification', tenantNotif);

      // Audit log
      await logAction(req, `Subscription Upgraded`, 'Subscription', {
        companyId: comp.code,
        companyName: comp.name,
        userId: req.user ? req.user._id : undefined,
        description: `Subscription upgraded to ${comp.subscription} for company ${comp.name}`,
        status: 'Success'
      });
    } else {
      const newNotif = await Notification.create({
        companyId: 'SYSTEM',
        type: 'info',
        module: 'Company',
        title: '🏢 Tenant Updated',
        message: `${comp.name} details have been updated.`,
        createdBy: req.userRole || 'System'
      });
      if (io) io.emit('new_notification', newNotif);
    }

    res.json(comp);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE company and all associated data (cascade delete)
router.delete('/companies/:id', async (req, res) => {
  try {
    const comp = await Company.findById(req.params.id);
    if (!comp) return res.status(404).json({ message: 'Company not found' });

    // Protect system-level companies from deletion
    if (comp.code === 'SYSTEM' || comp.code === 'FIC001') {
      return res.status(403).json({ message: `The '${comp.code}' company cannot be deleted as it is a system-protected tenant.` });
    }

    const Blacklist = require('../models/Blacklist');
    const Zone = require('../models/Zone');
    const Notification = require('../models/Notification');

    // Cascade-delete all data belonging to this tenant
    await Promise.all([
      User.deleteMany({ companyId: comp.code }),
      Visitor.deleteMany({ companyId: comp.code }),
      Blacklist.deleteMany({ companyId: comp.code }).catch(() => { }),
      Zone.deleteMany({ companyId: comp.code }).catch(() => { }),
      Notification.deleteMany({ companyId: comp.code }).catch(() => { }),
    ]);

    await Company.findByIdAndDelete(req.params.id);

    // Trigger Notification for Tenant Deleted
    const newNotification = await Notification.create({
      companyId: 'SYSTEM',
      type: 'warning',
      module: 'Company',
      title: '🗑 Tenant Deleted',
      message: `${comp.name} has been deleted.`,
      createdBy: req.userRole || 'System'
    });
    const io = req.app.get('io');
    if (io) {
      io.emit('new_notification', newNotification);
    }

    // Audit Log for deletion
    await logAction(req, `Company Deleted`, 'Tenant Management', {
      companyId: 'SYSTEM',
      companyName: 'System Administration',
      userId: req.user ? req.user._id : undefined,
      description: `Company ${comp.name} was permanently deleted`,
      status: 'Success'
    });

    res.json({ message: `Company '${comp.name}' (${comp.code}) and all its data have been permanently deleted.` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST Send custom notification to a tenant
router.post('/notify-company', async (req, res) => {
  try {
    const { companyId, title, message, type } = req.body;

    if (!companyId || !title || !message) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const Notification = require('../models/Notification');
    const newNotif = await Notification.create({
      companyId: companyId,
      type: 'info',
      module: type || 'System',
      title: title,
      message: message,
      createdBy: req.userRole || 'SaaS Super Admin'
    });

    const io = req.app.get('io');
    if (io) {
      io.emit('new_notification', newNotif);
    }
    
    // Trigger mobile push notification for the targeted company's super admins
    try {
      const sendPushNotification = require('../utils/pushNotificationService');
      // Fetch target company admins
      const companyAdmins = await User.find({
        companyId: companyId,
        role: { $in: ['Super Admin', 'Company Admin'] },
        fcmToken: { $exists: true, $ne: '' }
      });
      
      // Fetch the SaaS Super Admin who sent it (so they get a confirmation buzz when testing!)
      const saasAdmins = await User.find({
        role: 'SaaS Super Admin',
        fcmToken: { $exists: true, $ne: '' }
      });
      
      const allAdminsToNotify = [...companyAdmins, ...saasAdmins];
      const tokens = allAdminsToNotify.map(admin => admin.fcmToken);
      
      if (tokens.length > 0) {
        await sendPushNotification(tokens, title, message, {
          notificationId: newNotif._id,
          module: newNotif.module,
          type: newNotif.type
        });
      }
    } catch (pushErr) {
      console.error('Error sending mobile push in notify-company:', pushErr);
    }

    await logAction(req, `Notification Sent`, 'Tenant Management', {
      companyId: 'SYSTEM',
      companyName: 'System Administration',
      userId: req.user ? req.user._id : undefined,
      description: `Sent ${type || 'System'} notification to company ${companyId}`,
      status: 'Success'
    });

    res.status(201).json({ message: 'Notification sent successfully', notification: newNotif });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET platform analytics
router.get('/analytics', async (req, res) => {
  try {
    const totalCompanies = await Company.countDocuments();
    const activeCompanies = await Company.countDocuments({ status: 'Active' });
    const inactiveCompanies = await Company.countDocuments({ status: { $ne: 'Active' } });

    // Platform-wide visitor count
    const totalVisitors = await Visitor.countDocuments();

    // Actual revenue from Payments in current month
    const Payment = require('../models/Payment');
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    // Total Revenue (all time)
    const allPayments = await Payment.find({ status: 'Paid' });
    const totalRevenue = allPayments.reduce((sum, p) => sum + (p.total || p.amount || 0), 0);

    // Today's Revenue
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const paymentsToday = await Payment.find({
      paymentDate: { $gte: startOfToday, $lte: endOfToday },
      status: 'Paid'
    });
    const todaysRevenue = paymentsToday.reduce((sum, p) => sum + (p.total || p.amount || 0), 0);

    const paymentsThisMonth = await Payment.find({
      paymentDate: { $gte: startOfMonth },
      status: 'Paid'
    });
    const monthlyRevenue = paymentsThisMonth.reduce((sum, p) => sum + (p.total || p.amount || 0), 0);

    res.json({
      totalCompanies,
      activeCompanies,
      inactiveCompanies,
      totalVisitors,
      totalRevenue,
      todaysRevenue,
      monthlyRevenue,
      tiers: {
        OneDayTrial: await Company.countDocuments({ subscription: 'One Day Trial' }),
        Basic: await Company.countDocuments({ subscription: 'Basic' }),
        Standard: await Company.countDocuments({ subscription: 'Standard' }),
        Enterprise: await Company.countDocuments({ subscription: 'Enterprise' })
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET all payments
router.get('/payments', async (req, res) => {
  try {
    const Payment = require('../models/Payment');
    const payments = await Payment.find().sort({ paymentDate: -1 });
    res.json(payments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET all upgrade requests
router.get('/upgrade-requests', async (req, res) => {
  try {
    const UpgradeRequest = require('../models/UpgradeRequest');
    const requests = await UpgradeRequest.find().sort({ createdAt: -1 });
    res.json(requests);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH approve or reject an upgrade request
router.patch('/upgrade-requests/:id', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const UpgradeRequest = require('../models/UpgradeRequest');
    const upgradeReq = await UpgradeRequest.findById(req.params.id);

    if (!upgradeReq) {
      return res.status(404).json({ message: 'Upgrade request not found' });
    }

    if (upgradeReq.status !== 'Pending') {
      return res.status(400).json({ message: `Request is already ${upgradeReq.status}` });
    }

    upgradeReq.status = status;
    upgradeReq.processedBy = req.userId || 'System';
    await upgradeReq.save();

    if (status === 'Approved') {
      // Find the company and update subscription
      const company = await Company.findOne({ code: upgradeReq.companyId });
      if (company) {
        company.subscription = upgradeReq.requestedPlan;

        let newExpiry = company.subscriptionExpiresAt && company.status !== 'Expired' && new Date(company.subscriptionExpiresAt) > new Date()
          ? new Date(company.subscriptionExpiresAt)
          : new Date();

        newExpiry.setDate(newExpiry.getDate() + parseInt(upgradeReq.durationDays, 10));
        company.subscriptionExpiresAt = newExpiry;
        company.status = 'Active';

        company.upgradeHistory.push({
          plan: company.subscription,
          startDate: new Date(),
          endDate: company.subscriptionExpiresAt,
          updatedBy: req.userRole || 'SaaS Super Admin'
        });

        await company.save();

        // Create Payment record
        const Payment = require('../models/Payment');
        const invoiceNo = `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
        const amount = upgradeReq.amount;
        const gst = Math.round(amount * 0.18);
        await Payment.create({
          invoiceNo,
          companyId: company.code,
          companyName: company.name,
          plan: company.subscription,
          amount: amount,
          gst: gst,
          total: amount + gst,
          expiryDate: company.subscriptionExpiresAt,
          durationDays: upgradeReq.durationDays,
          processedBy: req.userRole || 'SaaS Super Admin',
          status: 'Paid'
        });

        // Notify Tenant
        const Notification = require('../models/Notification');
        const newNotif = await Notification.create({
          companyId: company.code,
          type: 'success',
          module: 'Subscription',
          title: '🎉 Congratulations',
          message: `Your subscription has been upgraded to ${company.subscription}. It expires on ${company.subscriptionExpiresAt.toLocaleDateString()}.`,
          createdBy: req.userRole || 'System'
        });
        const io = req.app.get('io');
        if (io) {
          io.emit('new_notification', newNotif);
        }
      }
    }

    res.json(upgradeReq);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
