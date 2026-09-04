const express = require('express');
const router = express.Router();
const Visitor = require('../models/Visitor');
const Notification = require('../models/Notification');
const authMiddleware = require('../middleware/authMiddleware');
const { checkApprovalPermission } = require('../middleware/approvalPermission');
const visitorNotificationService = require('../services/visitorNotificationService');

// 1. Create Pre-Booking (Public / Landing Page / Visitor Form)
router.post('/', async (req, res) => {
  try {
    const {
      visitorName,
      mobileNumber,
      email,
      companyName,
      hostName,
      purpose,
      visitDate,
      expectedArrivalTime,
      expectedDuration,
      vehicleNumber,
      branch,
      notes,
      photoUrl
    } = req.body;

    if (!visitorName || !mobileNumber || !hostName || !purpose) {
      return res.status(400).json({ message: 'Full Name, Mobile Number, Host Employee, and Purpose are required.' });
    }

    if (!photoUrl) {
      return res.status(400).json({ message: 'Real-time face camera photo is mandatory for pre-booking.' });
    }

    // Duplicate Prevention Check: Normalize email & mobile and check for active pre-bookings
    const normalizedEmail = (email || "").trim().toLowerCase();
    const rawMobileDigits = (mobileNumber || "").replace(/\D/g, "");
    const mobileDigits = rawMobileDigits.length >= 10 ? rawMobileDigits.slice(-10) : rawMobileDigits;

    const activeStatuses = [
      "PENDING", "APPROVED", "CHECKED_IN", "CHECKED IN", "INSIDE", 
      "Pre-Booked", "Pending", "Approved"
    ];

    const duplicateOrConditions = [];
    if (normalizedEmail) {
      duplicateOrConditions.push({ email: { $regex: new RegExp(`^${normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } });
    }
    if (mobileDigits && mobileDigits.length >= 6) {
      duplicateOrConditions.push({ mobileNumber: { $regex: new RegExp(`${mobileDigits}$`) } });
    }

    if (duplicateOrConditions.length > 0) {
      const PreBookingModel = require("../models/PreBooking");
      const existingPreBooking = await PreBookingModel.findOne({
        status: { $in: activeStatuses },
        $or: duplicateOrConditions
      });

      const existingVisitorDoc = existingPreBooking ? null : await Visitor.findOne({
        status: { $in: activeStatuses },
        $or: duplicateOrConditions
      });

      if (existingPreBooking || existingVisitorDoc) {
        return res.status(409).json({
          success: false,
          code: "ALREADY_REGISTERED",
          message: "You already have an active pre-booking. Please wait until your existing visit is completed."
        });
      }
    }

    const reqCompanyCode = String(
      req.body.companyId || req.headers['x-company-id'] || 'FIC001'
    ).trim().toUpperCase();

    const Company = require('../models/Company');
    const targetCompany = await Company.findOne({
      code: reqCompanyCode
    });

    if (!targetCompany || targetCompany.status !== 'Active') {
      return res.status(400).json({
        success: false,
        message: 'Invalid or inactive company pre-booking link. Registration cannot be completed.'
      });
    }

    const companyId = targetCompany.code;
    const targetBranch = branch || 'Head Office(KRISHNAGIRI)';
    const profileId = 'VP-' + Date.now().toString().slice(-6);

    // Sequential Order-Wise Visitor ID (VISIT1001, VISIT1002...)
    const lastVisitor = await Visitor.findOne().sort({ createdAt: -1 });
    let nextSeq = 1001;
    if (lastVisitor && lastVisitor.visitId) {
      const match = lastVisitor.visitId.match(/\d+$/);
      if (match) {
        nextSeq = parseInt(match[0], 10) + 1;
      }
    }
    const visitId = `VISIT${nextSeq.toString().padStart(4, '0')}`;

    const newVisitor = new Visitor({
      companyId,
      profileId,
      visitId,
      visitorName,
      mobileNumber,
      email: email || '',
      companyName: companyName || 'Forge India Connect Private Limited',
      hostName,
      purpose,
      visitDate: visitDate || new Date().toISOString().split('T')[0],
      expectedArrivalTime: expectedArrivalTime || '10:00 AM',
      expectedDuration: expectedDuration || '1 Hour',
      vehicleNumber: vehicleNumber || '',
      branch: targetBranch,
      notes: notes || '',
      photoUrl: photoUrl || '',
      registrationType: 'Pre-Booking',
      status: 'PENDING', // Initial State: PENDING
      createdBy: 'Public Pre-Booking Workflow',
      trackingToken: require('crypto').randomBytes(32).toString('hex'),
      trackingTokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    });

    const savedVisitor = await newVisitor.save();

    // Send registration received email to visitor
    if (email) {
      const emailService = require('../utils/emailService');
      emailService.sendPreBookingRequestReceived({ 
        visitorName, 
        email 
      }).catch(err => {
        console.warn('Could not send registration email:', err.message);
      });
    }

    // Create Notification for Admin
    try {
      await Notification.create({
        companyId,
        title: 'New Pre-Booking Request (Pending Approval)',
        message: `Visitor ${visitorName} requested pre-booking to meet ${hostName} on ${visitDate}.`,
        type: 'visitor',
        branch: targetBranch,
        read: false
      });
    } catch (notifErr) {
      console.warn('Could not create notification:', notifErr.message);
    }

    res.status(201).json({
      success: true,
      message: 'Pre-booking submitted successfully and pending Super Admin approval!',
      visitor: savedVisitor
    });
  } catch (err) {
    console.error('Create Prebooking Error:', err);
    res.status(500).json({ message: err.message || 'Failed to submit pre-booking' });
  }
});

// Apply authMiddleware for secured pre-booking endpoints
router.use(authMiddleware);

// 2. Get All Pre-Bookings (Super Admin / Admin Dashboard)
router.get('/', async (req, res) => {
  try {
    const { status, branch } = req.query;
    const filter = {};

    if (req.userRole !== 'SaaS Super Admin' && req.companyId !== 'SYSTEM') {
      filter.companyId = req.companyId;
    }

    if (status && status !== 'All') {
      filter.status = status;
    }
    if (branch && branch !== 'All Branches') {
      filter.branch = branch;
    }

    const prebookingFilter = {
      ...filter,
      $or: [
        { registrationType: { $in: ['Pre-Booking', 'PreBooking', 'Invitation'] } },
        { visitType: 'PRE_BOOKING' },
        { bookingType: 'PRE_BOOKING' },
        { isPreBooking: true }
      ]
    };

    let visitorPreBookings = [];
    try {
      visitorPreBookings = await Visitor.find(prebookingFilter)
        .populate('approvedBy', 'name email role')
        .populate('statusHistory.changedBy', 'name email role')
        .sort({ createdAt: -1 });
    } catch (popErr) {
      console.warn('Populate failed on prebookings query, returning raw results:', popErr.message);
      visitorPreBookings = await Visitor.find(prebookingFilter).sort({ createdAt: -1 });
    }

    const PreBookingModel = require('../models/PreBooking');
    let modelPreBookings = [];
    try {
      modelPreBookings = await PreBookingModel.find({ ...filter, bookingType: { $ne: 'DIRECT_VISIT' } }).sort({ createdAt: -1 });
    } catch (err) {
      modelPreBookings = [];
    }

    const seenIds = new Set();
    const combined = [];
    for (const item of [...(visitorPreBookings || []), ...(modelPreBookings || [])]) {
      if (!item) continue;
      const idKey = String(item._id || item.id || '');
      if (idKey && !seenIds.has(idKey)) {
        seenIds.add(idKey);
        combined.push(item);
      }
    }

    res.json(combined);
  } catch (err) {
    console.error('Error fetching prebookings:', err);
    res.status(500).json({ message: err.message });
  }
});

// 3. Get Pre-Booking Details by ID or visitId
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const visitor = await Visitor.findOne({
      $or: [{ visitId: id }, { _id: require('mongoose').isValidObjectId(id) ? id : null }]
    })
    .populate('approvedBy', 'name email role')
    .populate('statusHistory.changedBy', 'name email role');

    if (!visitor) {
      return res.status(404).json({ message: 'Pre-booking visitor record not found.' });
    }

    res.json(visitor);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 4. Approve Pre-Booking (PENDING -> APPROVED + Generate Unique QR)
router.put('/:id/approve', authMiddleware, checkApprovalPermission, async (req, res) => {
  try {
    const { id } = req.params;
    const visitor = await Visitor.findOne({
      $or: [{ visitId: id }, { _id: require('mongoose').isValidObjectId(id) ? id : null }]
    });

    if (!visitor) {
      return res.status(404).json({ message: 'Visitor record not found.' });
    }

    const rawFrontendUrl = process.env.FRONTEND_URL || 'https://zone-monitor.vercel.app';
    const frontendUrl = String(rawFrontendUrl).replace(/[\r\n\t]/g, '').trim().replace(/\/+$/, '');
    const qrCode = `${frontendUrl}/pass/${visitor.visitId || visitor.visitorId || visitor._id}`;

    visitor.status = 'APPROVED';
    visitor.approvalStatus = 'APPROVED';
    visitor.qrCode = qrCode;
    visitor.approvalTime = new Date();
    visitor.approvedBy = req.user ? req.user.name : 'System';

    visitor.approvalDetails = {
      qrToken: require('crypto').randomBytes(16).toString('hex'),
      trackingToken: require('crypto').randomBytes(32).toString('hex'),
      trackingTokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      createdBy: req.user ? req.user._id : 'System',
      approvedByRole: req.user ? req.user.role : 'System',
      approvedAt: new Date(),
      method: 'Dashboard'
    };

    visitor.statusHistory.push({
      status: 'APPROVED',
      changedBy: req.user ? req.user._id : null,
      changedByRole: req.user ? req.user.role : 'System',
      changedAt: new Date(),
      reason: ''
    });

    const updatedVisitor = await visitor.save();

    await visitorNotificationService.notifyVisitorStatusChange({
      visitor: updatedVisitor,
      event: visitorNotificationService.EVENTS.VISITOR_APPROVED,
      io: req.app.get('io')
    });

    try {
      const { createNotification } = require('../services/notificationService');
      const vId = updatedVisitor.visitorId || updatedVisitor.visitId || updatedVisitor._id.toString();
      await createNotification({
        eventId: `PREBOOK_APPROVED_${vId}`,
        type: 'PRE_BOOKING_APPROVED',
        title: 'Pre-Booking Approved',
        message: `${updatedVisitor.fullName || updatedVisitor.visitorName}'s pre-booking has been approved.`,
        visitorId: vId,
        visitorType: 'PRE_BOOKING',
        recipients: [
          { role: 'Super Admin' },
          { role: 'SaaS Super Admin' },
          { role: 'Company Admin' },
          { role: 'Admin' },
          { role: 'MD' },
          { role: 'HR' },
          { role: 'Security' }
        ],
        companyId: updatedVisitor.companyId || req.companyId || 'FIC001',
        io: req.app.get('io')
      });
    } catch (e) {
      console.error('Error creating approval notification:', e);
    }

    if (updatedVisitor.email) {
      const emailService = require('../utils/emailService');
      const visitDateFormatted = updatedVisitor.visitDate ? new Date(updatedVisitor.visitDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'TBD';
      
      emailService.sendApprovalEmail({
        visitorName: updatedVisitor.visitorName,
        email: updatedVisitor.email,
        visitId: updatedVisitor.visitId,
        hostName: updatedVisitor.hostName,
        branch: updatedVisitor.branch,
        purpose: updatedVisitor.purpose,
        visitDate: visitDateFormatted,
        visitTime: updatedVisitor.expectedArrivalTime,
        passUrl: updatedVisitor.qrCode
      }).catch(err => {
        console.warn('Could not send approval email:', err.message);
      });
    }

    res.json({
      success: true,
      message: 'Pre-booking approved successfully and QR code generated!',
      visitor: updatedVisitor,
      data: updatedVisitor // maintaining backwards compatibility for existing frontend
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 5. Reject Pre-Booking (PENDING -> REJECTED)
router.put('/:id/reject', authMiddleware, checkApprovalPermission, async (req, res) => {
  try {
    const { id } = req.params;
    const { rejectionReason } = req.body;

    const visitor = await Visitor.findOne({
      $or: [{ visitId: id }, { _id: require('mongoose').isValidObjectId(id) ? id : null }]
    });

    if (!visitor) {
      return res.status(404).json({ message: 'Visitor record not found.' });
    }

    visitor.status = 'REJECTED';
    visitor.approvalStatus = 'REJECTED';
    visitor.rejectionReason = rejectionReason || `Rejected by ${req.user ? req.user.role : 'System'}`;
    visitor.activeBookingKey = null;
    visitor.activeEmailLock = null;
    visitor.activeMobileLock = null;

    visitor.statusHistory.push({
      status: 'REJECTED',
      changedBy: req.user ? req.user._id : null,
      changedByRole: req.user ? req.user.role : 'System',
      changedAt: new Date(),
      reason: visitor.rejectionReason
    });

    const updatedVisitor = await visitor.save();

    await visitorNotificationService.notifyVisitorStatusChange({
      visitor: updatedVisitor,
      event: visitorNotificationService.EVENTS.VISITOR_REJECTED,
      io: req.app.get('io')
    });

    if (updatedVisitor.email) {
      const emailService = require('../utils/emailService');
      emailService.sendRejectionEmail({
        visitorName: updatedVisitor.visitorName,
        email: updatedVisitor.email
      }).catch(err => {
        console.warn('Could not send rejection email:', err.message);
      });
    }

    res.json({
      success: true,
      message: 'Pre-booking rejected.',
      visitor: updatedVisitor
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 6. Check-In Pre-Booked Visitor (Must be APPROVED)
router.post('/:id/check-in', async (req, res) => {
  try {
    const { id } = req.params;
    const visitor = await Visitor.findOne({
      $or: [{ visitId: id }, { _id: require('mongoose').isValidObjectId(id) ? id : null }]
    });

    if (!visitor) {
      return res.status(404).json({ message: 'Visitor record not found.' });
    }

    // STRICT CHECK-IN VALIDATION
    if (visitor.status === 'PENDING') {
      return res.status(400).json({ message: 'Check-In Not Allowed: Pre-booking is PENDING Super Admin approval.' });
    }
    if (visitor.status === 'REJECTED') {
      return res.status(400).json({ message: 'Check-In Not Allowed: Pre-booking was REJECTED by Super Admin.' });
    }
    if (visitor.status === 'CHECKED_IN' || visitor.checkedIn) {
      return res.status(400).json({ message: 'Visitor is already checked in.' });
    }
    if (visitor.status !== 'APPROVED' && visitor.status !== 'Pre-Booked') {
      return res.status(400).json({ message: `Check-In Not Allowed: Invalid visitor status (${visitor.status}).` });
    }

    visitor.status = 'CHECKED_IN';
    visitor.checkedIn = true;
    visitor.checkInTime = new Date();
    visitor.entryTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    const updatedVisitor = await visitor.save();

    res.json({
      success: true,
      message: 'Visitor checked in successfully!',
      visitor: updatedVisitor
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 7. Check-Out Pre-Booked Visitor (MANDATORY EXIT NOTES)
router.post('/:id/check-out', async (req, res) => {
  try {
    const { id } = req.params;
    const { exitNotes } = req.body;

    // MANDATORY EXIT NOTES VALIDATION
    if (!exitNotes || typeof exitNotes !== 'string' || exitNotes.trim() === '') {
      return res.status(400).json({ message: 'Exit notes are mandatory before checking out. Please enter your exit notes.' });
    }

    const visitor = await Visitor.findOne({
      $or: [{ visitId: id }, { _id: require('mongoose').isValidObjectId(id) ? id : null }]
    });

    if (!visitor) {
      return res.status(404).json({ message: 'Visitor record not found.' });
    }

    if (visitor.status === 'CHECKED_OUT') {
      return res.status(400).json({ message: 'Visitor has already checked out.' });
    }

    visitor.status = 'CHECKED_OUT';
    visitor.checkedIn = false;
    visitor.exitNotes = exitNotes.trim();
    visitor.checkOutTime = new Date();
    visitor.exitTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    const updatedVisitor = await visitor.save();

    res.json({
      success: true,
      message: 'Visitor checked out successfully with exit notes saved!',
      visitor: updatedVisitor
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
