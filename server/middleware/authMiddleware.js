const Company = require('../models/Company');

module.exports = async (req, res, next) => {
  try {
    let companyId = req.headers['x-company-id'];
    const userId = req.headers['x-user-id'];
    let userRole = req.headers['x-user-role'];
    let branchId = req.headers['x-branch-id'] || 'All Branches';

    // 1. Check for bootstrap administrator accounts (e.g., "bootstrap", "bootstrap-admin", etc.)
    const isBootstrap = userId && (
      String(userId).startsWith('bootstrap') ||
      String(userId).toLowerCase() === 'bootstrap' ||
      String(userRole) === 'SaaS Super Admin'
    );

    if (isBootstrap && (!userId || !require('mongoose').isValidObjectId(userId))) {
      req.userId = userId || 'bootstrap-admin';
      req.userRole = userRole || 'SaaS Super Admin';
      req.userName = req.userName || 'Bootstrap Admin';
      req.companyId = companyId || 'SYSTEM';
      req.branchId = branchId;
      req.user = {
        _id: req.userId,
        id: req.userId,
        name: req.userName,
        role: req.userRole,
        companyId: req.companyId
      };
      return next();
    }

    // 2. Force database truth for authenticated real users (with ObjectId validation guard)
    if (userId && require('mongoose').isValidObjectId(userId)) {
      const User = require('../models/User');
      const { formatDisplayName } = require('../utils/nameFormatter');
      const userObj = await User.findById(userId);
      if (userObj) {
        if (userObj.status === 'Inactive') {
          return res.status(403).json({ message: 'Your account is inactive and has been deactivated.' });
        }
        if (userObj.status === 'Blocked') {
          return res.status(403).json({ message: 'Your account has been blocked.' });
        }
        // If name had birth year or email digits, clean it up
        if (userObj.name && (userObj.name.includes('2007') || /\.\s*\d+/.test(userObj.name))) {
          userObj.name = formatDisplayName(userObj.name);
          await User.findByIdAndUpdate(userObj._id, { name: userObj.name });
        }
        // Override headers with database truth
        companyId = userObj.companyId;
        userRole = userObj.role;
        branchId = userObj.branch;
        req.userName = formatDisplayName(userObj.name);
        req.user = userObj;
      }
    }

    // 2. Resolve tenant company validity
    if (companyId) {
      if (companyId.toUpperCase() === 'SYSTEM' || userRole === 'SaaS Super Admin') {
        req.companyId = 'SYSTEM';
      } else {
        const company = await Company.findOne({ code: companyId.toUpperCase() });
        if (!company) {
          return res.status(404).json({ message: 'Company code is invalid' });
        }

        const isUpgradeRequest = req.originalUrl.includes('/request-upgrade') || req.originalUrl.includes('/me') || req.originalUrl.includes('/payment');

        if (company.status !== 'Active' && userRole !== 'SaaS Super Admin' && !isUpgradeRequest) {
          return res.status(403).json({ 
            message: `Your subscription account status is '${company.status}'. Please contact system administrator.` 
          });
        }

        // Check if subscription has expired (Exact time)
        if (company.subscriptionExpiresAt && new Date() >= new Date(company.subscriptionExpiresAt) && userRole !== 'SaaS Super Admin' && !isUpgradeRequest) {
          // If expired, immediately return a specific payload so the frontend knows to freeze the dashboard.
          return res.status(403).json({ 
            subscriptionExpired: true,
            message: `Your subscription expired on ${new Date(company.subscriptionExpiresAt).toLocaleString('en-US', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}. Please renew to continue.` 
          });
        }

        req.companyId = companyId.toUpperCase();
      }
    } else {
      // Default fallback for legacy endpoints or unconfigured requests
      req.companyId = 'FIC001';
    }

    req.userId = userId || null;
    req.userRole = userRole || null;
    req.branchId = branchId;

    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    res.status(500).json({ message: 'Internal Server Error in authentication' });
  }
};
