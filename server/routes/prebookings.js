const express = require('express');
const router = express.Router();
const Visitor = require('../models/Visitor');
const Notification = require('../models/Notification');
const authMiddleware = require('../middleware/authMiddleware');

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

    const companyId = req.headers['x-company-id'] || 'FIC001';
    const targetBranch = branch || 'Chennai';
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
      createdBy: 'Public Pre-Booking Workflow'
    });

    const savedVisitor = await newVisitor.save();

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

// 2. Get All Pre-Bookings (Super Admin / Admin Dashboard)
router.get('/', async (req, res) => {
  try {
    const { status, branch } = req.query;
    const filter = {};

    if (status && status !== 'All') {
      filter.status = status;
    }
    if (branch && branch !== 'All Branches') {
      filter.branch = branch;
    }

    const prebookings = await Visitor.find(filter).sort({ createdAt: -1 });
    res.json(prebookings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 3. Get Pre-Booking Details by ID or visitId
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const visitor = await Visitor.findOne({
      $or: [{ visitId: id }, { _id: require('mongoose').isValidObjectId(id) ? id : null }]
    });

    if (!visitor) {
      return res.status(404).json({ message: 'Pre-booking visitor record not found.' });
    }

    res.json(visitor);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 4. Approve Pre-Booking (PENDING -> APPROVED + Generate Unique QR)
router.put('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const visitor = await Visitor.findOne({
      $or: [{ visitId: id }, { _id: require('mongoose').isValidObjectId(id) ? id : null }]
    });

    if (!visitor) {
      return res.status(404).json({ message: 'Visitor record not found.' });
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const qrCode = `${frontendUrl}/pass/${visitor.visitId}`;

    visitor.status = 'APPROVED';
    visitor.qrCode = qrCode;
    visitor.approvalTime = new Date();
    visitor.approvedBy = req.body.approvedBy || 'Super Admin';

    const updatedVisitor = await visitor.save();

    // Create Approval Notification
    try {
      await Notification.create({
        companyId: visitor.companyId,
        title: 'Pre-Booking Approved',
        message: `Visitor ${visitor.visitorName} (${visitor.visitId}) has been APPROVED by Super Admin. QR pass generated.`,
        type: 'visitor',
        branch: visitor.branch,
        read: false
      });
    } catch (e) {
      console.warn('Notification error:', e.message);
    }

    res.json({
      success: true,
      message: 'Pre-booking approved successfully and QR code generated!',
      visitor: updatedVisitor
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 5. Reject Pre-Booking (PENDING -> REJECTED)
router.put('/:id/reject', async (req, res) => {
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
    visitor.rejectionReason = rejectionReason || 'Rejected by Super Admin';

    const updatedVisitor = await visitor.save();

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
