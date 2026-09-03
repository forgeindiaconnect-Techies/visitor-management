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
const {
  reserveVisitorPass,
  releaseVisitorPass,
  getVisitorPassUsage
} = require('../services/subscriptionUsageService');
const {
  validateIdProof
} = require('../services/idProofValidationService');
const {
  createIdProofToken
} = require('../services/idProofTokenService');

router.use((req, res, next) => {
  if (req.path.startsWith('/pass/') || req.path.startsWith('/status/') || req.path.startsWith('/public-status/') || req.path === '/public-prebook' || req.path === '/upload' || req.path === '/upload-id-proof' || req.path === '/clean-notifications-temp' || req.path.startsWith('/profile/')) {
    return next();
  }
  authMiddleware(req, res, next);
});

router.get('/clean-notifications-temp', async (req, res) => {
  try {
    const notifications = await Notification.find({});
    
    // Group duplicates
    const groups = {};
    for (const notif of notifications) {
      if (notif.recipient) {
        const pKey = notif.preBookingId ? String(notif.preBookingId) : '';
        const vKey = notif.visitorId ? String(notif.visitorId) : '';
        const key = `${pKey}_${vKey}_${notif.type || ''}_${notif.title || ''}_${(notif.message || '').slice(0, 50)}`;
        
        if (!groups[key]) {
          groups[key] = [];
        }
        groups[key].push(notif);
      }
    }

    let mergedCount = 0;
    let deletedCount = 0;
    let singleConvertedCount = 0;

    for (const key of Object.keys(groups)) {
      const list = groups[key];
      
      // Sort by createdAt ascending (oldest first)
      list.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

      // Separate into subgroups based on time differences (within 5 minutes)
      const subgroups = [];
      for (const item of list) {
        let placed = false;
        for (const sub of subgroups) {
          const firstItem = sub[0];
          const timeDiff = Math.abs(new Date(item.createdAt) - new Date(firstItem.createdAt));
          if (timeDiff <= 5 * 60 * 1000) { // 5 minutes
            sub.push(item);
            placed = true;
            break;
          }
        }
        if (!placed) {
          subgroups.push([item]);
        }
      }

      for (const sub of subgroups) {
        if (sub.length > 1) {
          const mainNotif = sub[0];
          // Get all recipient IDs
          const recipientIds = sub.map(item => String(item.recipient));
          const uniqueRecipientIds = [...new Set(recipientIds)];

          // Update mainNotification
          mainNotif.recipients = uniqueRecipientIds.map(id => ({
            userId: id,
            user: id
          }));
          
          // Unset recipient
          mainNotif.recipient = undefined;
          await mainNotif.save();
          mergedCount++;

          // Delete duplicates
          for (let i = 1; i < sub.length; i++) {
            await Notification.deleteOne({ _id: sub[i]._id });
            deletedCount++;
          }
        } else {
          // Single notification with recipient field, convert to recipients array
          const notif = sub[0];
          notif.recipients = [{
            userId: String(notif.recipient),
            user: notif.recipient
          }];
          notif.recipient = undefined;
          await notif.save();
          singleConvertedCount++;
        }
      }
    }

    res.json({
      success: true,
      message: "Cleanup completed successfully",
      mergedGroupsCount: mergedCount,
      deletedCount: deletedCount,
      singleConvertedCount: singleConvertedCount
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
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

const idProofUpload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1
  },

  fileFilter: (req, file, callback) => {
    const allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/webp'
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      return callback(
        new Error(
          'Only PNG, JPG, JPEG, and WebP images are allowed.'
        )
      );
    }

    callback(null, true);
  }
});

const uploadBufferToCloudinary = ({
  buffer,
  companyId,
  idType
}) => {
  return new Promise((resolve, reject) => {
    const safeCompanyId = String(companyId)
      .replace(/[^a-zA-Z0-9_-]/g, '_');

    const safeIdType = String(idType)
      .replace(/[^a-zA-Z0-9_-]/g, '_');

    const uploadStream =
      cloudinary.uploader.upload_stream(
        {
          folder:
            `fic-vms/${safeCompanyId}/id-proofs`,

          public_id:
            `${safeIdType}_${uuidv4()}`,

          resource_type: 'image',

          transformation: [
            {
              width: 1600,
              height: 1600,
              crop: 'limit',
              quality: 'auto:good'
            }
          ]
        },

        (error, result) => {
          if (error) {
            reject(error);
            return;
          }

          resolve(result);
        }
      );

    uploadStream.end(buffer);
  });
};


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

    // Strict Indian Mobile Number Validation (10 digits starting with 6, 7, 8, or 9)
    const mobileRegex = /^[6-9]\d{9}$/;
    const cleanMobile = String(mobileNumber || "").trim().replace(/\D/g, "");
    if (!mobileRegex.test(cleanMobile)) {
      return res.status(400).json({
        success: false,
        code: "INVALID_MOBILE",
        message: "Please enter a valid 10-digit mobile number starting with 6, 7, 8, or 9."
      });
    }

    const companyId = req.headers['x-company-id'] || 'FIC001';
    const targetBranch = branch || 'Head Office(KRISHNAGIRI)';
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

    // Create Notification for Host / Admin (Single document with unique eventId)
    try {
      const superAdmins = await User.find({
        companyId: companyId,
        role: { $in: ['Super Admin', 'SaaS Super Admin', 'Admin', 'Branch Admin', 'MD', 'Senior HR', 'HR', 'Security', 'Receptionist'] }
      });

      let matchedHr = null;
      if (hostName && hostName !== 'New Visitors') {
        matchedHr = await User.findOne({
          companyId: companyId,
          role: 'HR',
          name: new RegExp(`^${hostName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
        });
      }

      const recipientIds = superAdmins.map(admin => admin._id.toString());
      if (matchedHr && !recipientIds.includes(matchedHr._id.toString())) {
        recipientIds.push(matchedHr._id.toString());
      }

      const formattedRecipients = recipientIds.map(id => ({
        userId: String(id),
        user: id
      }));

      const eventId = `PREBOOK_REGISTERED_${savedVisitor._id}`;

      const notificationDoc = await Notification.findOneAndUpdate(
        { eventId },
        {
          $setOnInsert: {
            eventId,
            companyId: companyId || 'FIC001',
            branchId: targetBranch,
            recipients: formattedRecipients,
            type: 'PREBOOKING_REGISTERED',
            module: 'PreBooking',
            title: 'New Pre-Booking',
            message: `${savedVisitor.visitorName || 'Visitor'} is waiting for approval.`,
            isRead: false
          }
        },
        {
          upsert: true,
          returnDocument: 'after'
        }
      );

      const io = req.app.get('io');
      if (io && notificationDoc) {
        io.to(`company:${notificationDoc.companyId}`).emit('new_notification', notificationDoc);
      }
    } catch (notifErr) {
      console.warn('Could not create notification:', notifErr.message);
    }

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

    res.status(201).json({
      success: true,
      message: 'Pre-booking pass generated successfully!',
      visitor: savedVisitor
    });
  } catch (err) {
    console.error('Public Pre-booking Error:', err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: err.message
      });
    }
    res.status(500).json({ message: err.message || 'Failed to complete pre-booking' });
  }
});

router.post(
  '/upload-id-proof',
  idProofUpload.single('photo'),
  async (req, res) => {
    try {
      const {
        idType,
        companyId
      } = req.body;

      if (!idType) {
        return res.status(400).json({
          success: false,
          message:
            'Please select an ID proof type.'
        });
      }

      if (!companyId) {
        return res.status(400).json({
          success: false,
          message:
            'Company ID is required.'
        });
      }

      const normalizedCompanyId =
        String(companyId)
          .trim()
          .toUpperCase();

      const company = await Company.findOne({
        code: normalizedCompanyId
      });

      if (!company) {
        return res.status(404).json({
          success: false,
          message:
            'The company pre-booking link is invalid.'
        });
      }

      if (
        company.status !== 'Active' ||
        new Date(
          company.subscriptionExpiresAt
        ).getTime() <= Date.now()
      ) {
        return res.status(403).json({
          success: false,
          message:
            'This company subscription is not active.'
        });
      }

      if (
        company.features?.preBookingEnabled ===
        false
      ) {
        return res.status(403).json({
          success: false,
          message:
            'Pre-booking is disabled for this company.'
        });
      }

      if (!req.file?.buffer) {
        return res.status(400).json({
          success: false,
          message:
            'Please upload an ID proof image.'
        });
      }

      const validation =
        await validateIdProof({
          idType,
          imageBuffer: req.file.buffer
        });

      if (!validation.valid) {
        return res.status(422).json({
          success: false,
          code:
            'ID_DOCUMENT_TYPE_MISMATCH',
          message: validation.message
        });
      }

      // The image reaches Cloudinary only after
      // backend document validation succeeds.
      const cloudinaryResult =
        await uploadBufferToCloudinary({
          buffer: req.file.buffer,
          companyId: normalizedCompanyId,
          idType
        });

      const verificationStatus =
        validation.requiresManualReview
          ? 'MANUAL_REVIEW'
          : 'VERIFIED';

      const verificationToken =
        createIdProofToken({
          companyId: normalizedCompanyId,
          idType,
          idProofUrl:
            cloudinaryResult.secure_url,
          verificationStatus
        });

      return res.status(200).json({
        success: true,

        message:
          validation.requiresManualReview
            ? 'ID proof uploaded and marked for manual verification.'
            : `${idType} verified and uploaded successfully.`,

        url: cloudinaryResult.secure_url,

        verificationStatus,

        verificationToken
      });
    } catch (error) {
      console.error(
        'Validated ID upload failed:',
        error.message
      );

      if (
        error instanceof multer.MulterError
      ) {
        return res.status(400).json({
          success: false,
          message:
            error.code === 'LIMIT_FILE_SIZE'
              ? 'The ID proof must be smaller than 5 MB.'
              : error.message
        });
      }

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          'Failed to validate the ID proof.'
      });
    }
  }
);

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
      const mongoose = require('mongoose');
      const User = require('../models/User');
      let hrUser = null;
      if (req.userId && mongoose.isValidObjectId(req.userId)) {
        hrUser = await User.findById(req.userId);
      }
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
    const userCompanyId = req.companyId;

    let query = {};
    if (req.userRole !== 'SaaS Super Admin' && userCompanyId !== 'SYSTEM') {
      if (!userCompanyId) {
        return res.status(400).json({ message: 'Company ID is required' });
      }
      query.companyId = new RegExp(`^${userCompanyId}$`, 'i');
    }

    if (req.query.status) {
      query.status = req.query.status;
    }

    // Branch query filter
    if (req.query.branch && req.query.branch !== 'All Branches') {
      const branchUpper = req.query.branch.toUpperCase();
      const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      let searchRegexStr = escapeRegExp(req.query.branch);

      if (branchUpper.includes('THIRUPATTUR')) {
        searchRegexStr = `${searchRegexStr}|Tirupattur`;
      } else if (branchUpper.includes('KRISHNAGIRI')) {
        searchRegexStr = `${searchRegexStr}|Salem|Head Office`;
      } else if (branchUpper === 'BANGALORE') {
        searchRegexStr = `${searchRegexStr}|Bangalore`;
      }
      query.branch = { $regex: new RegExp(searchRegexStr, 'i') };
    }

    // Isolate HR/Employee users to ONLY see visitors explicitly tagged to them
    const normalizedRole = (req.userRole || '').toUpperCase().trim();
    if (normalizedRole === 'HR' || normalizedRole === 'EMPLOYEE') {
      const mongoose = require('mongoose');
      let hrUser = req.user;
      if (!hrUser && req.userId && mongoose.isValidObjectId(req.userId)) {
        const User = require('../models/User');
        hrUser = await User.findById(req.userId);
      }
      const hrName = (hrUser?.name || req.headers['x-user-name'] || req.userId || '').trim();
      if (hrName) {
        query.hostName = new RegExp(`^${hrName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
      } else {
        query.hostName = 'DO_NOT_MATCH_ANYTHING';
      }
    }

    let visitors;
    try {
      visitors = await Visitor.find(query)
        .populate('approvedBy', 'name email role')
        .populate('statusHistory.changedBy', 'name email role')
        .sort({ createdAt: -1 });
    } catch (popErr) {
      console.warn('Populate failed on visitors query, returning raw results:', popErr.message);
      visitors = await Visitor.find(query).sort({ createdAt: -1 });
    }
    res.json(visitors);
  } catch (err) {
    console.error('Error fetching visitors:', err);
    res.status(500).json({ message: err.message });
  }
});

// Get visitor-pass usage for the current subscription cycle
router.get('/subscription-usage', async (req, res) => {
  try {
    const usage = await getVisitorPassUsage(
      req.companyId
    );

    return res.status(200).json({
      success: true,
      data: {
        companyId: usage.companyId,
        plan: usage.plan,
        status: usage.status,
        expired: usage.expired,

        visitorPassesUsed:
          usage.visitorPassesUsed,

        visitorPassLimit:
          usage.visitorPassLimit,

        unlimited:
          usage.unlimited,

        cycleStart:
          usage.cycleStart,

        renewalDate:
          usage.renewalDate,

        usageText: usage.unlimited
          ? `${usage.visitorPassesUsed} / Unlimited`
          : `${usage.visitorPassesUsed} / ${usage.visitorPassLimit}`
      }
    });
  } catch (error) {
    console.error(
      'Get visitor-pass usage error:',
      error
    );

    return res
      .status(error.statusCode || 500)
      .json({
        success: false,
        message:
          error.message ||
          'Unable to load visitor-pass usage.'
      });
  }
});

// Add a new visitor
router.post('/', async (req, res) => {
  try {
    const {
      visitorName,
      mobileNumber,
      email,
      companyName,
      photoUrl,
      hostName
    } = req.body;

    // Check Blacklist
    const Blacklist = require('../models/Blacklist');
    const isBlacklisted = await Blacklist.findOne({ companyId: req.companyId, mobileNumber });
    if (isBlacklisted) {
      // Force status to Rejected for security audit logs
      req.body.status = 'Rejected';
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
    const rawFrontendUrl = process.env.FRONTEND_URL || 'https://zone-monitor.vercel.app';
    const frontendUrl = String(rawFrontendUrl).replace(/[\r\n\t]/g, '').trim().replace(/\/+$/, '');
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
    if (
      visitType === 'DIRECT_VISIT' &&
      !req.body.isDraft &&
      !isBlacklisted
    ) {
      initialStatus = 'Approved';
    }

    if (isBlacklisted) {
      initialStatus = 'Rejected';
    }

    // Count only a new, approved direct-visit pass.
    // Draft and pending visitor records do not consume pass usage.
    const shouldCountPass =
      visitType === 'DIRECT_VISIT' &&
      initialStatus === 'Approved' &&
      !req.body.isDraft;

    let passReservation = null;

    if (shouldCountPass) {
      try {
        passReservation = await reserveVisitorPass(
          req.companyId
        );
      } catch (usageError) {
        return res
          .status(usageError.statusCode || 500)
          .json({
            success: false,
            code:
              usageError.code ||
              'VISITOR_PASS_USAGE_ERROR',
            message:
              usageError.message ||
              'Unable to verify visitor-pass usage.',
            usage: {
              used: usageError.used,
              limit: usageError.limit
            }
          });
      }
    }

    const visitor = new Visitor({
      ...req.body,
      companyId: req.companyId,
      visitorProfileId: profile._id,
      profileId,
      visitId,
      bookingId,
      qrCode:
        shouldCountPass && passReservation
          ? qrCode
          : '',

      qrPayload:
        shouldCountPass && passReservation
          ? qrPayload
          : null,

      passUsageCounted: Boolean(
        shouldCountPass && passReservation
      ),

      passGeneratedAt:
        shouldCountPass && passReservation
          ? new Date()
          : null,

      usageCycleStart:
        passReservation?.cycleStart || null,

      usageCycleEnd:
        passReservation?.cycleEnd || null,

      visitType,
      status: initialStatus,
      approvalStatus: initialStatus === 'Approved' ? 'APPROVED' : 'PENDING'
    });

    let newVisitor;

    try {
      newVisitor = await visitor.save();
    } catch (passSaveError) {
      if (passReservation?.usage?._id) {
        try {
          await releaseVisitorPass(
            passReservation.usage._id
          );
        } catch (releaseError) {
          console.error(
            'Failed to release direct visitor-pass reservation:',
            releaseError
          );
        }
      }

      throw passSaveError;
    }

    try {
      const { createNotification } = require('../services/notificationService');
      const vId = newVisitor.visitorId || newVisitor.visitId || newVisitor.profileId || newVisitor._id.toString();
      await createNotification({
        eventId: `DIRECT_VISIT_CREATED_${vId}`,
        type: 'DIRECT_VISIT_CREATED',
        title: 'A New Visitor Request Received',
        message: `${newVisitor.visitorName || newVisitor.fullName} has registered as a direct visitor.`,
        visitorId: vId,
        visitorType: 'DIRECT_VISIT',
        recipients: [
          { role: 'Super Admin' },
          { role: 'SaaS Super Admin' },
          { role: 'Company Admin' },
          { role: 'Admin' },
          { role: 'MD' },
          { role: 'HR' },
          { role: 'Security' }
        ],
        companyId: newVisitor.companyId || req.companyId || 'FIC001',
        io: req.app.get('io')
      });
    } catch (e) {
      console.error('Error creating direct visit notification:', e);
    }

    const notification = await Notification.create({
      companyId: req.companyId,
      branchId: newVisitor.branch,
      type: 'success',
      module: 'Visitors',
      title: 'A New Visitor Request Received',
      message: `${newVisitor.visitorName} has been registered for ${newVisitor.hostName || 'a visit'}.`,
      createdBy: req.user ? req.user.name : 'Security'
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`company:${notification.companyId}`).emit('new_notification', notification);
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

    const cleanId = searchTerm.trim();
    const digits = cleanId.replace(/\D/g, '');
    const alphaNum = cleanId.replace(/[^a-zA-Z0-9]/g, '');
    const isValidObjectId = require('mongoose').isValidObjectId(cleanId);
    const escapedRaw = cleanId.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');

    const searchConditions = [
      { visitorId: new RegExp(escapedRaw, 'i') },
      { visitId: new RegExp(escapedRaw, 'i') },
      { profileId: new RegExp(escapedRaw, 'i') },
      { bookingId: new RegExp(escapedRaw, 'i') },
      { mobileNumber: cleanId },
      { aadhaarNumber: cleanId },
      { qrToken: cleanId },
      { trackingToken: cleanId }
    ];

    if (alphaNum && alphaNum !== cleanId) {
      searchConditions.push({ visitorId: new RegExp(alphaNum, 'i') });
      searchConditions.push({ visitId: new RegExp(alphaNum, 'i') });
      searchConditions.push({ profileId: new RegExp(alphaNum, 'i') });
      searchConditions.push({ bookingId: new RegExp(alphaNum, 'i') });
    }

    if (digits && digits.length >= 2) {
      searchConditions.push({ visitorId: new RegExp(`${digits}$`, 'i') });
      searchConditions.push({ visitId: new RegExp(`${digits}$`, 'i') });
      searchConditions.push({ profileId: new RegExp(`${digits}$`, 'i') });
      searchConditions.push({ bookingId: new RegExp(`${digits}$`, 'i') });
    }

    if (isValidObjectId) {
      searchConditions.push({ _id: cleanId });
    }

    let visitor = await Visitor.findOne({ companyId: req.companyId, $or: searchConditions }).sort({ createdAt: -1 });

    if (!visitor) {
      const PreBooking = require('../models/PreBooking');
      const pb = await PreBooking.findOne({ companyId: req.companyId, $or: searchConditions });

      if (pb) {
        visitor = {
          id: pb._id,
          _id: pb._id,
          visitorId: pb.visitorId,
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
          status: pb.status || 'PENDING',
          photoUrl: pb.facePhoto || ''
        };
      }
    }

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
          { trackingToken: visitId },
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
          qrToken: pb.qrToken || pb.trackingToken || '',
          trackingToken: pb.trackingToken || pb.qrToken || '',
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
      companyId: req.companyId,
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
        companyId: req.companyId,
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
      companyId: req.companyId,
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
        companyId: req.companyId,
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

    await visitorNotificationService.notifyVisitorEvent({
      visitor: updatedVisitor,
      event: visitorNotificationService.VISITOR_EVENTS.CHECKED_IN,
      actor: req.user,
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
      companyId: req.companyId,
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

    await visitorNotificationService.notifyVisitorEvent({
      visitor: updatedVisitor,
      event: visitorNotificationService.VISITOR_EVENTS.CHECKED_OUT,
      actor: req.user,
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

    const isValidObjectId = require('mongoose').isValidObjectId(token);

    // Search Visitor collection first
    let visitor = await Visitor.findOne({
      $or: [
        { trackingToken: token },
        ...(isValidObjectId ? [{ _id: token }] : [])
      ]
    })
      .populate('approvedBy', 'name role')
      .populate('statusHistory.changedBy', 'name role');

    let source = 'visitor';

    // Fallback to PreBooking collection
    if (!visitor) {
      const pb = await PreBooking.findOne({
        $or: [
          { trackingToken: token },
          ...(isValidObjectId ? [{ _id: token }] : [])
        ]
      })
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

    let passReservation = null;

    // Old or retried records may already have consumed usage.
    // Reserve only when this visit has never been counted.
    if (!visitor.passUsageCounted) {
      try {
        passReservation = await reserveVisitorPass(
          visitor.companyId || req.companyId
        );
      } catch (usageError) {
        return res
          .status(usageError.statusCode || 500)
          .json({
            success: false,
            code:
              usageError.code ||
              'VISITOR_PASS_USAGE_ERROR',
            message:
              usageError.message ||
              'Unable to verify visitor-pass usage.',
            usage: {
              used: usageError.used,
              limit: usageError.limit
            }
          });
      }
    }

    let updatedVisitor;

    try {
      const rawFrontendUrl =
        process.env.FRONTEND_URL ||
        'https://zone-monitor.vercel.app';

      const frontendUrl = String(rawFrontendUrl)
        .replace(/[\r\n\t]/g, '')
        .trim()
        .replace(/\/+$/, '');

      visitor.qrCode =
        `${frontendUrl}/pass/${visitor.visitId || visitor._id}`;

      visitor.qrPayload = {
        bookingId: visitor.bookingId,
        visitorId:
          visitor.profileId ||
          visitor.visitId,
        mobile: visitor.mobileNumber
      };

      visitor.passUsageCounted = true;

      visitor.passGeneratedAt =
        visitor.passGeneratedAt ||
        new Date();

      visitor.usageCycleStart =
        visitor.usageCycleStart ||
        passReservation?.cycleStart ||
        null;

      visitor.usageCycleEnd =
        visitor.usageCycleEnd ||
        passReservation?.cycleEnd ||
        null;

      updatedVisitor = await visitor.save();
    } catch (passSaveError) {
      if (passReservation?.usage?._id) {
        try {
          await releaseVisitorPass(
            passReservation.usage._id
          );
        } catch (releaseError) {
          console.error(
            'Failed to release visitor approval pass reservation:',
            releaseError
          );
        }
      }

      throw passSaveError;
    }

    // Trigger Notifications & Emails
    try {
      await visitorNotificationService.notifyVisitorEvent({
        visitor: updatedVisitor,
        event:
          visitorNotificationService
            .VISITOR_EVENTS.APPROVED,
        actor: req.user,
        io: req.app.get('io')
      });

      await visitorNotificationService.notifyVisitorEvent({
        visitor: updatedVisitor,
        event:
          visitorNotificationService
            .VISITOR_EVENTS.QR_AVAILABLE,
        actor: req.user,
        io: req.app.get('io')
      });
    } catch (notificationError) {
      console.error(
        'Visitor approved, but notification failed:',
        notificationError
      );
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
    await visitorNotificationService.notifyVisitorEvent({
      visitor: updatedVisitor,
      event: visitorNotificationService.VISITOR_EVENTS.REJECTED,
      actor: req.user,
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
const handleRescheduleVisitor = async (req, res) => {
  try {
    const visitor = await Visitor.findOne(buildVisitorQuery(req.params.id, req.companyId));
    if (!visitor) return res.status(404).json({ message: 'Visitor request not found' });
    
    const { visitDate, appointmentEndTime, reason } = req.body;
    const expectedArrivalTime = req.body.expectedArrivalTime || req.body.expectedTime;
    let changes = [];
    let primaryStatus = '';
    
    // Capture previous values BEFORE updating
    const previousDate = visitor.visitDate;
    const previousStartTime = visitor.expectedArrivalTime || visitor.expectedTime;
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
      const reqUserRole = req.userRole || (req.user && req.user.role) || 'User';
      const reqUserName = (req.user && req.user.name) || req.userName || req.body?.rescheduledByName || reqUserRole || 'Authorized Personnel';
      
      const historyEntry = {
        status: primaryStatus,
        changedBy: reqUserId,
        changedByRole: reqUserRole,
        changedByName: reqUserName,
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
      await visitorNotificationService.notifyVisitorEvent({
        visitor: updatedVisitor,
        event: visitorNotificationService.VISITOR_EVENTS.RESCHEDULED,
        actor: {
          _id: reqUserId,
          name: reqUserName,
          role: reqUserRole
        },
        reason: reason || changes.join(', '),
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
};

router.patch('/:id/reschedule', handleRescheduleVisitor);
router.put('/:id/reschedule', handleRescheduleVisitor);

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
          io.to(`company:${notification.companyId}`).emit('new_notification', notification);
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
      await visitorNotificationService.notifyVisitorEvent({
        visitor: updatedVisitor,
        event: visitorNotificationService.VISITOR_EVENTS.CHECKED_IN,
        io: req.app.get('io')
      });
    } else if ((req.body.status === 'Checked Out' || req.body.status === 'Exited') && oldVisitor && (oldVisitor.status !== 'Checked Out' && oldVisitor.status !== 'Exited')) {
      await visitorNotificationService.notifyVisitorEvent({
        visitor: updatedVisitor,
        event: visitorNotificationService.VISITOR_EVENTS.CHECKED_OUT,
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
        io.to(`company:${notification.companyId}`).emit('new_notification', notification);
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
    const rawQuery = (req.params.query || '').trim();
    const cleanMobile = rawQuery.replace(/\D/g, '').slice(-10);

    const searchCriteria = [
      { mobileNumber: rawQuery },
      ...(cleanMobile ? [{ mobileNumber: cleanMobile }, { mobileNumber: new RegExp(cleanMobile + '$') }] : []),
      { visitorName: { $regex: new RegExp(rawQuery, 'i') } },
      { fullName: { $regex: new RegExp(rawQuery, 'i') } }
    ];

    let profile = await VisitorProfile.findOne({
      $or: searchCriteria
    });

    if (!profile) {
      const pastVisit = await Visitor.findOne({
        $or: searchCriteria
      }).sort({ createdAt: -1 });

      if (pastVisit) {
        profile = {
          profileId: pastVisit.profileId || pastVisit.visitorId || pastVisit.id,
          mobileNumber: pastVisit.mobileNumber,
          visitorName: pastVisit.visitorName || pastVisit.fullName,
          email: pastVisit.email,
          companyName: pastVisit.companyName || pastVisit.visitingCompany,
          photoUrl: pastVisit.photoUrl || pastVisit.facePhoto || ''
        };
      }
    }

    if (!profile) {
      const PreBooking = require('../models/PreBooking');
      const pastPreBooking = await PreBooking.findOne({
        $or: [
          { mobileNumber: rawQuery },
          ...(cleanMobile ? [{ mobileNumber: cleanMobile }, { mobileNumber: new RegExp(cleanMobile + '$') }] : []),
          { fullName: { $regex: new RegExp(rawQuery, 'i') } }
        ]
      }).sort({ createdAt: -1 });

      if (pastPreBooking) {
        profile = {
          profileId: pastPreBooking.visitorId,
          mobileNumber: pastPreBooking.mobileNumber,
          visitorName: pastPreBooking.fullName,
          email: pastPreBooking.email,
          companyName: pastPreBooking.visitingCompany,
          photoUrl: pastPreBooking.facePhoto || ''
        };
      }
    }

    // Fetch all visit history across Visitor and PreBooking models
    const directVisits = await Visitor.find({ $or: searchCriteria }).sort({ createdAt: -1 }).lean();
    const PreBookingModel = require('../models/PreBooking');
    const preBookVisits = await PreBookingModel.find({ $or: searchCriteria }).sort({ createdAt: -1 }).lean();

    const allVisitsHistory = [
      ...directVisits.map(v => ({
        id: v.visitorId || v.id || v._id,
        visitDate: v.visitDate || v.date || v.createdAt,
        purpose: v.purpose || v.visitPurpose || 'Direct Visit',
        hostName: v.hostName || v.hostEmployee || 'Staff',
        branch: v.branch || v.branchLocation || 'Head Office',
        status: v.status || 'Completed',
        entryTime: v.checkInTime || v.entryTime || '',
        exitTime: v.checkOutTime || v.exitTime || '',
        type: 'Direct Visit'
      })),
      ...preBookVisits.map(pb => ({
        id: pb.visitorId || pb.id || pb._id,
        visitDate: pb.visitDate || pb.date || pb.createdAt,
        purpose: pb.visitPurpose || pb.purpose || 'Pre-Booking',
        hostName: pb.hostEmployee || pb.hostName || 'Staff',
        branch: pb.branchLocation || pb.branch || 'Head Office',
        status: pb.status || 'Pending',
        entryTime: pb.checkInTime || '',
        exitTime: pb.checkOutTime || '',
        type: 'Pre-Booking'
      }))
    ].sort((a, b) => new Date(b.visitDate || 0) - new Date(a.visitDate || 0));

    // Ensure profileId is always returned (even if it's from the Profile document)
    res.json({
      exists: true,
      profile: {
        profileId: profile.profileId || profile.visitorId,
        mobileNumber: profile.mobileNumber,
        visitorName: profile.visitorName || profile.fullName,
        email: profile.email,
        companyName: profile.companyName || profile.visitingCompany,
        photoUrl: profile.photoUrl || profile.facePhoto || ''
      },
      history: allVisitsHistory,
      totalVisitsCount: allVisitsHistory.length
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE single visitor record (Direct Visit)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const isValidObjectId = require('mongoose').isValidObjectId(id);
    const query = { companyId: req.companyId };
    
    if (isValidObjectId) {
      query.$or = [{ _id: id }, { id: id }];
    } else {
      query.id = id;
    }
    
    let deleted = await Visitor.findOneAndDelete(query);
    
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Visitor record not found in your company' });
    }
    
    return res.json({ success: true, message: 'Visitor record deleted successfully' });
  } catch (err) {
    console.error("Delete visitor error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
