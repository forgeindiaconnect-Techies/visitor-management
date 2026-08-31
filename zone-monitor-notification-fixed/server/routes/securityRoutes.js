const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Visitor = require('../models/Visitor');
const PreBooking = require('../models/PreBooking');
const Notification = require('../models/Notification');
const { createNotification } = require('../services/notificationService');

const jwt = require('jsonwebtoken');

// Middleware to extract user info / auth if present
const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
    const companyId = req.headers['x-company-id'] || 'FIC001';
    req.companyId = companyId;

    if (!token) {
      // Fallback for security terminal API calls
      req.user = { role: 'Security', companyId };
      return next();
    }

    const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
    } catch (e) {
      req.user = { role: 'Security', companyId };
    }
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.'
    });
  }
};

// Role authorization middleware
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    const userRole = (req.user.role || '').toLowerCase();
    const hasPermission = allowedRoles.some(r => r.toLowerCase() === userRole);

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to perform this action.'
      });
    }

    next();
  };
};

const SECURITY_ROLES = ['Security', 'Super Admin', 'SaaS Super Admin', 'Company Admin', 'Admin', 'Receptionist', 'HR'];

// 1. GET /api/security/visitor/search
router.get('/visitor/search', authMiddleware, requireRole(...SECURITY_ROLES), async (req, res) => {
  try {
    const rawQuery = (req.query.query || req.query.visitorId || req.query.mobile || req.query.qrToken || '').trim();

    if (!rawQuery) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a Visitor ID, Mobile Number, or scan a QR code.'
      });
    }

    // Handle scanned JSON QR Code
    let searchTerm = rawQuery;
    if (rawQuery.startsWith('{')) {
      try {
        const parsed = JSON.parse(rawQuery);
        searchTerm = parsed.visitorId || parsed.visitId || parsed.bookingId || parsed.mobile || rawQuery;
      } catch (e) {}
    }

    const cleanId = searchTerm.trim();
    const digits = cleanId.replace(/\D/g, '');
    const alphaNum = cleanId.replace(/[^a-zA-Z0-9]/g, '');
    const isValidObjectId = mongoose.isValidObjectId(cleanId);
    const escapedRaw = cleanId.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');

    const searchConditions = [
      { visitorId: new RegExp(escapedRaw, 'i') },
      { visitId: new RegExp(escapedRaw, 'i') },
      { profileId: new RegExp(escapedRaw, 'i') },
      { bookingId: new RegExp(escapedRaw, 'i') },
      { mobileNumber: cleanId },
      { mobile: cleanId },
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

    const ACTIVE_STATUSES = ['PENDING', 'Pending', 'Pending Approval', 'APPROVED', 'Approved', 'Pre-Booked', 'CHECKED_IN', 'Checked In', 'INSIDE', 'Inside'];
    const isMobileQuery = req.query.mobile || /^\d{10}$/.test(cleanId);

    // 1. Search Active PreBooking first
    let pbDoc = await PreBooking.findOne({
      $or: searchConditions,
      status: { $in: ACTIVE_STATUSES }
    }).populate('assignedHr').sort({ createdAt: -1 });

    // 2. Search Active Direct Visit second
    let vDoc = null;
    if (!pbDoc) {
      vDoc = await Visitor.findOne({
        $or: searchConditions,
        status: { $in: ACTIVE_STATUSES }
      }).sort({ createdAt: -1 });
    }

    // 3. If searching by Visitor ID or QR Token (not pure mobile), allow fallback to recent document even if inactive
    if (!pbDoc && !vDoc && !isMobileQuery) {
      pbDoc = await PreBooking.findOne({ $or: searchConditions }).populate('assignedHr').sort({ createdAt: -1 });
      if (!pbDoc) {
        vDoc = await Visitor.findOne({ $or: searchConditions }).sort({ createdAt: -1 });
      }
    }

    if (pbDoc) {
      return res.status(200).json({
        success: true,
        visitorType: "PRE_BOOKING",
        visitor: {
          id: pbDoc._id,
          _id: pbDoc._id,
          visitorId: pbDoc.visitorId || pbDoc._id,
          visitId: pbDoc.visitorId || pbDoc._id,
          profileId: pbDoc.visitorId,
          name: pbDoc.fullName,
          fullName: pbDoc.fullName,
          visitorName: pbDoc.fullName,
          mobile: pbDoc.mobileNumber,
          mobileNumber: pbDoc.mobileNumber,
          email: pbDoc.email || '',
          host: pbDoc.hostEmployee,
          hostEmployee: pbDoc.hostEmployee,
          hostName: pbDoc.hostEmployee,
          visitingCompany: pbDoc.visitingCompany || 'Forge India Connect Private Limited',
          companyName: pbDoc.visitingCompany || 'Forge India Connect Private Limited',
          visitPurpose: pbDoc.visitPurpose,
          purpose: pbDoc.visitPurpose,
          visitDate: pbDoc.visitDate,
          expectedTime: pbDoc.expectedTime || '10:00 AM',
          expectedArrivalTime: pbDoc.expectedTime || '10:00 AM',
          branch: pbDoc.branchLocation || 'Head Office',
          branchLocation: pbDoc.branchLocation || 'Head Office',
          vehicleNumber: pbDoc.vehicleNumber || '-',
          photoUrl: pbDoc.facePhoto || '',
          facePhoto: pbDoc.facePhoto || '',
          status: pbDoc.status || 'PENDING',
          checkInTime: pbDoc.checkInTime || null,
          checkOutTime: pbDoc.checkOutTime || null
        }
      });
    }

    if (vDoc) {
      return res.status(200).json({
        success: true,
        visitorType: "DIRECT_VISIT",
        visitor: {
          id: vDoc._id,
          _id: vDoc._id,
          visitorId: vDoc.visitorId || vDoc.visitId || vDoc.profileId || vDoc._id,
          visitId: vDoc.visitId || vDoc.visitorId || vDoc.profileId,
          profileId: vDoc.profileId || vDoc.visitId || vDoc.visitorId,
          name: vDoc.visitorName || vDoc.fullName,
          fullName: vDoc.visitorName || vDoc.fullName,
          visitorName: vDoc.visitorName || vDoc.fullName,
          mobile: vDoc.mobileNumber,
          mobileNumber: vDoc.mobileNumber,
          email: vDoc.email || '',
          host: vDoc.hostName,
          hostEmployee: vDoc.hostName,
          hostName: vDoc.hostName,
          visitingCompany: vDoc.companyName || 'Forge India Connect Private Limited',
          companyName: vDoc.companyName || 'Forge India Connect Private Limited',
          visitPurpose: vDoc.purpose,
          purpose: vDoc.purpose,
          visitDate: vDoc.visitDate,
          expectedTime: vDoc.expectedArrivalTime || '10:00 AM',
          expectedArrivalTime: vDoc.expectedArrivalTime || '10:00 AM',
          branch: vDoc.branch || 'Head Office',
          branchLocation: vDoc.branch || 'Head Office',
          vehicleNumber: vDoc.vehicleNumber || '-',
          photoUrl: vDoc.photoUrl || '',
          facePhoto: vDoc.photoUrl || '',
          status: vDoc.status || 'PENDING',
          checkInTime: vDoc.checkInTime || null,
          checkOutTime: vDoc.checkOutTime || null
        }
      });
    }

    return res.status(404).json({
      success: false,
      code: "VISITOR_NOT_FOUND",
      message: `Visitor not found matching "${cleanId}".`
    });
  } catch (error) {
    console.error('Security Search Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to search visitor record.',
      error: error.message
    });
  }
});

