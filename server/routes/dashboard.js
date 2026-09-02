const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const BranchSetting = require('../models/BranchSetting');
const User = require('../models/User');
const Visitor = require('../models/Visitor');
const PreBooking = require('../models/PreBooking');
const Blacklist = require('../models/Blacklist');
const getTenantFilter = require('../utils/tenantFilter');

router.use(authMiddleware);

// GET dashboard statistics
router.get('/stats', async (req, res) => {
  try {
    const tenantFilter = getTenantFilter(req);

    if (req.companyId === 'SYSTEM') {
      return res.json({
        success: true,
        data: {
          totalBranches: 0,
          totalUsers: 0,
          totalVisitors: 0,
          totalPreBookings: 0,
          visitorsInside: 0,
          pendingApprovals: 0,
          blockedVisitors: 0
        }
      });
    }

    const companyId = tenantFilter.companyId;

    const [
      totalBranches,
      totalUsers,
      totalVisitors,
      totalPreBookings,
      visitorsInside,
      pendingApprovals,
      blockedVisitors
    ] = await Promise.all([
      BranchSetting.countDocuments(tenantFilter),
      User.countDocuments(tenantFilter),
      Visitor.countDocuments(tenantFilter),
      PreBooking.countDocuments(tenantFilter),

      Visitor.countDocuments({
        ...tenantFilter,
        status: { $in: ["INSIDE", "Checked In", "CHECKED_IN", "Inside"] }
      }),

      PreBooking.countDocuments({
        ...tenantFilter,
        status: { $in: ["PENDING", "Pending"] }
      }),

      Blacklist.countDocuments({
        ...tenantFilter,
        status: "Active"
      })
    ]);

    return res.json({
      success: true,
      data: {
        totalBranches,
        totalUsers,
        totalVisitors,
        totalPreBookings,
        visitorsInside,
        pendingApprovals,
        blockedVisitors
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Unable to load dashboard statistics"
    });
  }
});

// GET recent visitor activity
router.get('/recent-visitors', async (req, res) => {
  try {
    const tenantFilter = getTenantFilter(req);
    const recentVisitors = await Visitor.find(tenantFilter)
      .sort({ createdAt: -1 })
      .limit(10);

    return res.json({
      success: true,
      count: recentVisitors.length,
      data: recentVisitors
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Unable to fetch recent visitors"
    });
  }
});

// GET recent pre-bookings
router.get('/recent-prebookings', async (req, res) => {
  try {
    const tenantFilter = getTenantFilter(req);
    const recentPreBookings = await PreBooking.find(tenantFilter)
      .sort({ createdAt: -1 })
      .limit(10);

    return res.json({
      success: true,
      count: recentPreBookings.length,
      data: recentPreBookings
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Unable to fetch recent pre-bookings"
    });
  }
});

module.exports = router;
