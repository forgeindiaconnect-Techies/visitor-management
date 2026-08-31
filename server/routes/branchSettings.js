const express = require('express');
const router = express.Router();
const BranchSetting = require('../models/BranchSetting');
const authMiddleware = require('../middleware/authMiddleware');
const logAction = require('../utils/auditLogger');

// Public: Get active company branches for pre-booking dropdown
router.get('/public/:companyId', async (req, res) => {
  try {
    const Company = require('../models/Company');

    const companyId = String(req.params.companyId)
      .trim()
      .toUpperCase();

    const company = await Company.findOne({
      code: companyId,
      status: 'Active'
    });

    if (!company) {
      return res.status(404).json({
        success: false,
        message: 'Company is invalid or inactive'
      });
    }

    const branches = await BranchSetting.find({
      companyId
    })
      .select('branchName')
      .sort({ branchName: 1 });

    return res.json({
      success: true,
      data: branches
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Unable to load branches'
    });
  }
});

router.use(authMiddleware);

// GET all branch settings
router.get('/', async (req, res) => {
  try {
    const branches = await BranchSetting.find({
      companyId: req.companyId
    }).sort({ createdAt: -1 });

    return res.json({
      success: true,
      count: branches.length,
      data: branches
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Unable to fetch branches"
    });
  }
});

// GET specific branch setting
router.get('/:branchName', async (req, res) => {
  try {
    const setting = await BranchSetting.findOne({
      companyId: req.companyId,
      branchName: { $regex: new RegExp(`^${req.params.branchName}$`, 'i') }
    });
    if (!setting) {
      return res.status(404).json({ message: 'Branch settings not found' });
    }
    res.json(setting);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST/PUT update branch setting
router.post('/', async (req, res) => {
  try {
    const { branchName, latitude, longitude, radius, checkInStart, checkInEnd, checkOutTime } = req.body;

    if (!branchName) {
      return res.status(400).json({ success: false, message: 'Branch name is required' });
    }

    // Check plan limits
    const Company = require('../models/Company');
    const planLimits = require('../config/plans');
    const company = await Company.findOne({ code: req.companyId });
    if (company && company.subscription) {
      const limits = planLimits[company.subscription];
      if (limits && limits.branches !== -1) {
        const existing = await BranchSetting.findOne({
          companyId: req.companyId,
          branchName: { $regex: new RegExp(`^${branchName}$`, 'i') }
        });
        if (!existing) {
          const count = await BranchSetting.countDocuments({ companyId: req.companyId });
          if (count >= limits.branches) {
            return res.status(403).json({
              message: `Maximum branches reached. Your current plan (${company.subscription}) only allows up to ${limits.branches} branches. Please upgrade your subscription to create more.`
            });
          }
        }
      }
    }

    const existingBefore = await BranchSetting.findOne({
      companyId: req.companyId,
      branchName: { $regex: new RegExp(`^${branchName}$`, 'i') }
    });

    // Upsert the setting with the logged-in company
    const setting = await BranchSetting.findOneAndUpdate(
      {
        companyId: req.companyId,
        branchName: { $regex: new RegExp(`^${branchName}$`, 'i') }
      },
      {
        ...req.body,
        branchName,
        companyId: req.companyId,
        latitude,
        longitude,
        radius,
        checkInStart,
        checkInEnd,
        checkOutTime
      },
      { new: true, upsert: true }
    );

    if (!existingBefore) {
      const Notification = require('../models/Notification');
      const newNotification = await Notification.create({
        companyId: req.companyId,
        branchId: branchName,
        type: 'success',
        module: 'Branch',
        title: '🏢 New Branch Added',
        message: `${branchName} Branch created under your company.`,
        createdBy: req.user ? req.user.name : 'System'
      });
      const io = req.app.get('io');
      if (io) {
        io.to(`company:${newNotification.companyId}`).emit('new_notification', newNotification);
      }
      await logAction(req, `Branch Added`, 'Settings', {
        userId: req.user ? req.user._id : undefined,
        description: `Branch ${branchName} was created successfully`,
        status: 'Success'
      });
    } else {
      await logAction(req, `Branch Settings Updated`, 'Settings', {
        userId: req.user ? req.user._id : undefined,
        description: `Settings for branch ${branchName} were updated`,
        status: 'Success'
      });
    }

    return res.status(201).json({
      success: true,
      message: "Branch created successfully",
      data: setting,
      ...setting.toJSON()
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Unable to create branch"
    });
  }
});

module.exports = router;