// 2. POST /api/security/visitor/action
router.post('/visitor/action', authMiddleware, requireRole(...SECURITY_ROLES), async (req, res) => {
  try {
    const { visitorId, id, _id, visitorType, action, notes } = req.body;
    const targetId = _id || id || visitorId;

    if (!targetId || !action) {
      return res.status(400).json({
        success: false,
        message: 'Visitor ID and action are required.'
      });
    }

    const allowedActions = ['CHECK_IN', 'CHECK_OUT'];
    if (!allowedActions.includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid security action.'
      });
    }

    const io = req.app.get('io');
    const isValidObjectId = mongoose.isValidObjectId(targetId);
    const escapedTarget = String(targetId).replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
    const idConditions = [
      { visitorId: new RegExp(`^${escapedTarget}$`, 'i') },
      { visitId: new RegExp(`^${escapedTarget}$`, 'i') },
      { profileId: new RegExp(`^${escapedTarget}$`, 'i') },
      ...(isValidObjectId ? [{ _id: targetId }] : [])
    ];

    if (visitorType === 'PRE_BOOKING' || (!visitorType && action)) {
      let pbDoc = await PreBooking.findOne({ $or: idConditions });
      if (pbDoc) {
        if (action === 'CHECK_IN') {
          if (['CHECKED_OUT', 'EXITED', 'Checked Out'].includes(pbDoc.status)) {
            return res.status(400).json({
              success: false,
              code: 'INVALID_STATUS',
              message: `Visitor cannot be checked in from ${pbDoc.status} status.`
            });
          }
          pbDoc.status = 'CHECKED_IN';
          pbDoc.checkInTime = new Date();
          pbDoc.checkInBy = 'Security';
        } else if (action === 'CHECK_OUT') {
          if (!['CHECKED_IN', 'Checked In', 'INSIDE', 'Inside'].includes(pbDoc.status)) {
            return res.status(400).json({
              success: false,
              code: 'INVALID_STATUS',
              message: 'Visitor is not currently checked in.'
            });
          }
          pbDoc.status = 'CHECKED_OUT';
          pbDoc.checkOutTime = new Date();
          pbDoc.checkOutBy = 'Security';
          if (notes) pbDoc.checkOutNotes = notes;
        }

        await pbDoc.save();

        try {
          const vId = pbDoc.visitorId || pbDoc._id.toString();
          const isCheckIn = action === 'CHECK_IN';
          await createNotification({
            eventId: `${isCheckIn ? 'CHECKIN' : 'CHECKOUT'}_PRE_BOOKING_${vId}`,
            type: isCheckIn ? 'VISITOR_CHECKED_IN' : 'VISITOR_CHECKED_OUT',
            title: isCheckIn ? 'Visitor Checked In' : 'Visitor Checked Out',
            message: `${pbDoc.fullName} has ${isCheckIn ? 'checked in' : 'checked out'}.`,
            visitorId: vId,
            visitorType: 'PRE_BOOKING',
            recipients: [
              { role: 'Super Admin' },
              { role: 'MD' },
              { role: 'HR' },
              { role: 'Security' },
              { role: 'Admin' }
            ],
            companyId: pbDoc.companyId || req.companyId,
            io
          });
        } catch (e) {
          console.error('Notification creation error:', e);
        }

        if (io) {
          const companyRoom = `company:${String(pbDoc.companyId || req.companyId).toUpperCase()}`;
          io.to(companyRoom).emit('visitor-status-updated', {
            visitorId: pbDoc.visitorId || pbDoc._id.toString(),
            visitorType: 'PRE_BOOKING',
            status: pbDoc.status,
            visitor: pbDoc
          });
          io.to(companyRoom).emit('visitor:status-updated', {
            visitorId: pbDoc.visitorId || pbDoc._id.toString(),
            status: pbDoc.status
          });
        }

        return res.status(200).json({
          success: true,
          message: action === 'CHECK_IN' ? 'Visitor checked in successfully.' : 'Visitor checked out successfully.',
          visitorType: 'PRE_BOOKING',
          visitor: pbDoc
        });
      }
    }

    // Direct Visit update fallback
    let vDoc = await Visitor.findOne({ $or: idConditions });
    if (vDoc) {
      if (action === 'CHECK_IN') {
        if (['Checked Out', 'Exited', 'CHECKED_OUT'].includes(vDoc.status)) {
          return res.status(400).json({
            success: false,
            code: 'INVALID_STATUS',
            message: `Visitor cannot be checked in from ${vDoc.status} status.`
          });
        }
        vDoc.status = 'Checked In';
        vDoc.checkInTime = new Date();
      } else if (action === 'CHECK_OUT') {
        if (!['Checked In', 'CHECKED_IN', 'Inside', 'INSIDE'].includes(vDoc.status)) {
          return res.status(400).json({
            success: false,
            code: 'INVALID_STATUS',
            message: 'Visitor is not currently checked in.'
          });
        }
        vDoc.status = 'Checked Out';
        vDoc.checkOutTime = new Date();
        if (notes) vDoc.notes = notes;
      }

      await vDoc.save();

      try {
        const vId = vDoc.visitorId || vDoc.visitId || vDoc._id.toString();
        const isCheckIn = action === 'CHECK_IN';
        await createNotification({
          eventId: `${isCheckIn ? 'CHECKIN' : 'CHECKOUT'}_DIRECT_VISIT_${vId}`,
          type: isCheckIn ? 'VISITOR_CHECKED_IN' : 'VISITOR_CHECKED_OUT',
          title: isCheckIn ? 'Direct Visitor Checked In' : 'Direct Visitor Checked Out',
          message: `${vDoc.visitorName || vDoc.fullName} has ${isCheckIn ? 'checked in' : 'checked out'}.`,
          visitorId: vId,
          visitorType: 'DIRECT_VISIT',
          recipients: [
            { role: 'Super Admin' },
            { role: 'MD' },
            { role: 'HR' },
            { role: 'Security' },
            { role: 'Admin' }
          ],
          companyId: vDoc.companyId || req.companyId,
          io
        });
      } catch (e) {
        console.error('Notification creation error:', e);
      }

      if (io) {
        const companyRoom = `company:${String(vDoc.companyId || req.companyId).toUpperCase()}`;
        io.to(companyRoom).emit('visitor-status-updated', {
          visitorId: vDoc.visitId || vDoc._id.toString(),
          visitorType: 'DIRECT_VISIT',
          status: vDoc.status,
          visitor: vDoc
        });
        io.to(companyRoom).emit('visitor:status-updated', {
          visitorId: vDoc.visitId || vDoc._id.toString(),
          status: vDoc.status
        });
      }

      return res.status(200).json({
        success: true,
        message: action === 'CHECK_IN' ? 'Visitor checked in successfully.' : 'Visitor checked out successfully.',
        visitorType: 'DIRECT_VISIT',
        visitor: vDoc
      });
    }

    return res.status(404).json({
      success: false,
      code: 'VISITOR_NOT_FOUND',
      message: 'Visitor not found.'
    });

  } catch (error) {
    console.error('Security Action Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to perform security action.',
      error: error.message
    });
  }
});

// 3. GET /api/security/direct-visits
router.get('/direct-visits', authMiddleware, requireRole(...SECURITY_ROLES), async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) {
      filter.status = req.query.status;
    }
    const visitors = await Visitor.find(filter).sort({ createdAt: -1 });
    return res.status(200).json({
      success: true,
      visitors
    });
  } catch (error) {
    console.error('Error fetching direct visits for security:', error);
    return res.status(500).json({ success: false, message: 'Failed to load direct visits.' });
  }
});

// 4. GET /api/security/pre-bookings
router.get('/pre-bookings', authMiddleware, requireRole(...SECURITY_ROLES), async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) {
      filter.status = req.query.status;
    }
    const visitors = await PreBooking.find(filter).populate('assignedHr').sort({ createdAt: -1 });
    return res.status(200).json({
      success: true,
      visitors
    });
  } catch (error) {
    console.error('Error fetching pre-bookings for security:', error);
    return res.status(500).json({ success: false, message: 'Failed to load pre-bookings.' });
  }
});

module.exports = router;
