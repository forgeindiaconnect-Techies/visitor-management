const express = require('express');
const router = express.Router();
const sendPushNotification = require('../utils/pushNotificationService');
const User = require('../models/User');
const logAction = require('../utils/auditLogger');
const { sendEmail, EmailTemplates } = require('../utils/emailService');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Temporarily increased from 5 to allow testing
  message: { message: 'Too many login attempts from this IP, please try again after 15 minutes' }
});

// POST login
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email, password, fcmToken } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Find user in MongoDB
    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {


      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Compare password using bcrypt
    const isMatch = await bcrypt.compare(password, user.password);
    // Fallback for plaintext passwords during migration
    if (!isMatch && user.password !== password) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Block inactive and suspended users from logging in
    // Note: isActive===undefined treated as active for legacy accounts
    if (user.isActive === false || user.status === 'Inactive') {
      if (user.role === 'Visitor') {
        return res.status(403).json({ message: 'Please complete your registration using the invitation email.' });
      }
      return res.status(403).json({ message: 'Your account has been deactivated. Please contact your administrator.' });
    }
    
    if (user.status === 'Blocked') {
      const reasonStr = user.statusReason ? `\n\nReason:\n${user.statusReason}` : '';
      return res.status(403).json({ message: `Your account has been blocked by the Super Admin.${reasonStr}\n\nPlease contact your administrator.` });
    }

    // Check company status
    const Company = require('../models/Company');
    const company = await Company.findOne({ code: user.companyId });
    if (!company && user.role !== 'SaaS Super Admin') {
      return res.status(404).json({ message: 'Company not found' });
    }

    let isExpired = false;
    let subscription = 'Basic';
    let subscriptionExpiresAt = null;

    if (company) {
      if (company.status !== 'Active' && company.status !== 'Expired' && user.role !== 'SaaS Super Admin') {
        return res.status(403).json({ message: `Your company account is currently ${company.status}. Please contact support.` });
      }
      
      if (company.subscriptionExpiresAt && new Date() >= new Date(company.subscriptionExpiresAt)) {
        isExpired = true;
        
        // Auto-expire in database if not already
        if (company.status !== 'Expired') {
          company.status = 'Expired';
          await company.save();
        }
      }
      
      // Do not block login if expired; let the frontend handle the freeze screen and upgrade flow.
      
      subscription = company.subscription;
      subscriptionExpiresAt = company.subscriptionExpiresAt;

      // Automatic Expiration Notifications (Step 4)
      if (!isExpired && company.subscriptionExpiresAt && (user.role === 'Admin' || user.role === 'MD' || user.role === 'Company Admin' || user.role === 'Super Admin')) {
        const diffTime = new Date(company.subscriptionExpiresAt) - new Date();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if ([30, 15, 7, 1].includes(diffDays)) {
          const Notification = require('../models/Notification');
          
          // Only create one notification per day for this company to avoid spam on every login
          const startOfDay = new Date();
          startOfDay.setHours(0, 0, 0, 0);
          
          const existingNotif = await Notification.findOne({
            companyId: company.code,
            type: 'Subscription',
            createdAt: { $gte: startOfDay }
          });

          if (!existingNotif) {
            await Notification.create({
              companyId: company.code,
              type: 'Subscription',
              title: '⚠️ Subscription Expiring Soon',
              message: `Your ${subscription} plan expires in ${diffDays} day${diffDays > 1 ? 's' : ''}. Renew now to avoid service interruption.`,
              createdBy: 'System'
            });
          }
        }
      }
    }

    // Save Firebase FCM Token
    if (fcmToken) {
      user.fcmToken = fcmToken;
      await user.save();
    }

    // Return user data without password
    const u = user.toJSON();
    delete u.password;
    
    const { formatDisplayName } = require('../utils/nameFormatter');
    const cleanedName = formatDisplayName(u.name);
    if (user.name && (user.name.includes('2007') || /\.\s*\d+/.test(user.name))) {
      user.name = cleanedName;
      await user.save();
    }

    // Explicitly construct the response object to ensure properties are added
    const responsePayload = {
      ...u,
      name: cleanedName,
      branch: u.branch || u.branchId,
      companyName: company ? company.name : (u.companyId === 'SYSTEM' ? 'System Administration' : undefined),
      isExpired,
      subscription,
      subscriptionExpiresAt,
      branding: company?.branding || { logoUrl: '', primaryColor: '#1E1B6E' }
    };

    // Generate Access Token (8h)
    const token = jwt.sign(
      { 
        userId: u.id, 
        role: responsePayload.role, 
        companyId: responsePayload.companyId, 
        branchId: responsePayload.branch || responsePayload.branchId || 'All Branches'
      },
      process.env.JWT_SECRET || 'fallback_secret_key_123',
      { expiresIn: '8h' }
    );

    // Generate Refresh Token (7d)
    const RefreshToken = require('../models/RefreshToken');
    const crypto = require('crypto');
    const refreshTokenString = crypto.randomBytes(40).toString('hex');
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 7);

    // Multiple devices can be logged in simultaneously now.
    // We do not delete all old refresh tokens to allow mobile and desktop concurrent sessions.
    await RefreshToken.create({
      token: refreshTokenString,
      userId: u.id,
      expiryDate: expiryDate
    });

    // Set Refresh Token as HttpOnly Cookie
    res.cookie('refreshToken', refreshTokenString, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    // Attach token to response payload
    responsePayload.token = token;

    // Log the action manually since req.user isn't set yet
    await logAction(req, 'User Login', 'Authentication', {
      companyId: responsePayload.companyId,
      companyName: responsePayload.companyName,
      userId: responsePayload.id || responsePayload._id,
      userName: responsePayload.name,
      role: responsePayload.role,
      description: `User ${responsePayload.email} logged in successfully`,
      status: 'Success'
    });
    
    res.json(responsePayload);
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error during login' });
  }
});

