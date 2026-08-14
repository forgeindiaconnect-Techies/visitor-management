const express = require('express');
const router = express.Router();
const visitorNotificationService = require('../services/visitorNotificationService');
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');
const Visitor = require('../models/Visitor');
const VisitorProfile = require('../models/VisitorProfile');
const Notification = require('../models/Notification');
const authMiddleware = require('../middleware/authMiddleware');
const logAction = require('../utils/auditLogger');
const sendNotification = require('../utils/firebaseNotification');
const User = require('../models/User');
const Company = require('../models/Company');
const checkApprovalPermission = require('../middleware/approvalPermission');

router.use((req, res, next) => {
  if (req.path.startsWith('/pass/') || req.path.startsWith('/status/') || req.path.startsWith('/public-status/') || req.path === '/public-prebook' || req.path === '/upload') {
    return next();
  }
  authMiddleware(req, res, next);
});

const { v4: uuidv4 } = require('uuid');

// Configure Multer storage to use Cloudinary
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: (req, file) => {
      const company = req.companyId || 'UNKNOWN_COMPANY';
      const branch = req.branchId || req.headers['x-branch-id'] || 'General';
      const cleanBranch = branch.replace(/[^a-zA-Z0-9]/g, '_');
      return `fic-vms/${company}/${cleanBranch}`;
    },
    public_id: (req, file) => `${uuidv4()}`,
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 500, height: 500, crop: 'limit' }]
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB limit
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and WebP are allowed.'));
    }
  }
});


