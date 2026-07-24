const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const RegistrationToken = require('../models/RegistrationToken');
const Visitor = require('../models/Visitor');
const VisitorProfile = require('../models/VisitorProfile');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { sendPreBookingInvitation, sendRegistrationConfirmation } = require('../utils/emailService');

// Helper to log audit actions
const logAction = async (req, action, targetModule, details) => {
  try {
    const AuditLog = require('../models/AuditLog');
    await AuditLog.create({
      companyId: req.companyId,
      action,
      module: targetModule,
      performedBy: req.user ? req.user.name : (details.userId || 'System Admin'),
      role: req.user ? req.user.role : 'System',
      ipAddress: req.ip || '127.0.0.1',
      details: typeof details === 'string' ? details : JSON.stringify(details),
      status: details.status || 'Success'
    });
  } catch (e) {
    console.error('AuditLog creation error:', e.message);
  }
};

// 1. Create Pre-Booking Registration & Generate Token / Send Invitation
router.post('/create', async (req, res) => {
  try {
    const { visitorName, email, mobileNumber, companyName, purpose, visitDate, visitTime, branch, visitorCount, notes, sendEmailNow } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email address is required.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 48 * 3600 * 1000); // 48 Hours

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const registrationLink = `${frontendUrl}/pre-register?token=${token}`;
    const expiryDateStr = expiresAt.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

    const newToken = new RegistrationToken({
      token,
      companyId: req.companyId || 'COMP001',
      visitorName: visitorName || 'Valued Visitor',
      email,
      mobileNumber: mobileNumber || '',
      companyName: companyName || 'Forge India Connect Private Limited',
      purpose: purpose || 'Business Meeting',
      visitDate: visitDate || new Date().toISOString().split('T')[0],
      visitTime: visitTime || '10:00 AM',
      branch: branch || 'Head Office(KRISHNAGIRI)',
      visitorCount: visitorCount || 1,
      notes: notes || '',
      expiresAt,
      status: sendEmailNow !== false ? 'Invitation Sent' : 'Pending Invitation',
      createdBy: req.user ? req.user.name : 'Admin'
    });

    const savedToken = await newToken.save();

    let emailSent = false;
    if (sendEmailNow !== false) {
      emailSent = await sendPreBookingInvitation({
        visitorName: savedToken.visitorName,
        email: savedToken.email,
        registrationLink,
        expiryDate: expiryDateStr,
        companyName: savedToken.companyName
      });
    }

    await logAction(req, 'Created Pre-Booking Invitation', 'Visitors', {
      email,
      token,
      status: 'Success'
    });

    res.status(201).json({
      success: true,
      invitation: savedToken,
      registrationLink,
      emailSent
    });
  } catch (err) {
    console.error('Create Invitation Error:', err);
    res.status(500).json({ message: err.message });
  }
});

// 2. Verify Registration Token (Public)
router.get('/verify/:token', async (req, res) => {
  try {
    const registration = await RegistrationToken.findOne({ token: req.params.token });

    if (!registration) {
      return res.status(404).json({ valid: false, message: 'This registration link is invalid or has expired.' });
    }

    if (registration.cancelled) {
      return res.status(400).json({ valid: false, message: 'This registration link has been cancelled by the administrator.' });
    }

    if (registration.used) {
      return res.status(400).json({ valid: false, message: 'This registration link has already been used.' });
    }

    if (new Date() > new Date(registration.expiresAt)) {
      return res.status(400).json({ valid: false, message: 'This registration link is invalid or has expired.' });
    }

    res.json({
      valid: true,
      invitation: {
        visitorName: registration.visitorName,
        email: registration.email,
        mobileNumber: registration.mobileNumber,
        companyName: registration.companyName,
        purpose: registration.purpose,
        visitDate: registration.visitDate,
        visitTime: registration.visitTime,
        branch: registration.branch,
        notes: registration.notes,
        expiresAt: registration.expiresAt
      }
    });
  } catch (err) {
    res.status(500).json({ valid: false, message: 'This registration link is invalid or has expired.' });
  }
});