// POST register-company (SaaS signup)
router.post('/register-company', async (req, res) => {
  try {
    const Company = require('../models/Company');
    const User = require('../models/User');
    const jwt = require('jsonwebtoken');

    // Backwards compatibility mappings for existing frontend payload
    if (!req.body.companyCode) {
      const cleanName = (req.body.companyName || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
      const prefix = cleanName.length >= 3 ? cleanName : 'COM';
      req.body.companyCode = `${prefix}${Math.floor(100 + Math.random() * 900)}`;
    }
    if (!req.body.subscription && req.body.plan) {
      req.body.subscription = req.body.plan;
    }
    if (!req.body.adminEmail && req.body.email) {
      req.body.adminEmail = req.body.email;
    }
    if (!req.body.adminPassword && req.body.password) {
      req.body.adminPassword = req.body.password;
    }
    if (!req.body.subscriptionExpiresAt) {
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + (req.body.subscription === 'One Day Trial' ? 1 : 30));
      req.body.subscriptionExpiresAt = expiry;
    }

    const company = await Company.create({
      name: req.body.companyName,
      code: req.body.companyCode.trim().toUpperCase(),
      subscription: req.body.subscription,
      status: "Active",
      subscriptionExpiresAt: req.body.subscriptionExpiresAt,
      features: {
        preBookingEnabled: true
      }
    });

    const hashedPassword = await bcrypt.hash(req.body.adminPassword, 12);

    const companyAdmin = await User.create({
      name: req.body.adminName,
      email: req.body.adminEmail.trim().toLowerCase(),
      password: hashedPassword,
      role: "Company Admin",
      companyId: company.code,
      branch: "All Branches",
      status: "Active"
    });

    const token = jwt.sign(
      {
        userId: companyAdmin._id,
        role: companyAdmin.role,
        companyId: companyAdmin.companyId,
        branchId: companyAdmin.branch
      },
      process.env.JWT_SECRET || 'fallback_secret_key_123',
      { expiresIn: "8h" }
    );

    const sanitizedUser = companyAdmin.toJSON();
    delete sanitizedUser.password;

    res.status(201).json({
      message: 'Company and administrator registered successfully',
      company: {
        name: company.name,
        code: company.code,
        subscription: company.subscription,
        status: company.status,
        subscriptionExpiresAt: company.subscriptionExpiresAt
      },
      user: sanitizedUser,
      token: token
    });
  } catch (err) {
    console.error('Company registration error:', err);
    res.status(500).json({ message: err.message || 'Server error during company registration' });
  }
});