// Public Pre-Booking endpoint for Landing Page
router.post('/public-prebook', async (req, res) => {
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
      return res.status(400).json({ message: 'Full Name, Mobile Number, Host, and Purpose are required.' });
    }

    const companyId = req.headers['x-company-id'] || 'FIC001';
    const targetBranch = branch || 'Chennai';
    const profileId = 'VP-' + Date.now().toString().slice(-6);

    // Generate Order-Wise Sequential Visitor ID (e.g. VISIT1001, VISIT1002, VISIT1003...)
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
      status: 'PENDING',
      createdBy: 'Public Pre-Booking Landing Page',
      trackingToken: require('crypto').randomBytes(32).toString('hex'),
      trackingTokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    });

    const savedVisitor = await newVisitor.save();

    // Create Notification for Host / Admin
    try {
      const superAdmins = await User.find({
        companyId: companyId,
        role: 'Super Admin'
      });

      const superAdminNotifications = superAdmins.map((admin) => ({
        companyId,
        title: 'New Public Pre-Booking Request',
        message: `Visitor ${visitorName} pre-booked a visit to meet ${hostName} on ${visitDate}.`,
        type: 'Visitor',
        branch: targetBranch,
        recipient: admin._id,
        read: false
      }));

      if (superAdminNotifications.length > 0) {
        await Notification.insertMany(superAdminNotifications);
      }

      // Check if hostName matches an HR
      let matchedHr = null;
      if (hostName && hostName !== 'New Visitors') {
        matchedHr = await User.findOne({
          companyId: companyId,
          role: 'HR',
          name: new RegExp(`^${hostName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
        });

        if (matchedHr) {
          await Notification.create({
            companyId,
            title: 'New Public Pre-Booking Assigned',
            message: `Visitor ${visitorName} pre-booked a visit to meet you on ${visitDate}.`,
            type: 'Visitor',
            branch: targetBranch,
            recipient: matchedHr._id,
            read: false
          });
        }
      }

      const io = req.app.get('io');
      if (io) {
        io.emit('new_notification', {
          _id: 'notif_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
          createdAt: new Date().toISOString(),
          type: 'Visitor',
          title: 'New Public Pre-Booking Request',
          message: `Visitor ${visitorName} pre-booked a visit to meet ${hostName} on ${visitDate}.`,
          companyId: companyId,
          branchId: targetBranch,
          recipients: [
            ...superAdmins.map(admin => admin._id.toString()),
            ...(matchedHr ? [matchedHr._id.toString()] : [])
          ]
        });
      }
    } catch (notifErr) {
      console.warn('Could not create notification:', notifErr.message);
    }

    // Send tracking link email to visitor
    if (email) {
      const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
      const trackingUrl = `${FRONTEND_URL}/visitor-status/${savedVisitor.trackingToken}`;
      const visitDateFormatted = visitDate ? new Date(visitDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'TBD';
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
          <div style="background-color: #0f172a; color: white; padding: 16px 24px; border-radius: 8px 8px 0 0; text-align: center;">
            <h2 style="margin: 0; font-size: 20px;">Pre-Booking Submitted</h2>
          </div>
          <div style="padding: 24px; background-color: #ffffff;">
            <p style="font-size: 16px; color: #1e293b;">Hello <strong>${visitorName}</strong>,</p>
            <p style="font-size: 14px; color: #475569;">Your visitor appointment request has been successfully submitted.</p>
            <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; padding: 16px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 4px 0; font-size: 14px;"><strong>Status:</strong> <span style="color: #d97706; font-weight: bold;">Pending Approval</span></p>
              <p style="margin: 4px 0; font-size: 14px;"><strong>Host:</strong> ${hostName}</p>
              <p style="margin: 4px 0; font-size: 14px;"><strong>Appointment:</strong> ${visitDateFormatted}, ${expectedArrivalTime || '10:00 AM'}</p>
            </div>
            <p style="font-size: 14px; color: #475569;">You can track your appointment status here:</p>
            <div style="text-align: center; margin: 24px 0;">
              <a href="${trackingUrl}" target="_blank" style="background-color: #4f46e5; color: #ffffff; padding: 12px 28px; text-decoration: none; font-weight: bold; border-radius: 6px; display: inline-block; font-size: 14px;">TRACK MY VISIT</a>
            </div>
            <p style="font-size: 12px; color: #64748b;">You will receive another email when your appointment is approved.</p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
            <p style="font-size: 14px; color: #1e293b; margin: 0;">Thank You,<br/><strong>FIC Visitor Management</strong></p>
          </div>
        </div>
      `;
      const emailService = require('../utils/emailService');
      emailService.sendEmail(email, 'Pre-Booking Submitted — Track Your Visit', emailHtml).catch(err => {
        console.warn('Could not send tracking email:', err.message);
      });
    }

    res.status(201).json({
      success: true,
      message: 'Pre-booking pass generated successfully!',
      visitor: savedVisitor
    });
  } catch (err) {
    console.error('Public Pre-booking Error:', err);
    res.status(500).json({ message: err.message || 'Failed to complete pre-booking' });
  }
});

// Upload Visitor Photo Endpoint
router.post('/upload', upload.single('photo'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    // Return the Cloudinary URL
    res.json({ url: req.file.path });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get today's summary (counts by team)
router.get('/todays-summary', async (req, res) => {
  try {
    const { branchId, date } = req.query;

    const targetDateStr = date ? date : new Date().toISOString().split('T')[0];

    const matchStage = {
      companyId: req.companyId,
      visitDate: targetDateStr
    };

    if (req.userRole === 'Security' || req.userRole === 'Admin' || req.userRole === 'MD') {
      matchStage.branch = req.branchId;
    } else if (branchId && branchId !== 'All Branches') {
      const branchUpper = branchId.toUpperCase();
      const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      let searchRegexStr = escapeRegExp(branchId);

      if (branchUpper.includes('THIRUPATTUR')) {
        searchRegexStr = `${searchRegexStr}|Tirupattur`;
      } else if (branchUpper.includes('KRISHNAGIRI')) {
        searchRegexStr = `${searchRegexStr}|Salem`;
      } else if (branchUpper === 'BANGALORE') {
        searchRegexStr = `${searchRegexStr}|Bangalore`;
      }
      matchStage.branch = { $regex: new RegExp(`^(${searchRegexStr})$`, 'i') };
    }

    // Isolate HR users to ONLY see their own visitor counts
    if (req.userRole === 'HR') {
      const User = require('../models/User');
      const hrUser = await User.findById(req.userId);
      if (hrUser && hrUser.name) {
        matchStage.hostName = new RegExp(`^${hrUser.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
      } else {
        matchStage.hostName = 'DO_NOT_MATCH_ANYTHING';
      }
    }

    const totalAggregation = await Visitor.aggregate([
      { $match: matchStage },
      { $group: { _id: null, total: { $sum: { $ifNull: ["$visitorCount", 1] } } } }
    ]);
    const totalVisitorsToday = totalAggregation.length > 0 ? totalAggregation[0].total : 0;

    const hostCounts = await Visitor.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: "$hostName",
          count: { $sum: { $ifNull: ["$visitorCount", 1] } }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const teamBreakdown = hostCounts.map(t => ({
      hostName: t._id || 'Unknown',
      count: t.count
    }));

    res.json({ totalVisitorsToday, teamBreakdown });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get all visitors
router.get('/', async (req, res) => {
  try {
    let query = { companyId: req.companyId };

    if (req.query.status) {
      query.status = req.query.status;
    }

    // Enforce strict branch isolation based on role
    if (req.userRole === 'Security' || req.userRole === 'Admin' || req.userRole === 'MD') {
      query.branch = req.branchId;
    } else if (req.query.branch && req.query.branch !== 'All Branches') {
      // Super Admins can filter by branch
      const branchUpper = req.query.branch.toUpperCase();
      const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      let searchRegexStr = escapeRegExp(req.query.branch);

      if (branchUpper.includes('THIRUPATTUR')) {
        searchRegexStr = `${searchRegexStr}|Tirupattur`;
      } else if (branchUpper.includes('KRISHNAGIRI')) {
        searchRegexStr = `${searchRegexStr}|Salem`;
      } else if (branchUpper === 'BANGALORE') {
        searchRegexStr = `${searchRegexStr}|Bangalore`;
      }
      query.branch = { $regex: new RegExp(`^(${searchRegexStr})$`, 'i') };
    }

    // Isolate HR users to ONLY see visitors explicitly tagged to them
    if (req.userRole === 'HR') {
      const User = require('../models/User');
      const hrUser = await User.findById(req.userId);
      if (hrUser && hrUser.name) {
        // Find exact matches or case-insensitive matches for the HR user's name
        query.hostName = new RegExp(`^${hrUser.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
      } else {
        query.hostName = 'DO_NOT_MATCH_ANYTHING';
      }
    }

    const visitors = await Visitor.find(query)
      .populate('approvedBy', 'name email role')
      .populate('statusHistory.changedBy', 'name email role')
      .sort({ createdAt: -1 });
    res.json(visitors);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Add a new visitor
router.post('/', async (req, res) => {
  try {
    const { visitorName, mobileNumber, email, companyName, photoUrl } = req.body;

    // Check Blacklist
    const Blacklist = require('../models/Blacklist');
    const isBlacklisted = await Blacklist.findOne({ companyId: req.companyId, mobileNumber });
    if (isBlacklisted) {
      // Force status to Rejected for security audit logs
      req.body.status = 'Rejected';
    }

    // Enforce Monthly Visitor Limits based on Plan
    const Company = require('../models/Company');
    const planLimits = require('../config/plans');
    const company = await Company.findOne({ code: req.companyId });
    if (company && company.subscription) {
      const limits = planLimits[company.subscription];
      if (limits && limits.visitors !== -1) {
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const count = await Visitor.countDocuments({
          companyId: req.companyId,
          createdAt: { $gte: startOfMonth }
        });

        if (count >= limits.visitors) {
          return res.status(403).json({
            message: `Visitor limit reached. Your current plan (${company.subscription}) only allows up to ${limits.visitors} visitors per month. Please upgrade your subscription.`
          });
        }
      }
    }

    // 1. Upsert Visitor Profile
    let profile = await VisitorProfile.findOne({ companyId: req.companyId, mobileNumber });
    let profileId;
    if (!profile) {
      const lastProfile = await VisitorProfile.findOne({ companyId: req.companyId }).sort({ createdAt: -1 });
      let pNum = 1;
      if (lastProfile && lastProfile.profileId && lastProfile.profileId.startsWith('VIS')) {
        const match = lastProfile.profileId.match(/\d+$/);
        if (match) pNum = parseInt(match[0], 10) + 1;
      }
      profileId = `VIS${pNum.toString().padStart(3, '0')}`;
      profile = new VisitorProfile({
        companyId: req.companyId,
        profileId,
        mobileNumber,
        visitorName,
        email,
        companyName,
        photoUrl
      });
      await profile.save();
    } else {
      profileId = profile.profileId;
      // Update existing profile with latest details
      if (visitorName) profile.visitorName = visitorName;
      if (email) profile.email = email;
      if (companyName) profile.companyName = companyName;
      if (photoUrl) profile.photoUrl = photoUrl;
      await profile.save();
    }

    // 2. Generate unique Visit ID and Booking ID
    const lastVisitor = await Visitor.findOne({ companyId: req.companyId }).sort({ createdAt: -1 });
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
    const bookingId = req.body.bookingId || `BK${bNum.toString().padStart(6, '0')}`;

    // 3. Generate QR Code Data & URL
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const qrCode = `${frontendUrl}/pass/${visitId}`;
    const qrPayload = {
      bookingId: bookingId,
      visitorId: profileId,
      mobile: mobileNumber
    };

    // Determine visitType and initialStatus
    let visitType = 'PRE_BOOKING';
    if (hostName === 'New Visitors' || hostName === 'Direct Visit' || req.body.registrationType === 'Walk-in') {
      visitType = 'DIRECT_VISIT';
    }

    let initialStatus = req.body.isDraft ? 'Draft' : (req.body.status || 'Pending');
    if (visitType === 'DIRECT_VISIT' && !req.body.isDraft) {
      initialStatus = 'Approved'; // Bypass Pending Approval for Direct Visits
    }

    const visitor = new Visitor({
      ...req.body,
      companyId: req.companyId,
      visitorProfileId: profile._id,
      profileId,
      visitId,
      bookingId,
      qrCode,
      qrPayload,
      visitType,
      status: initialStatus,
      approvalStatus: initialStatus === 'Approved' ? 'APPROVED' : 'PENDING'
    });
    const newVisitor = await visitor.save();

    const notification = await Notification.create({
      companyId: req.companyId,
      branchId: newVisitor.branch,
      type: 'success',
      module: 'Visitors',
      title: initialStatus === 'Pre-Booked' ? '📅 Visitor Pre-Booked' : '👥 Visitor Registered',
      message: `${newVisitor.visitorName} has been registered for ${newVisitor.hostName || 'a visit'}.`,
      createdBy: req.user ? req.user.name : 'Security'
    });

    const io = req.app.get('io');
    if (io) {
      io.emit('new_notification', notification);
    }

    // Audit log
    await logAction(req, `Visitor Registered`, 'Visitor', {
      userId: req.user ? req.user._id : undefined,
      description: `Visitor ${newVisitor.visitorName} (${newVisitor.registrationType || 'Walk-in'}) was registered successfully.`,
      status: 'Success'
    });

    res.status(201).json(newVisitor);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Search visitor by Mobile Number, Booking ID, or Visit ID for Security Check-In
router.get('/search/:query', async (req, res) => {
  try {
    const rawQuery = req.params.query.trim();
    let searchTerm = rawQuery;

    // Handle scanned JSON QR Code
    if (rawQuery.startsWith('{')) {
      try {
        const parsed = JSON.parse(rawQuery);
        searchTerm = parsed.bookingId || parsed.mobile || parsed.visitorId || rawQuery;
      } catch (e) {
        // Not valid JSON, use raw text
      }
    }

    const visitor = await Visitor.findOne({
      companyId: req.companyId,
      $or: [
        { bookingId: searchTerm },
        { visitId: searchTerm },
        { mobileNumber: searchTerm },
        { aadhaarNumber: searchTerm },
        { profileId: searchTerm }
      ]
    }).sort({ createdAt: -1 });

    if (!visitor) {
      return res.status(404).json({ message: 'No booking or visitor found matching search criteria' });
    }

    res.json(visitor);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get a single visitor by visitId (for public pass page)
router.get('/pass/:visitId', async (req, res) => {
  try {
    const { visitId } = req.params;
    const isValidObjectId = require('mongoose').isValidObjectId(visitId);

    // 1. Try finding in Visitor collection
    let visitor = await Visitor.findOne({
      $or: [
        { visitId: visitId },
        { profileId: visitId },
        { bookingId: visitId },
        ...(isValidObjectId ? [{ _id: visitId }] : [])
      ]
    });

    // 2. If not found in Visitor, find in PreBooking collection
    if (!visitor) {
      const PreBooking = require('../models/PreBooking');
      const pb = await PreBooking.findOne({
        $or: [
          { visitorId: visitId },
          { qrToken: visitId },
          ...(isValidObjectId ? [{ _id: visitId }] : [])
        ]
      });

      if (pb) {
        visitor = {
          id: pb._id,
          _id: pb._id,
          visitId: pb.visitorId,
          profileId: pb.visitorId,
          visitorName: pb.fullName,
          fullName: pb.fullName,
          mobileNumber: pb.mobileNumber,
          email: pb.email,
          companyName: pb.visitingCompany || 'Forge India Connect Private Limited',
          hostName: pb.hostEmployee,
          purpose: pb.visitPurpose,
          visitDate: pb.visitDate,
          expectedArrivalTime: pb.expectedTime,
          branch: pb.branchLocation || 'Head Office',
          vehicleNumber: pb.vehicleNumber,
          photoUrl: pb.facePhoto,
          status: pb.status === 'PENDING' ? 'Pending' : (pb.status === 'APPROVED' ? 'Approved' : (pb.status === 'CHECKED_IN' ? 'Inside' : pb.status)),
          createdAt: pb.createdAt
        };
      }
    }

    if (!visitor) {
      return res.status(404).json({
        success: false,
        message: 'Visitor pass not found or invalid QR code.'
      });
    }

    return res.json(visitor);
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

// POST /scan-pass - Unified secure QR Validation
router.post('/scan-pass', async (req, res) => {
  try {
    const { passToken } = req.body;
    if (!passToken) {
      return res.status(400).json({ valid: false, message: 'Invalid pass token provided.' });
    }
    
    // Clean token if a full URL was scanned
    let cleanToken = passToken.trim();
    if (cleanToken.includes('/pass/')) {
      const parts = cleanToken.split('/pass/');
      cleanToken = parts[parts.length - 1];
    }
    
    const isValidObjectId = require('mongoose').isValidObjectId(cleanToken);
    
    // 1. Try finding in Visitor collection
    let visitor = await Visitor.findOne({
      $or: [
        { visitId: cleanToken },
        { profileId: cleanToken },
        { bookingId: cleanToken },
        ...(isValidObjectId ? [{ _id: cleanToken }] : [])
      ]
    });
    
    // 2. If not found in Visitor, find in PreBooking collection
    if (!visitor) {
      const PreBooking = require('../models/PreBooking');
      const pb = await PreBooking.findOne({
        $or: [
          { visitorId: cleanToken },
          { qrToken: cleanToken },
          ...(isValidObjectId ? [{ _id: cleanToken }] : [])
        ]
      });
      if (pb) visitor = pb;
    }
    
    if (!visitor) {
      return res.status(404).json({ valid: false, message: 'Visitor pass not found or invalid QR code.' });
    }
    
    const isPreBooking = visitor.visitorType === 'PRE_BOOKING' || visitor.visitType === 'PRE_BOOKING' || visitor.visitType !== 'DIRECT_VISIT'; // Handle older records safely
    const approvalStatus = visitor.approvalStatus || visitor.status;
    
    if (isPreBooking) {
      if (['PENDING', 'Pending'].includes(approvalStatus)) {
        return res.json({ valid: false, message: '⚠ Approval Pending: This visitor has not been approved yet.' });
      }
      if (['REJECTED', 'Rejected'].includes(approvalStatus)) {
        return res.json({ valid: false, message: '❌ This visitor appointment has been rejected.' });
      }
      if (['CANCELLED', 'Cancelled'].includes(approvalStatus)) {
        return res.json({ valid: false, message: '✕ Appointment Cancelled: This pass cannot be used.' });
      }
    }
    
    if (['CHECKED_IN', 'Inside', 'Checked In'].includes(visitor.status) || visitor.checkedIn) {
      return res.json({ valid: false, message: '⚠ Already Checked In' });
    }
    
    if (['CHECKED_OUT', 'Exited', 'Checked Out'].includes(visitor.status)) {
      return res.json({ valid: false, message: '⚠ Visitor has already checked out.' });
    }
    
    // Date Validation
    const today = new Date();
    // Normalize to YYYY-MM-DD local timezone equivalent for comparison
    const todayStr = new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0]; 
    const appointmentDateStr = visitor.visitDate || visitor.appointmentDate; // E.g. '2026-08-22'
    
    if (appointmentDateStr && appointmentDateStr !== todayStr) {
      return res.json({ valid: false, message: '⚠ Appointment Not Active: The appointment date is not today.' });
    }
    
    // Time Validation
    const expectedTimeStr = visitor.expectedArrivalTime || visitor.expectedTime; // e.g. "02:00 PM"
    if (expectedTimeStr) {
      const timeRegex = /(\d{1,2}):(\d{2})\s*(AM|PM)/i;
      const match = expectedTimeStr.match(timeRegex);
      if (match) {
        let [_, hours, minutes, ampm] = match;
        hours = parseInt(hours, 10);
        minutes = parseInt(minutes, 10);
        if (ampm.toUpperCase() === 'PM' && hours < 12) hours += 12;
        if (ampm.toUpperCase() === 'AM' && hours === 12) hours = 0;
        
        const appointmentTime = new Date();
        appointmentTime.setHours(hours, minutes, 0, 0);
        
        const diffMinutes = (today - appointmentTime) / 60000;
        // Check-in allowed: 15 mins early to 120 mins late
        if (diffMinutes < -15) {
          return res.json({ valid: false, message: '⚠ Appointment Not Active: You are too early for your appointment.' });
        }
        if (diffMinutes > 120) {
          return res.json({ valid: false, message: '⚠ Appointment Not Active: Your appointment time has expired.' });
        }
      }
    }
    
    // Valid Pass
    return res.json({
      success: true,
      valid: true,
      visitor: {
        id: visitor._id,
        visitId: visitor.visitId || visitor.visitorId,
        visitorName: visitor.visitorName || visitor.fullName,
        hostName: visitor.hostName || visitor.hostEmployee,
        appointmentDate: appointmentDateStr,
        appointmentTime: expectedTimeStr,
        approvalStatus: approvalStatus,
        visitType: visitor.visitType || visitor.visitorType,
        photoUrl: visitor.facePhoto || visitor.photoUrl,
        mobileNumber: visitor.mobileNumber,
        purpose: visitor.purpose || visitor.visitPurpose
      }
    });
  } catch (err) {
    return res.status(500).json({ valid: false, message: err.message });
  }
});
// POST /:id/check-in - Secure Check-In
router.post('/:id/check-in', async (req, res) => {
  try {
    const { id } = req.params;
    const isValidObjectId = require('mongoose').isValidObjectId(id);
    
    let visitor = await Visitor.findOne({
      $or: [
        { visitId: id },
        { profileId: id },
        { bookingId: id },
        ...(isValidObjectId ? [{ _id: id }] : [])
      ]
    });

    if (!visitor) {
      const PreBooking = require('../models/PreBooking');
      const pb = await PreBooking.findOne({
        $or: [
          { visitorId: id },
          { qrToken: id },
          ...(isValidObjectId ? [{ _id: id }] : [])
        ]
      });
      if (!pb) {
        return res.status(404).json({ success: false, message: 'Visitor not found.' });
      }
      
      // Upgrade PreBooking to Visitor record
      visitor = new Visitor({
        companyId: pb.companyId,
        branch: pb.branchLocation,
        visitorName: pb.fullName,
        mobileNumber: pb.mobileNumber,
        email: pb.email,
        companyName: pb.visitingCompany,
        hostName: pb.hostEmployee,
        hostId: pb.assignedHr,
        visitType: pb.visitorType || 'PRE_BOOKING',
        purpose: pb.visitPurpose,
        visitDate: pb.visitDate,
        expectedArrivalTime: pb.expectedTime,
        status: 'CHECKED_IN',
        approvalStatus: pb.status === 'PENDING' ? 'PENDING' : 'APPROVED', // Keep current approval status
        checkedIn: true,
        entryTime: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
        facePhoto: pb.facePhoto,
        idType: pb.idType,
        idProofUrl: pb.idProofUrl,
        vehicleNumber: pb.vehicleNumber,
        profileId: pb.visitorId,
        visitId: pb.visitorId
      });
    }

    const isPreBooking = visitor.visitorType === 'PRE_BOOKING' || visitor.visitType === 'PRE_BOOKING' || visitor.visitType !== 'DIRECT_VISIT';
    const approvalStatus = visitor.approvalStatus || visitor.status;

    // Security Validations
    if (isPreBooking && !['APPROVED', 'DATE_CHANGED', 'TIME_CHANGED', 'Approved'].includes(approvalStatus)) {
      return res.status(403).json({ success: false, message: 'Visitor is not approved for entry.' });
    }

    if (['CHECKED_IN', 'Inside', 'Checked In'].includes(visitor.status) || visitor.checkedIn) {
      return res.status(400).json({ success: false, message: 'Visitor is already checked in.' });
    }

    // Set state
    visitor.status = 'CHECKED_IN';
    visitor.checkedIn = true;
    visitor.entryTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    visitor.statusHistory.push({
      status: 'CHECKED_IN',
      changedBy: (req.user && req.user._id) || null,
      changedByRole: (req.user && req.user.role) || 'Security',
      changedAt: new Date(),
      reason: 'Verified by Security'
    });

    const updatedVisitor = await visitor.save();

    await visitorNotificationService.notifyVisitorStatusChange({
      visitor: updatedVisitor,
      event: visitorNotificationService.EVENTS.VISITOR_CHECKED_IN,
      io: req.app.get('io')
    });

    res.json({ success: true, visitor: updatedVisitor });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /:id/check-out - Secure Check-Out
router.post('/:id/check-out', async (req, res) => {
  try {
    const { id } = req.params;
    const isValidObjectId = require('mongoose').isValidObjectId(id);
    
    let visitor = await Visitor.findOne({
      $or: [
        { visitId: id },
        { profileId: id },
        { bookingId: id },
        ...(isValidObjectId ? [{ _id: id }] : [])
      ]
    });

    if (!visitor) {
      return res.status(404).json({ success: false, message: 'Visitor not found in active registry.' });
    }

    if (!['CHECKED_IN', 'Inside', 'Checked In'].includes(visitor.status) && !visitor.checkedIn) {
      return res.status(400).json({ success: false, message: 'Visitor is not checked in.' });
    }

    visitor.status = 'CHECKED_OUT';
    visitor.exitTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    visitor.statusHistory.push({
      status: 'CHECKED_OUT',
      changedBy: (req.user && req.user._id) || null,
      changedByRole: (req.user && req.user.role) || 'Security',
      changedAt: new Date(),
      reason: 'Checked out by Security'
    });

    const updatedVisitor = await visitor.save();

    await visitorNotificationService.notifyVisitorStatusChange({
      visitor: updatedVisitor,
      event: visitorNotificationService.EVENTS.VISITOR_CHECKED_OUT,
      io: req.app.get('io')
    });

    res.json({ success: true, visitor: updatedVisitor });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET Secure Visitor Status by Tracking Token (Public - no auth required)
router.get('/public-status/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const PreBooking = require('../models/PreBooking');

    // Search Visitor collection first
    let visitor = await Visitor.findOne({ trackingToken: token })
      .populate('approvedBy', 'name role')
      .populate('statusHistory.changedBy', 'name role');

    let source = 'visitor';

    // Fallback to PreBooking collection
    if (!visitor) {
      const pb = await PreBooking.findOne({ trackingToken: token })
        .populate('approvedBy', 'name role')
        .populate('statusHistory.changedBy', 'name role');
      if (pb) {
        visitor = pb;
        source = 'prebooking';
      }
    }

    if (!visitor) {
      return res.status(404).json({ success: false, message: 'Tracking link is invalid or visitor not found.' });
    }

    // Check token expiry
    if (visitor.trackingTokenExpiresAt && visitor.trackingTokenExpiresAt < new Date()) {
      return res.status(410).json({ success: false, expired: true, message: 'Tracking link has expired.' });
    }

    // Build safe payload — never expose internal fields
    const approvalStatus = visitor.approvalStatus || visitor.status;
    const approvedByUser = visitor.approvedBy;
    const approvalData = {
      approvedBy: (approvedByUser?.name) || visitor.approvalDetails?.approvedBy || null,
      approvedByRole: (approvedByUser?.role) || visitor.approvedByRole || visitor.approvalDetails?.approvedByRole || null,
      approvedAt: visitor.approvedAt || visitor.approvalDetails?.approvedAt || null,
    };

    let appointmentDate = null;
    let appointmentStartTime = null;
    let appointmentEndTime = null;
    let hostName = null;
    let visitorName = null;
    let visitorEmail = null;
    let visitType = null;

    if (source === 'visitor') {
      appointmentDate = visitor.visitDate;
      appointmentStartTime = visitor.expectedArrivalTime;
      appointmentEndTime = visitor.appointmentEndTime;
      hostName = visitor.hostName;
      visitorName = visitor.visitorName;
      visitorEmail = visitor.email;
      visitType = visitor.visitType || 'PRE_BOOKING';
    } else {
      appointmentDate = visitor.visitDate ? (visitor.visitDate instanceof Date ? visitor.visitDate.toISOString().split('T')[0] : visitor.visitDate) : null;
      appointmentStartTime = visitor.expectedTime;
      appointmentEndTime = null;
      hostName = visitor.hostEmployee;
      visitorName = visitor.fullName;
      visitorEmail = visitor.email;
      visitType = 'PRE_BOOKING';
    }

    return res.json({
      success: true,
      visitor: {
        name: visitorName,
        email: visitorEmail,
        visitType,
        approvalStatus,
        appointmentDate,
        appointmentStartTime,
        appointmentEndTime,
        hostName,
        // Pass internal ID only for QR pass rendering — NOT the trackingToken
        passId: visitor._id.toString()
      },
      approval: approvalData,
      statusHistory: (visitor.statusHistory || []).map(h => ({
        status: h.status,
        changedByName: h.changedBy?.name || null,
        changedByRole: h.changedByRole || h.changedBy?.role || null,
        changedAt: h.changedAt,
        reason: h.reason || null
      }))
    });

  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET Public Visitor Status
router.get('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const isValidObjectId = require('mongoose').isValidObjectId(id);
    
    let visitor = await Visitor.findOne({
      $or: [
        { visitId: id },
        { profileId: id },
        { bookingId: id },
        ...(isValidObjectId ? [{ _id: id }] : [])
      ]
    }).populate('approvedBy', 'name role').populate('statusHistory.changedBy', 'name role');

    let approvalStatus = null;
    let appointmentDate = null;
    let appointmentStartTime = null;
    let appointmentEndTime = null;
    let hostName = null;
    let visitorName = null;
    let email = null;
    let visitType = null;
    let approvedBy = null;
    let approvedByRole = null;
    let approvedAt = null;
    let statusHistory = [];

    if (visitor) {
      approvalStatus = visitor.approvalStatus || visitor.status;
      appointmentDate = visitor.visitDate;
      appointmentStartTime = visitor.expectedArrivalTime;
      appointmentEndTime = visitor.appointmentEndTime;
      hostName = visitor.hostName;
      visitorName = visitor.visitorName;
      email = visitor.email;
      visitType = visitor.visitType || 'PRE_BOOKING';
      approvedBy = visitor.approvedBy?.name || visitor.approvedByRole || visitor.approvalDetails?.approvedBy || null;
      approvedByRole = visitor.approvedBy?.role || visitor.approvalDetails?.approvedByRole || null;
      approvedAt = visitor.approvedAt || visitor.approvalDetails?.approvedAt || null;
      statusHistory = visitor.statusHistory || [];
    } else {
      const PreBooking = require('../models/PreBooking');
      const pb = await PreBooking.findOne({
        $or: [
          { visitorId: id },
          { qrToken: id },
          ...(isValidObjectId ? [{ _id: id }] : [])
        ]
      }).populate('approvedBy', 'name role').populate('statusHistory.changedBy', 'name role');

      if (!pb) {
        return res.status(404).json({ success: false, message: 'Visitor not found' });
      }

      approvalStatus = pb.approvalStatus || pb.status;
      appointmentDate = pb.visitDate ? pb.visitDate.toISOString().split('T')[0] : null;
      appointmentStartTime = pb.expectedTime;
      appointmentEndTime = null;
      hostName = pb.hostEmployee;
      visitorName = pb.fullName;
      email = pb.email;
      visitType = pb.visitorType || 'PRE_BOOKING';
      
      approvedBy = pb.approvedBy?.name || pb.approvedByRole || pb.approvalDetails?.approvedBy || null;
      approvedByRole = pb.approvedBy?.role || pb.approvalDetails?.approvedByRole || null;
      approvedAt = pb.approvedAt || pb.approvalDetails?.approvedAt || null;
      statusHistory = pb.statusHistory || [];
    }

    return res.json({
      success: true,
      visitor: {
        id: id,
        name: visitorName,
        email: email,
        visitType: visitType,
        approvalStatus: approvalStatus,
        appointmentDate: appointmentDate,
        appointmentStartTime: appointmentStartTime,
        appointmentEndTime: appointmentEndTime,
        hostName: hostName
      },
      approval: {
        approvedBy: approvedBy,
        approvedByRole: approvedByRole,
        approvedAt: approvedAt
      },
      statusHistory: statusHistory
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET Visitor Status History (Audit Trail)
router.get('/:id/status-history', async (req, res) => {
  try {
    const { id } = req.params;
    const isValidObjectId = require('mongoose').isValidObjectId(id);
    
    let visitor = await Visitor.findOne({
      $or: [
        { visitId: id },
        { profileId: id },
        { bookingId: id },
        ...(isValidObjectId ? [{ _id: id }] : [])
      ]
    }).populate('statusHistory.changedBy', 'name email role');

    if (!visitor) {
      return res.status(404).json({ success: false, message: 'Visitor not found' });
    }

    return res.json({
      success: true,
      history: visitor.statusHistory || []
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

const buildVisitorQuery = (id, companyId) => {
  const isValidObjectId = require('mongoose').isValidObjectId(id);
  const orConditions = [{ visitId: id }, { bookingId: id }];
  if (isValidObjectId) {
    orConditions.push({ _id: id });
  }
  return { companyId, $or: orConditions };
};

// Host Approve Visitor Endpoint
router.patch('/:id/approve', checkApprovalPermission, async (req, res) => {
  try {
    const visitor = await Visitor.findOne(buildVisitorQuery(req.params.id, req.companyId));
    if (!visitor) return res.status(404).json({ message: 'Visitor request not found' });
    
    // Prevent duplicate approval
    if (visitor.status === 'Approved' || visitor.approvalStatus === 'APPROVED') {
      return res.status(400).json({ success: false, message: 'Visitor is already approved' });
    }

    const reqUserId = req.userId || (req.user && req.user._id) || null;
    const reqUserRole = req.userRole || (req.user && req.user.role) || null;
    const reqUserName = (req.user && req.user.name) || req.body.approvedBy || visitor.hostName || 'Host';

    visitor.status = 'Approved';
    visitor.approvalStatus = 'APPROVED';
    
    // Strict schema fields
    visitor.approvedBy = reqUserId;
    visitor.approvedByRole = reqUserRole;
    visitor.approvedAt = new Date();
    
    // Legacy fields
    visitor.approvalTime = new Date();

    visitor.approvalDetails = {
      approvedBy: reqUserId || 'System',
      approvedByRole: reqUserRole || 'System',
      approvedAt: new Date(),
      method: 'Dashboard'
    };

    visitor.statusHistory.push({
      status: 'APPROVED',
      changedBy: reqUserId,
      changedByRole: reqUserRole || 'System',
      changedAt: new Date(),
      reason: ''
    });
    
    // Ensure bookingId exists
    if (!visitor.bookingId) {
      const lastVisitor = await Visitor.findOne({ companyId: req.companyId, bookingId: { $exists: true } }).sort({ createdAt: -1 });
      let bNum = 1;
      if (lastVisitor && lastVisitor.bookingId && lastVisitor.bookingId.startsWith('BK')) {
        const bMatch = lastVisitor.bookingId.match(/\d+$/);
        if (bMatch) bNum = parseInt(bMatch[0], 10) + 1;
      }
      visitor.bookingId = `BK${bNum.toString().padStart(6, '0')}`;
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    visitor.qrCode = `${frontendUrl}/pass/${visitor.visitId || visitor._id}`;
    visitor.qrPayload = {
      bookingId: visitor.bookingId,
      visitorId: visitor.profileId || visitor.visitId,
      mobile: visitor.mobileNumber
    };

    const updatedVisitor = await visitor.save();

    // Trigger Notifications & Emails
    await visitorNotificationService.notifyVisitorStatusChange({
      visitor: updatedVisitor,
      event: visitorNotificationService.EVENTS.VISITOR_APPROVED,
      changedBy: req.user,
      io: req.app.get('io')
    });

    await logAction(req, `Visitor Pre-Booking Approved`, 'Visitor', {
      userId: req.user ? req.user._id : undefined,
      description: `Host ${updatedVisitor.approvedBy} approved visitor ${updatedVisitor.visitorName} (Booking: ${updatedVisitor.bookingId}).`,
      status: 'Success'
    });

    res.json(updatedVisitor);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Host Reject Visitor Endpoint
router.patch('/:id/reject', checkApprovalPermission, async (req, res) => {
  try {
    const visitor = await Visitor.findOne(buildVisitorQuery(req.params.id, req.companyId));
    if (!visitor) return res.status(404).json({ message: 'Visitor request not found' });

    // Prevent duplicate rejection
    if (visitor.status === 'Rejected' || visitor.approvalStatus === 'REJECTED') {
      return res.status(400).json({ success: false, message: 'Visitor is already rejected' });
    }

    const reqUserId = req.userId || (req.user && req.user._id) || null;
    const reqUserRole = req.userRole || (req.user && req.user.role) || null;
    const reqUserName = (req.user && req.user.name) || req.body.approvedBy || visitor.hostName || 'Host';

    visitor.status = 'Rejected';
    visitor.approvalStatus = 'REJECTED';
    visitor.rejectionReason = req.body.rejectionReason || 'Meeting Cancelled';
    
    // Strict schema fields
    visitor.approvedBy = reqUserId;
    visitor.approvedByRole = reqUserRole;
    visitor.approvedAt = new Date();

    visitor.statusHistory.push({
      status: 'REJECTED',
      changedBy: reqUserId,
      changedByRole: reqUserRole || 'System',
      changedAt: new Date(),
      reason: visitor.rejectionReason
    });

    const updatedVisitor = await visitor.save();
    
    // Trigger Notifications & Emails
    await visitorNotificationService.notifyVisitorStatusChange({
      visitor: updatedVisitor,
      event: visitorNotificationService.EVENTS.VISITOR_REJECTED,
      changedBy: req.user,
      reason: updatedVisitor.rejectionReason,
      io: req.app.get('io')
    });

    await logAction(req, `Visitor Pre-Booking Rejected`, 'Visitor', {
      userId: req.user ? req.user._id : undefined,
      description: `Host ${updatedVisitor.approvedBy} rejected visitor ${updatedVisitor.visitorName}. Reason: ${updatedVisitor.rejectionReason}.`,
      status: 'Success'
    });

    res.json(updatedVisitor);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Host Reschedule Visitor Endpoint
router.patch('/:id/reschedule', async (req, res) => {
  try {
    const visitor = await Visitor.findOne(buildVisitorQuery(req.params.id, req.companyId));
    if (!visitor) return res.status(404).json({ message: 'Visitor request not found' });
    
    if (visitor.visitType !== 'PRE_BOOKING' && visitor.visitType !== 'Pre-Booking') {
      return res.status(400).json({ success: false, message: 'Only Pre-Booking visitors can be rescheduled.' });
    }

    const { visitDate, expectedArrivalTime, appointmentEndTime, reason } = req.body;
    let changes = [];
    let primaryStatus = '';
    
    // Capture previous values BEFORE updating
    const previousDate = visitor.visitDate;
    const previousStartTime = visitor.expectedArrivalTime;
    const previousEndTime = visitor.appointmentEndTime;

    // Time validation if both provided
    if (expectedArrivalTime && appointmentEndTime) {
      const startParts = expectedArrivalTime.match(/(\d+):(\d+)\s+(AM|PM)/i);
      const endParts = appointmentEndTime.match(/(\d+):(\d+)\s+(AM|PM)/i);
      
      if (startParts && endParts) {
        let startH = parseInt(startParts[1]);
        if (startParts[3].toUpperCase() === 'PM' && startH !== 12) startH += 12;
        if (startParts[3].toUpperCase() === 'AM' && startH === 12) startH = 0;
        
        let endH = parseInt(endParts[1]);
        if (endParts[3].toUpperCase() === 'PM' && endH !== 12) endH += 12;
        if (endParts[3].toUpperCase() === 'AM' && endH === 12) endH = 0;
        
        const startM = parseInt(startParts[2]);
        const endM = parseInt(endParts[2]);
        
        const startTime = startH * 60 + startM;
        const endTime = endH * 60 + endM;
        
        if (endTime <= startTime) {
          return res.status(400).json({ success: false, message: 'End time must be after start time' });
        }
      }
    }
    
    if (visitDate && visitDate !== previousDate) {
      changes.push(`Date changed from ${previousDate} to ${visitDate}`);
      visitor.visitDate = visitDate;
      primaryStatus = 'DATE_CHANGED';
    }
    
    if (expectedArrivalTime && expectedArrivalTime !== previousStartTime) {
      changes.push(`Time changed from ${previousStartTime} to ${expectedArrivalTime}`);
      visitor.expectedArrivalTime = expectedArrivalTime;
      if (!primaryStatus) primaryStatus = 'TIME_CHANGED';
    }

    if (appointmentEndTime && appointmentEndTime !== previousEndTime) {
      changes.push(`End time changed from ${previousEndTime || 'N/A'} to ${appointmentEndTime}`);
      visitor.appointmentEndTime = appointmentEndTime;
      if (!primaryStatus) primaryStatus = 'TIME_CHANGED';
    }
    
    if (changes.length > 0) {
      const reqUserId = req.userId || (req.user && req.user._id) || null;
      const reqUserRole = req.userRole || (req.user && req.user.role) || 'System';
      const reqUserName = (req.user && req.user.name) || 'System';
      
      const historyEntry = {
        status: primaryStatus,
        changedBy: reqUserId,
        changedByRole: reqUserRole,
        changedAt: new Date(),
        reason: reason || changes.join(', ')
      };

      if (visitDate && visitDate !== previousDate) {
        historyEntry.previousAppointmentDate = previousDate;
        historyEntry.newAppointmentDate = visitDate;
      }
      if (expectedArrivalTime && expectedArrivalTime !== previousStartTime) {
        historyEntry.previousAppointmentStartTime = previousStartTime;
        historyEntry.newAppointmentStartTime = expectedArrivalTime;
      }
      if (appointmentEndTime && appointmentEndTime !== previousEndTime) {
        historyEntry.previousAppointmentEndTime = previousEndTime;
        historyEntry.newAppointmentEndTime = appointmentEndTime;
      }

      visitor.statusHistory.push(historyEntry);
      
      visitor.approvalStatus = primaryStatus;
      visitor.status = primaryStatus;

      const updatedVisitor = await visitor.save();
      
      // Trigger Notifications
      await visitorNotificationService.notifyVisitorStatusChange({
        visitor: updatedVisitor,
        event: visitorNotificationService.EVENTS.APPOINTMENT_RESCHEDULED,
        changedBy: req.user,
        reason: reason || changes.join(', '),
        historyEntry,
        io: req.app.get('io')
      });

      await logAction(req, `Visitor Rescheduled`, 'Visitor', {
        userId: req.user ? req.user._id : undefined,
        description: `Visit for ${updatedVisitor.visitorName} rescheduled. ${changes.join(', ')}`,
        status: 'Success'
      });

      return res.json(updatedVisitor);
    }
    
    res.json(visitor);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Update visitor status/tracking
router.patch('/:id', async (req, res) => {
  try {
    const query = buildVisitorQuery(req.params.id, req.companyId);
    const oldVisitor = await Visitor.findOne(query);
    
    // Auto-set timestamps when status changes to Checked In or Checked Out
    if (req.body.status === 'Checked In' || req.body.status === 'Inside') {
      req.body.entryTime = req.body.entryTime || new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      req.body.checkedIn = true;
    } else if (req.body.status === 'Checked Out' || req.body.status === 'Exited' || req.body.status === 'Completed') {
      req.body.exitTime = req.body.exitTime || new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    }

    const updatedVisitor = await Visitor.findOneAndUpdate(
      query,
      req.body,
      { new: true }
    );

    // Check if status changed to Approved or Rejected
    if (req.body.status && oldVisitor && oldVisitor.status !== req.body.status) {
      if (req.body.status === 'Approved' || req.body.status === 'Rejected') {
        const action = req.body.status === 'Approved' ? 'approved' : 'rejected';
        const notification = await Notification.create({
          companyId: req.companyId,
          branchId: updatedVisitor.branch,
          type: req.body.status === 'Approved' ? 'success' : 'error',
          module: 'Visitors',
          title: `👥 Visitor ${req.body.status}`,
          message: `${updatedVisitor.visitorName} has been ${action} by ${req.body.approvedBy || 'Admin'}.`,
          createdBy: req.body.approvedBy || 'System'
        });

        const io = req.app.get('io');
        if (io) {
          io.emit('new_notification', notification);
        }

        // Send Firebase Push Notification to the Host
        const hostUser = await User.findOne({
          companyId: req.companyId,
          name: updatedVisitor.hostName
        });

        if (hostUser && hostUser.fcmToken) {
          await sendNotification(
            hostUser.fcmToken,
            `Visitor ${req.body.status}`,
            `${updatedVisitor.visitorName} has been ${req.body.status.toLowerCase()}.`
          );
        }
      }
    }

    // Audit Log for any status change
    if (req.body.status && oldVisitor && oldVisitor.status !== req.body.status) {
      await logAction(req, `Visitor Status Changed`, 'Visitor', {
        userId: req.user ? req.user._id : undefined,
        description: `Visitor ${oldVisitor.visitorName}'s status changed from ${oldVisitor.status} to ${req.body.status}.`,
        status: 'Success'
      });
    }

    if ((req.body.status === 'Checked In' || req.body.status === 'Inside') && oldVisitor && (oldVisitor.status !== 'Checked In' && oldVisitor.status !== 'Inside')) {
      await visitorNotificationService.notifyVisitorStatusChange({
        visitor: updatedVisitor,
        event: visitorNotificationService.EVENTS.VISITOR_CHECKED_IN,
        io: req.app.get('io')
      });
    } else if ((req.body.status === 'Checked Out' || req.body.status === 'Exited') && oldVisitor && (oldVisitor.status !== 'Checked Out' && oldVisitor.status !== 'Exited')) {
      await visitorNotificationService.notifyVisitorStatusChange({
        visitor: updatedVisitor,
        event: visitorNotificationService.EVENTS.VISITOR_CHECKED_OUT,
        io: req.app.get('io')
      });
    } else if (req.body.status === 'Cancelled' && oldVisitor && oldVisitor.status !== 'Cancelled') {
      await visitorNotificationService.notifyVisitorStatusChange({
        visitor: updatedVisitor,
        event: visitorNotificationService.EVENTS.VISITOR_CANCELLED,
        io: req.app.get('io')
      });
    }

    res.json(updatedVisitor);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Update visitor zone and log history
router.patch('/:id/zone', async (req, res) => {
  try {
    const { status, currentZone, entryTime, exitTime, checkedIn, remarks, purpose } = req.body;
    const visitor = await Visitor.findOne(buildVisitorQuery(req.params.id, req.companyId));
    if (!visitor) return res.status(404).json({ message: 'Visitor not found' });

    // Initialize zoneLogs if undefined (for backwards compatibility)
    if (!visitor.zoneLogs) {
      visitor.zoneLogs = [];
    }

    // If leaving a zone (moving to a new one or exiting building entirely)
    if (visitor.currentZone && visitor.status === 'Inside') {
      const lastLogIndex = visitor.zoneLogs.length - 1;

      // We need to close the last log if it exists and hasn't been closed
      if (lastLogIndex >= 0 && !visitor.zoneLogs[lastLogIndex].exitTime) {
        visitor.zoneLogs[lastLogIndex].exitTime = new Date();
        const entry = visitor.zoneLogs[lastLogIndex].entryTime;
        const durationMs = new Date() - entry;
        visitor.zoneLogs[lastLogIndex].durationMinutes = Math.round(durationMs / 60000);
      } else if (lastLogIndex === -1 || visitor.zoneLogs[lastLogIndex].exitTime) {
        // Create a synthetic log if there isn't one open, based on previous entryTime
        visitor.zoneLogs.push({
          zoneName: visitor.currentZone,
          entryTime: new Date(), // fallback
          exitTime: new Date(),
          durationMinutes: 0
        });
      }
    }

    // Update main fields
    visitor.status = status || visitor.status;
    if (entryTime) visitor.entryTime = entryTime;
    if (exitTime) visitor.exitTime = exitTime;
    if (checkedIn !== undefined) visitor.checkedIn = checkedIn;
    if (remarks !== undefined) visitor.remarks = remarks;
    if (purpose !== undefined) visitor.purpose = purpose;

    if (status === 'Inside' && currentZone) {
      visitor.currentZone = currentZone;
      visitor.checkedIn = true;
      // Start a new log
      visitor.zoneLogs.push({
        zoneName: currentZone,
        entryTime: new Date()
      });
    } else if (status === 'Exited') {
      visitor.currentZone = null;
    }

    await visitor.save();

    // Check if visitor has checked out
    if (status === 'Exited') {
      const notification = await Notification.create({
        companyId: req.companyId,
        branchId: visitor.branch,
        type: 'info',
        module: 'Visitors',
        title: '🚪 Visitor Checked Out',
        message: `${visitor.visitorName} checked out successfully.`,
        createdBy: req.user ? req.user.name : 'System'
      });

      const io = req.app.get('io');
      if (io) {
        io.emit('new_notification', notification);
      }
    }

    res.json(visitor);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});
// Get Visitor Profile by Mobile Number or Name
router.get('/profile/:query', async (req, res) => {
  try {
    const query = req.params.query;
    let profile = await VisitorProfile.findOne({
      companyId: req.companyId,
      $or: [
        { mobileNumber: query },
        { visitorName: { $regex: new RegExp(query, 'i') } }
      ]
    });

    if (!profile) {
      const pastVisit = await Visitor.findOne({
        companyId: req.companyId,
        $or: [
          { mobileNumber: query },
          { visitorName: { $regex: new RegExp(query, 'i') } }
        ]
      }).sort({ createdAt: -1 });

      if (pastVisit) {
        profile = {
          profileId: pastVisit.profileId,
          mobileNumber: pastVisit.mobileNumber,
          visitorName: pastVisit.visitorName,
          email: pastVisit.email,
          companyName: pastVisit.companyName,
          photoUrl: pastVisit.photoUrl || ''
        };
      }
    }

    if (!profile) return res.json({ exists: false });

    // Ensure profileId is always returned (even if it's from the Profile document)
    res.json({
      exists: true,
      profile: {
        profileId: profile.profileId,
        mobileNumber: profile.mobileNumber,
        visitorName: profile.visitorName,
        email: profile.email,
        companyName: profile.companyName,
        photoUrl: profile.photoUrl || ''
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
