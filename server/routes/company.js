const express = require('express');
const router = express.Router();
const Company = require('../models/Company');
const authMiddleware = require('../middleware/authMiddleware');
const { sendEmail, EmailTemplates } = require('../utils/emailService');
const {
  startNewSubscriptionCycle
} = require('../services/subscriptionCycleService');

router.use(authMiddleware);

// GET branding for the logged-in company
router.get(
  '/me/branding',
  authMiddleware,
  async (req, res) => {
    try {
      const company = await Company.findOne({
        code: req.companyId
      }).select('name code branding');

      if (!company) {
        return res.status(404).json({
          success: false,
          message: 'Company not found'
        });
      }

      return res.json({
        success: true,
        data: company
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Unable to load company branding'
      });
    }
  }
);

// GET current company details
router.get('/me', async (req, res) => {
  try {
    if (req.companyId === 'SYSTEM') {
      return res.json({
        _id: 'SYSTEM',
        companyName: 'System Administration',
        subscription: 'Enterprise',
        status: 'Active',
        subscriptionExpiresAt: new Date(2099, 11, 31)
      });
    }

    const company = await Company.findOne({ code: req.companyId });
    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }

    res.json({
      _id: company._id,
      companyId: company.code,
      companyName: company.name,
      subscription: company.subscription,
      status: company.status,
      expiryDate: company.subscriptionExpiresAt,
      createdAt: company.createdAt
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST request an upgrade from the SaaS Super Admin
router.post('/request-upgrade', async (req, res) => {
  try {
    const { requestedPlan, amount, durationDays } = req.body;

    if (!requestedPlan || !amount || !durationDays) {
      return res.status(400).json({ message: 'Missing required upgrade details' });
    }

    const Company = require('../models/Company');
    const Notification = require('../models/Notification');
    const UpgradeRequest = require('../models/UpgradeRequest');

    const company = await Company.findOne({ code: req.companyId });
    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }

    // Create Upgrade Request record
    const upgradeReq = await UpgradeRequest.create({
      companyId: company.code,
      companyName: company.name,
      requestedPlan,
      amount,
      durationDays,
      status: 'Pending',
      requestedBy: req.userId || 'System'
    });

    // Send a notification to the SaaS Super Admin (SYSTEM)
    const newNotif = await Notification.create({
      companyId: 'SYSTEM',
      type: 'info',
      module: 'Subscription',
      title: '📈 Subscription Upgrade Requested',
      message: `${company.name} requested to upgrade to ${requestedPlan} for ₹${amount}.`,
      createdBy: req.userRole || 'System'
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`company:${newNotif.companyId}`).emit('new_notification', newNotif);
    }

    // Find the company's super admin email to send the confirmation to
    const User = require('../models/User');
    const companyAdmin = await User.findOne({ companyId: company.code, role: 'Super Admin' });
    if (companyAdmin && companyAdmin.email) {
      await sendEmail(companyAdmin.email, EmailTemplates.paymentReceived(company.name, requestedPlan, amount).subject, EmailTemplates.paymentReceived(company.name, requestedPlan, amount).body);
    }

    res.json({ success: true, message: 'Upgrade request sent successfully to the SaaS Administrator.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST mock-payment to automatically activate subscription (Step 7 & 8)
router.post('/mock-payment', async (req, res) => {
  try {
    const { requestedPlan, amount } = req.body;

    if (
      !requestedPlan ||
      amount === undefined ||
      amount === null
    ) {
      return res.status(400).json({
        success: false,
        message: 'Missing required payment details'
      });
    }

    const Company = require('../models/Company');
    const Notification = require('../models/Notification');
    const User = require('../models/User');

    const company = await Company.findOne({ code: req.companyId });
    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }

    // Start a fresh subscription cycle using backend plan settings.
    let subscriptionResult;

    try {
      subscriptionResult =
        await startNewSubscriptionCycle({
          company,
          newPlan: requestedPlan,
          updatedBy:
            req.userRole ||
            req.userId ||
            'Mock Payment',
          activationDate: new Date()
        });
    } catch (subscriptionError) {
      return res
        .status(subscriptionError.statusCode || 400)
        .json({
          success: false,
          message: subscriptionError.message
        });
    }

    // Send a notification to the SaaS Super Admin (SYSTEM)
    const newNotif = await Notification.create({
      companyId: 'SYSTEM',
      type: 'success',
      module: 'Subscription',
      title: '✅ Automatic Subscription Activated',
      message: `${company.name} successfully paid ₹${amount} and upgraded to ${requestedPlan} (Valid for ${subscriptionResult.company.subscription === 'One Day Trial' ? 1 : 30} days).`,
      createdBy: req.userRole || 'System'
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`company:${newNotif.companyId}`).emit('new_notification', newNotif);
    }

    // Email receipt to Company Admin
    const companyAdmin = await User.findOne({ companyId: company.code, role: 'Super Admin' });
    if (companyAdmin && companyAdmin.email) {
      await sendEmail(companyAdmin.email, EmailTemplates.paymentReceived(company.name, requestedPlan, amount).subject, EmailTemplates.paymentReceived(company.name, requestedPlan, amount).body);
    }

    res.json({
      success: true,
      message:
        'Payment successful. A new subscription cycle is now active.',

      subscription:
        subscriptionResult.company.subscription,

      subscriptionStartedAt:
        subscriptionResult.subscriptionStartedAt,

      subscriptionExpiresAt:
        subscriptionResult.subscriptionExpiresAt,

      visitorPassUsage: {
        used: 0,
        message:
          'Visitor-pass usage will start from zero for this subscription cycle.'
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET company usage stats
router.get('/usage', async (req, res) => {
  try {
    const Company = require('../models/Company');
    const User = require('../models/User');
    const Visitor = require('../models/Visitor');
    const BranchSetting = require('../models/BranchSetting');
    const planLimits = require('../config/plans');

    if (req.companyId === 'SYSTEM') {
      return res.json({
        plan: 'Enterprise',
        limits: planLimits['Enterprise'],
        current: { visitors: 0, securityUsers: 0, branches: 0 }
      });
    }

    const company = await Company.findOne({ code: req.companyId });
    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }

    const limits = planLimits[company.subscription] || planLimits['Basic'];

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const visitorCount = await Visitor.countDocuments({
      companyId: req.companyId,
      createdAt: { $gte: startOfMonth }
    });

    const securityCount = await User.countDocuments({ companyId: req.companyId, role: 'Security' });
    const branchCount = await BranchSetting.countDocuments({ companyId: req.companyId });

    res.json({
      plan: company.subscription,
      limits,
      current: {
        visitors: visitorCount,
        securityUsers: securityCount,
        branches: branchCount
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/company/branding - Update tenant branding
router.patch('/branding', async (req, res) => {
  try {
    const { logoUrl, primaryColor } = req.body;

    // Only the Super Admin of the company can change branding
    if (req.userRole !== 'Super Admin') {
      return res.status(403).json({ message: 'Forbidden: Only Super Admin can update branding' });
    }

    const Company = require('../models/Company');
    const company = await Company.findOne({ code: req.companyId });

    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }

    // Check if the plan allows custom branding
    if (!['Standard', 'Enterprise'].includes(company.subscription)) {
      return res.status(403).json({ message: 'Custom branding requires Standard or Enterprise plan.' });
    }

    if (logoUrl !== undefined) company.branding.logoUrl = logoUrl;
    if (primaryColor !== undefined) company.branding.primaryColor = primaryColor;

    await company.save();

    await logAction(req, 'Update Branding', 'Configuration', {
      primaryColor: company.branding.primaryColor
    });

    res.json(company.branding);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/company/subscription-history - Fetch payment history for the company
router.get('/subscription-history', async (req, res) => {
  try {
    const Payment = require('../models/Payment');
    const payments = await Payment.find({ companyId: req.companyId }).sort({ paymentDate: -1 });
    res.json(payments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