// POST mock payment success (Simulates Razorpay/Stripe success webhook or callback)
router.post('/mock-payment', async (req, res) => {
  try {
    const { companyCode, plan, paymentId } = req.body;

    if (!companyCode || !plan) {
      return res.status(400).json({ message: 'Company code and plan selection are required' });
    }

    const Company = require('../models/Company');
    const company = await Company.findOne({ code: companyCode.toUpperCase() });
    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }

    // Create Upgrade Request instead of automatically activating
    const UpgradeRequest = require('../models/UpgradeRequest');
    
    // Calculate amount based on plan
    const amount = plan === 'Enterprise' ? 6999 : (plan === 'Standard' ? 2999 : 999);
    
    const upgradeReq = await UpgradeRequest.create({
      companyId: company.code,
      companyName: company.name,
      requestedPlan: plan,
      amount: amount,
      durationDays: 30,
      status: 'Pending',
      requestedBy: 'System Simulator'
    });

    // Trigger Notification for Subscription Requested
    const Notification = require('../models/Notification');
    const newNotification = await Notification.create({
      companyId: 'SYSTEM',
      type: 'Subscription',
      title: '📈 Subscription Upgrade Requested',
      message: `${company.name} requested to upgrade to ${plan} Plan.`,
      createdBy: 'System Simulator'
    });
    
    const companyNotification = await Notification.create({
      companyId: company.code,
      type: 'Subscription',
      title: '📈 Subscription Upgrade Requested',
      message: `Your company requested to upgrade to ${plan} Plan. Pending Approval.`,
      createdBy: 'System Simulator'
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`company:${newNotification.companyId}`).emit('new_notification', newNotification);
      io.to(`company:${companyNotification.companyId}`).emit('new_notification', companyNotification);
    }

    res.json({
      message: 'Payment simulation successful. Upgrade request created and is pending approval.',
      company: {
        name: company.name,
        code: company.code,
        subscription: company.subscription,
        status: company.status,
        subscriptionExpiresAt: company.subscriptionExpiresAt
      }
    });
  } catch (err) {
    console.error('Mock payment error:', err);
    res.status(500).json({ message: err.message || 'Server error during mock payment' });
  }
});

module.exports = router;

// POST /refresh - Refresh Access Token
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.cookies;
    
    if (!refreshToken) {
      return res.status(403).json({ message: 'Refresh token is required' });
    }

    const RefreshToken = require('../models/RefreshToken');
    const tokenDoc = await RefreshToken.findOne({ token: refreshToken }).populate('userId');

    if (!tokenDoc) {
      return res.status(403).json({ message: 'Refresh token is not in database' });
    }

    if (RefreshToken.verifyExpiration(tokenDoc)) {
      await RefreshToken.findByIdAndDelete(tokenDoc._id);
      return res.status(403).json({ message: 'Refresh token has expired. Please make a new login request' });
    }

    const user = tokenDoc.userId;
    const newAccessToken = jwt.sign(
      { userId: user._id, companyId: user.companyId, role: user.role },
      process.env.JWT_SECRET || 'fallback_secret_key_123',
      { expiresIn: '15m' }
    );

    res.status(200).json({
      token: newAccessToken,
    });
  } catch (err) {
    console.error('Refresh token error:', err);
    res.status(500).send({ message: err.message });
  }
});

// POST /logout - Clear Refresh Token
router.post('/logout', async (req, res) => {
  try {
    const { refreshToken } = req.cookies;
    if (refreshToken) {
      const RefreshToken = require('../models/RefreshToken');
      await RefreshToken.findOneAndDelete({ token: refreshToken });
    }
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });
    res.status(200).json({ message: 'Logged out successfully' });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ message: err.message });
  }
});
