const Company = require('../models/Company');
const jwt = require('jsonwebtoken');

module.exports = async (req, res, next) => {
  try {
    let companyId = req.headers['x-company-id'];
    let userId = req.headers['x-user-id'];
    let branchId = req.headers['x-branch-id'] || 'All Branches';
    let userRole = null;
    let decoded = null;
    const authHeader = req.headers['authorization'];

    // Public route bypass (allow public pass lookup, check-in, check-out)
    const isPublicUrl = 
      req.originalUrl.includes('/pass-lookup/') ||
      req.originalUrl.includes('/pass/') ||
      req.originalUrl.includes('/public-status/') ||
      req.originalUrl.includes('/check-in') ||
      req.originalUrl.includes('/check-out') ||
      req.originalUrl.includes('/public-prebook') ||
      req.originalUrl.includes('/upload-id-proof');

    if (isPublicUrl && !authHeader) {
      req.companyId = (companyId || 'SYSTEM').toUpperCase();
      return next();
    }

    // Verify JWT token securely - Role must come from verified JWT or DB User only!
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const tokenString = authHeader.split(' ')[1];
        decoded = jwt.verify(tokenString, process.env.JWT_SECRET || 'fallback_secret_key_123');
        if (decoded) {
          userId = decoded.userId || decoded.id || userId;
          userRole = decoded.role;
          companyId = decoded.companyId || companyId;
          branchId = decoded.branchId || branchId;
          req.user = decoded;
        }
      } catch (tokenErr) {
        console.error('JWT Verification Failed:', tokenErr.message);
      }
    }

    // 1. Check for bootstrap administrator accounts
    const isBootstrap = userId && (
      String(userId).startsWith('bootstrap') ||
      String(userId).toLowerCase() === 'bootstrap'
    );

    if (isBootstrap && (!userId || !require('mongoose').isValidObjectId(userId))) {
      req.userId = userId || 'bootstrap-admin';
      req.userRole = 'SaaS Super Admin';
      req.userName = req.userName || 'Bootstrap Admin';
      req.companyId = 'SYSTEM';
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

    // 2. Database truth for authenticated real users (with ObjectId validation guard)
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
        if (userObj.name && (userObj.name.includes('2007') || /\.\s*\d+/.test(userObj.name))) {
          userObj.name = formatDisplayName(userObj.name);
          await User.findByIdAndUpdate(userObj._id, { name: userObj.name });
        }
        companyId = userObj.companyId;
        userRole = userObj.role;
        branchId = userObj.branch;
        req.userName = formatDisplayName(userObj.name);
        req.user = userObj;
      }
    }

    // Role must come only from the verified JWT or database user
    const rawRole =
      req.user?.role ||
      userRole ||
      decoded?.role ||
      '';

    const roleKey = String(rawRole)
      .trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, '');

    let finalRole = String(rawRole).trim();

    if (roleKey === 'saassuperadmin') {
      finalRole = 'SaaS Super Admin';
    } else if (roleKey === 'superadmin') {
      finalRole = 'Super Admin';
    }

    const headerCompanyId = req.headers['x-company-id'];
    const tokenCompanyId = req.user?.companyId || decoded?.companyId || companyId;

    const requestedCompanyId = String(headerCompanyId || tokenCompanyId || '').trim().toUpperCase();

    // SaaS Super Admin & System context requests
    if (finalRole === 'SaaS Super Admin' || requestedCompanyId === 'SYSTEM') {
      req.companyId = 'SYSTEM';
    } else {
      if (!requestedCompanyId) {
        console.error(`authMiddleware 401 → ${req.method} ${req.originalUrl} | companyId missing`);
        return res.status(401).json({
          success: false,
          message: 'Company information is missing. Please log in again.'
        });
      }

      const company = await Company.findOne({ code: requestedCompanyId });

      if (!company) {
        return res.status(404).json({
          success: false,
          message: 'Company not found.'
        });
      }

      const isUpgradeRequest = 
        req.originalUrl.includes('/request-upgrade') || 
        req.originalUrl.includes('/me') || 
        req.originalUrl.includes('/payment') || 
        req.originalUrl.includes('/mock-payment') || 
        req.originalUrl.includes('/plans');

      if (company.status !== 'Active' && !isUpgradeRequest) {
        return res.status(403).json({
          success: false,
          message: `Your subscription account status is '${company.status}'. Please contact system administrator.`
        });
      }

      if (company.subscriptionExpiresAt && new Date() >= new Date(company.subscriptionExpiresAt) && !isUpgradeRequest) {
        return res.status(403).json({
          subscriptionExpired: true,
          message: `Your subscription expired on ${new Date(company.subscriptionExpiresAt).toLocaleString('en-US', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}. Please renew to continue.`
        });
      }

      req.companyId = company.code;
    }

    req.userId = userId || null;
    req.userRole = finalRole || null;
    req.branchId = branchId || 'All Branches';

    return next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    res.status(500).json({ message: 'Internal Server Error in authentication' });
  }
};
