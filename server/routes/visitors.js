const express = require('express');
const router = express.Router();
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

router.use((req, res, next) => {
  if (req.path.startsWith('/pass/') || req.path === '/public-prebook' || req.path === '/upload') {
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
      createdBy: 'Public Pre-Booking Landing Page'
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

    const visitors = await Visitor.find(query).sort({ createdAt: -1 });
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

    // 4. Save the Visit Record
    const initialStatus = req.body.isDraft ? 'Draft' : (req.body.status || 'Pending');
    const visitor = new Visitor({
      ...req.body,
      companyId: req.companyId,
      visitorProfileId: profile._id,
      profileId,
      visitId,
      bookingId,
      qrCode,
      qrPayload,
      status: initialStatus
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

const buildVisitorQuery = (id, companyId) => {
  const isValidObjectId = require('mongoose').isValidObjectId(id);
  const orConditions = [{ visitId: id }, { bookingId: id }];
  if (isValidObjectId) {
    orConditions.push({ _id: id });
  }
  return { companyId, $or: orConditions };
};

// Host Approve Visitor Endpoint
router.patch('/:id/approve', async (req, res) => {
  try {
    const visitor = await Visitor.findOne(buildVisitorQuery(req.params.id, req.companyId));
    if (!visitor) return res.status(404).json({ message: 'Visitor request not found' });

    visitor.status = 'Approved';
    visitor.approvedBy = req.user ? req.user.name : (req.body.approvedBy || visitor.hostName || 'Host');
    visitor.approvalTime = new Date();
    
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

    // Create Notification for Reception/Security & Visitor
    const notification = await Notification.create({
      companyId: req.companyId,
      branchId: updatedVisitor.branch,
      type: 'success',
      module: 'Visitors',
      title: '✅ Approved Visitor',
      message: `Visitor: ${updatedVisitor.visitorName} | Booking ID: ${updatedVisitor.bookingId} | Expected Arrival: ${updatedVisitor.expectedArrivalTime || '10:30 AM'}`,
      createdBy: req.user ? req.user.name : 'Host'
    });

    const io = req.app.get('io');
    if (io) {
      io.emit('new_notification', notification);
    }

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
router.patch('/:id/reject', async (req, res) => {
  try {
    const visitor = await Visitor.findOne(buildVisitorQuery(req.params.id, req.companyId));
    if (!visitor) return res.status(404).json({ message: 'Visitor request not found' });

    visitor.status = 'Rejected';
    visitor.rejectionReason = req.body.rejectionReason || 'Meeting Cancelled';
    visitor.approvedBy = req.user ? req.user.name : (req.body.approvedBy || visitor.hostName || 'Host');

    const updatedVisitor = await visitor.save();

    const notification = await Notification.create({
      companyId: req.companyId,
      branchId: updatedVisitor.branch,
      type: 'error',
      module: 'Visitors',
      title: '❌ Visitor Request Rejected',
      message: `Visitor: ${updatedVisitor.visitorName} has been rejected by ${updatedVisitor.approvedBy}. Reason: ${updatedVisitor.rejectionReason}`,
      createdBy: req.user ? req.user.name : 'Host'
    });

    const io = req.app.get('io');
    if (io) {
      io.emit('new_notification', notification);
    }

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

    if (req.body.status === 'Inside' && oldVisitor && oldVisitor.status !== 'Inside') {
      const notification = await Notification.create({
        companyId: req.companyId,
        branchId: updatedVisitor.branch,
        type: 'success',
        module: 'Visitors',
        title: '✅ Visitor Checked In',
        message: `${updatedVisitor.visitorName} checked in at ${updatedVisitor.branch} Branch.`,
        createdBy: req.user ? req.user.name : 'System'
      });
      const io = req.app.get('io');
      if (io) {
        io.emit('new_notification', notification);
      }
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