// 3. Complete Registration & Activate Visitor Account (Public)
router.post('/register', async (req, res) => {
  try {
    const { token, visitorName, mobileNumber, address, companyName, password } = req.body;

    const registration = await RegistrationToken.findOne({ token });
    if (!registration || registration.used || registration.cancelled || new Date() > new Date(registration.expiresAt)) {
      return res.status(400).json({ message: 'This registration link is invalid or has expired.' });
    }

    if (!password || password.length < 4) {
      return res.status(400).json({ message: 'Password is required (minimum 4 characters).' });
    }

    // Hash Password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create or Update User Account for Visitor Login
    let user = await User.findOne({ email: registration.email });
    if (!user) {
      user = new User({
        name: visitorName || registration.visitorName,
        email: registration.email,
        password: hashedPassword,
        role: 'Visitor',
        companyId: registration.companyId,
        companyName: companyName || registration.companyName,
        branch: registration.branch,
        isActive: true
      });
      await user.save();
    } else {
      user.password = hashedPassword;
      user.name = visitorName || registration.visitorName;
      user.isActive = true;
      await user.save();
    }

    // Generate Visit ID & Booking ID
    const lastVisitor = await Visitor.findOne({ companyId: registration.companyId }).sort({ createdAt: -1 });
    let vNum = 1;
    let bNum = 1;
    if (lastVisitor) {
      if (lastVisitor.visitId && lastVisitor.visitId.startsWith('VISIT')) {
        const match = lastVisitor.visitId.match(/\d+$/);
        if (match) vNum = parseInt(match[0], 10) + 1;
      }
      if (lastVisitor.bookingId && lastVisitor.bookingId.startsWith('BK')) {
        const bMatch = lastVisitor.bookingId.match(/\d+$/);
        if (bMatch) bNum = parseInt(bMatch[0], 10) + 1;
      }
    }
    const visitId = `VISIT${vNum.toString().padStart(4, '0')}`;
    const bookingId = `BK${bNum.toString().padStart(6, '0')}`;

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const passUrl = `${frontendUrl}/pass/${visitId}`;
    const qrPayload = {
      bookingId,
      visitorId: visitId,
      mobile: mobileNumber || registration.mobileNumber
    };

    // Create Visitor Pass Record
    const visitor = new Visitor({
      companyId: registration.companyId,
      visitorName: visitorName || registration.visitorName,
      email: registration.email,
      mobileNumber: mobileNumber || registration.mobileNumber,
      companyName: companyName || registration.companyName,
      purpose: registration.purpose,
      visitDate: registration.visitDate,
      expectedArrivalTime: registration.visitTime,
      branch: registration.branch,
      visitorCount: registration.visitorCount,
      notes: registration.notes || address || '',
      hostName: 'Security / Reception',
      registrationType: 'Pre-Booking',
      status: 'Approved',
      bookingId,
      visitId,
      qrCode: passUrl,
      qrPayload,
      approvedBy: 'Pre-Registered'
    });
    const savedVisitor = await visitor.save();

    // Mark token as used
    registration.used = true;
    registration.status = 'Visitor Pass Generated';
    registration.visitorId = savedVisitor._id.toString();
    registration.bookingId = bookingId;
    await registration.save();

    // Send Confirmation Email
    await sendRegistrationConfirmation({
      visitorName: savedVisitor.visitorName,
      email: savedVisitor.email,
      passUrl,
      bookingId,
      companyName: savedVisitor.companyName
    });

    res.json({
      success: true,
      message: 'Registration completed successfully!',
      bookingId,
      visitId,
      passUrl
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ message: err.message });
  }
});

// 4. List Invitations (Admin)
router.get('/list', async (req, res) => {
  try {
    const { search, status } = req.query;
    let query = { companyId: req.companyId || 'COMP001' };

    if (status && status !== 'All') {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { visitorName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { companyName: { $regex: search, $options: 'i' } }
      ];
    }

    const invitations = await RegistrationToken.find(query).sort({ createdAt: -1 });
    res.json(invitations);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 5. Resend Invitation Email
router.post('/:id/resend', async (req, res) => {
  try {
    const invitation = await RegistrationToken.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!invitation) return res.status(404).json({ message: 'Invitation not found' });

    if (invitation.used || invitation.cancelled) {
      return res.status(400).json({ message: 'Cannot resend email for a used or cancelled invitation.' });
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const registrationLink = `${frontendUrl}/pre-register?token=${invitation.token}`;
    const expiryDateStr = new Date(invitation.expiresAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

    await sendPreBookingInvitation({
      visitorName: invitation.visitorName,
      email: invitation.email,
      registrationLink,
      expiryDate: expiryDateStr,
      companyName: invitation.companyName
    });

    invitation.status = 'Invitation Sent';
    await invitation.save();

    res.json({ success: true, message: 'Invitation email resent successfully.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 6. Regenerate Token & Resend Link
router.post('/:id/regenerate', async (req, res) => {
  try {
    const invitation = await RegistrationToken.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!invitation) return res.status(404).json({ message: 'Invitation not found' });

    const newToken = crypto.randomBytes(32).toString('hex');
    const newExpiresAt = new Date(Date.now() + 48 * 3600 * 1000);

    invitation.token = newToken;
    invitation.expiresAt = newExpiresAt;
    invitation.used = false;
    invitation.cancelled = false;
    invitation.status = 'Invitation Sent';

    await invitation.save();

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const registrationLink = `${frontendUrl}/pre-register?token=${newToken}`;
    const expiryDateStr = newExpiresAt.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

    await sendPreBookingInvitation({
      visitorName: invitation.visitorName,
      email: invitation.email,
      registrationLink,
      expiryDate: expiryDateStr,
      companyName: invitation.companyName
    });

    res.json({ success: true, message: 'Registration link regenerated and resent successfully.', registrationLink });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 7. Cancel Invitation
router.post('/:id/cancel', async (req, res) => {
  try {
    const invitation = await RegistrationToken.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!invitation) return res.status(404).json({ message: 'Invitation not found' });

    invitation.cancelled = true;
    invitation.status = 'Cancelled';
    await invitation.save();

    res.json({ success: true, message: 'Invitation cancelled successfully.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
