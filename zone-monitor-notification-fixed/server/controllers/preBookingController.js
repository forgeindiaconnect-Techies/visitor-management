const crypto = require("crypto");
const PreBooking = require("../models/PreBooking");
const QRCode = require('qrcode');

const visitorNotificationService = require('../services/visitorNotificationService');
const logAction = require('../utils/auditLogger');
const { sendApprovalEmail } = require('../utils/emailService');
const { formatDisplayName } = require('../utils/nameFormatter');

const createVisitorId = async () => {
  try {
    const lastDoc = await PreBooking.findOne().sort({ createdAt: -1 });
    let nextSeq = 1001;
    if (lastDoc && lastDoc.visitorId) {
      const match = lastDoc.visitorId.match(/\d+$/);
      if (match) {
        nextSeq = parseInt(match[0], 10) + 1;
      }
    }
    return `VIS-${nextSeq}`;
  } catch (err) {
    return `VIS-${Math.floor(1000 + Math.random() * 9000)}`;
  }
};

// Create Pre-Booking
const createPreBooking = async (req, res) => {
  try {
    const {
      fullName,
      mobileNumber,
      email,
      visitingCompany,
      hostEmployee,
      visitPurpose,
      visitDate,
      expectedTime,
      branchLocation,
      vehicleNumber,
      facePhoto,
      idType,
      idProofUrl,
      assignedHr,
    } = req.body;

    // Required field validation
    if (
      !fullName ||
      !mobileNumber ||
      !hostEmployee ||
      !visitPurpose ||
      !visitDate ||
      !expectedTime ||
      !branchLocation ||
      !facePhoto
    ) {
      return res.status(400).json({
        success: false,
        message: "Please fill all required fields.",
      });
    }

    // Resolve and validate the company from the public pre-booking link
    const Company = require("../models/Company");

    const targetCompanyId = String(
      req.body.companyId || ""
    ).trim().toUpperCase();

    // companyId is compulsory. Do not silently use FIC001.
    if (!targetCompanyId) {
      return res.status(400).json({
        success: false,
        message: "Company ID is required. Please use the company's official pre-booking link."
      });
    }

    const targetCompany = await Company.findOne({
      code: targetCompanyId
    });

    if (!targetCompany) {
      return res.status(404).json({
        success: false,
        message: "This pre-booking link is invalid or unavailable. Company is not registered."
      });
    }

    if (targetCompany.status !== "Active") {
      return res.status(403).json({
        success: false,
        message: "This company account is currently inactive. Pre-booking cannot be submitted."
      });
    }

    if (
      targetCompany.subscriptionExpiresAt &&
      new Date(targetCompany.subscriptionExpiresAt) < new Date()
    ) {
      return res.status(403).json({
        success: false,
        message: "This company's subscription has expired. Pre-booking is unavailable."
      });
    }

    if (targetCompany.features?.preBookingEnabled === false) {
      return res.status(403).json({
        success: false,
        message: "Pre-booking is unavailable for this company. Please contact the administrator."
      });
    }

    // Weekday validation: only Monday (1), Wednesday (3), Saturday (6) allowed
    const cleanDateStr = String(visitDate).split('T')[0];
    const selectedDate = new Date(`${cleanDateStr}T00:00:00`);

    if (isNaN(selectedDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid visit date."
      });
    }

    const allowedDays = [1, 3, 6]; // Monday, Wednesday, Saturday

    if (!allowedDays.includes(selectedDate.getDay())) {
      return res.status(400).json({
        success: false,
        message: "Pre-booking is allowed only on Monday, Wednesday, and Saturday."
      });
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

    // Duplicate Prevention Check: Normalize email & mobile and check for active pre-bookings
    const normalizedEmail = (email || "").trim().toLowerCase();
    const normalizedMobile = (mobileNumber || "").replace(/\D/g, "");
    const mobileDigits = normalizedMobile.length >= 10 ? normalizedMobile.slice(-10) : normalizedMobile;
    const activeBookingKey = `${normalizedEmail}|${normalizedMobile}`;

    const activeStatuses = [
      "PENDING", "APPROVED", "CHECKED_IN", "CHECKED IN", "INSIDE", 
      "Pre-Booked", "Pending", "Approved"
    ];

    const duplicateOrConditions = [
      { activeBookingKey }
    ];
    if (normalizedEmail) {
      duplicateOrConditions.push({ email: { $regex: new RegExp(`^${normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } });
    }
    if (mobileDigits && mobileDigits.length >= 6) {
      duplicateOrConditions.push({ mobileNumber: { $regex: new RegExp(`${mobileDigits}$`) } });
    }

    if (duplicateOrConditions.length > 0) {
      const existingPreBooking = await PreBooking.findOne({
        companyId: targetCompany.code,
        status: { $in: activeStatuses },
        $or: duplicateOrConditions
      });

      const Visitor = require("../models/Visitor");
      const existingVisitor = existingPreBooking ? null : await Visitor.findOne({
        companyId: targetCompany.code,
        status: { $in: activeStatuses },
        $or: duplicateOrConditions
      });

      if (existingPreBooking || existingVisitor) {
        return res.status(409).json({
          success: false,
          code: "ALREADY_REGISTERED",
          message: "Already Registered. You already have an active pre-booking. Please wait until your existing visit is completed."
        });
      }
    }

    let hrUser = null;
    if (assignedHr) {
      const User = require("../models/User");
      hrUser = await User.findOne({
        _id: assignedHr,
        companyId: targetCompany.code,
        status: "Active"
      });

      if (!hrUser) {
        return res.status(400).json({
          success: false,
          message: "Selected host is invalid or inactive."
        });
      }
    }

    const visitorId = await createVisitorId();

    const isNewVisitor = hostEmployee === "New Visitors" || hostEmployee === "New Visitor" || hostEmployee === "Direct Visits" || hostEmployee === "Direct Visit";
    const finalAssignedHr = (isNewVisitor || !assignedHr) ? null : assignedHr;
    const visitorType = isNewVisitor ? "NEW_VISITOR" : "NORMAL";

    const completedStatuses = ["CHECKED_OUT", "Checked Out", "Exited", "Completed"];
    const Visitor = require("../models/Visitor");
    const hasCompletedPastVisit = Boolean(
      (await PreBooking.exists({
        companyId: targetCompany.code,
        mobileNumber: normalizedMobile || mobileNumber,
        status: { $in: completedStatuses }
      })) ||
      (await Visitor.exists({
        companyId: targetCompany.code,
        mobileNumber: normalizedMobile || mobileNumber,
        status: { $in: completedStatuses }
      }))
    );

    const isReturning = Boolean(
      req.body.returningVisitor || 
      req.body.isReturningVisitor || 
      req.body.isReturning || 
      req.body.registrationType === 'Returning' ||
      hasCompletedPastVisit
    );

    const preBooking = await PreBooking.create({
      companyId: targetCompany.code,
      visitorId,
      fullName,
      mobileNumber: normalizedMobile || mobileNumber,
      email: normalizedEmail || email,
      activeBookingKey,
      activeEmailLock: normalizedEmail || undefined,
      activeMobileLock: normalizedMobile || undefined,
      visitingCompany,
      hostEmployee,
      visitPurpose,
      visitDate,
      expectedTime,
      branchLocation,
      vehicleNumber,
      facePhoto,
      idType: idType || "",
      idProofUrl: idProofUrl || "",
      assignedHr: finalAssignedHr,
      visitorType,
      bookingType: "PRE_BOOKING",
      status: "PENDING",
      isReturning: isReturning,
      isReturningVisitor: isReturning,
      returningVisitor: isReturning,
      trackingToken: require("crypto").randomBytes(32).toString("hex"),
      trackingTokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    });

    // Create Notifications via Service
    try {
      const Notification = require("../models/Notification");

      await Notification.create({
        eventId: `PREBOOKING_CREATED_${preBooking._id}`,
        companyId: preBooking.companyId,
        branchId: preBooking.branchLocation,
        preBookingId: preBooking._id,
        visitorId: preBooking.visitorId,
        visitorType: "PRE_BOOKING",
      
        type: "PREBOOKING_CREATED",
        module: "PreBooking",
        title: "New Pre-Booking",
        message: `${preBooking.fullName} submitted a new pre-booking.`,
      
        createdBy: preBooking.fullName,
      
        roles: [
          "Super Admin",
          "Company Admin",
          "Admin",
          "MD",
          "HR",
          "Senior HR",
          "Receptionist",
          "Security"
        ]
      });

    } catch (notifErr) {
      console.error("Error creating pre-booking notifications:", notifErr);
    }

    return res.status(201).json({
      success: true,
      message: "Pre-Booking submitted successfully.",
      data: preBooking,
    });
  } catch (error) {
    console.error("Create Pre-Booking Error:", error);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        code: "VALIDATION_ERROR",
        message: error.message
      });
    }

    // E11000 Duplicate Key Handling for simultaneous/concurrent requests
    if (error.code === 11000 || error.name === 'MongoError' || error.name === 'MongoServerError') {
      return res.status(409).json({
        success: false,
        code: "ALREADY_REGISTERED",
        message: "Already Registered. You already have an active pre-booking. Please wait until your existing visit is completed."
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create Pre-Booking.",
      error: error.message,
    });
  }
};

const getAllPreBookings = async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId || companyId === 'SYSTEM') {
      return res.json({
        success: true,
        count: 0,
        data: []
      });
    }

    const filter = {
      companyId: companyId
    };

    if (
      req.branchId &&
      req.branchId !== "All Branches"
    ) {
      filter.branchLocation = req.branchId;
    } else if (req.query.branch && req.query.branch !== "All Branches") {
      filter.branchLocation = req.query.branch;
    }

    const normalizedRole = (req.userRole || '').toUpperCase().trim();
    // Role-based filtering: HR/Employee users only see their assigned visitors or where they are the host
    if (normalizedRole === 'HR' || normalizedRole === 'EMPLOYEE') {
      const mongoose = require('mongoose');
      let hrUser = req.user;
      if (!hrUser && req.userId && mongoose.isValidObjectId(req.userId)) {
        const User = require('../models/User');
        hrUser = await User.findById(req.userId);
      }
      const hrName = (hrUser?.name || req.headers['x-user-name'] || '').trim();
      const hrId = req.userId || req.headers['x-user-id'];

      const hrOr = [];
      if (hrId) hrOr.push({ assignedHr: hrId });
      if (hrName) hrOr.push({ hostEmployee: new RegExp(`^${hrName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') });
      
      if (hrOr.length > 0) {
        filter.$or = hrOr;
      }
      filter.visitorType = { $ne: 'NEW_VISITOR' };
    }

    filter.fullName = { $not: /^(test|test 1|test 2|test 3|lokeee|testing)$/i };

    const preBookings = await PreBooking.find(filter)
      .populate("assignedHr", "name email role companyId")
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      count: preBookings.length,
      data: preBookings
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Unable to fetch pre-bookings"
    });
  }
};

// Approve Pre-Booking and generate QR token
const approvePreBooking = async (req, res) => {
  try {
    const { id } = req.params;

    const preBooking = await PreBooking.findOne({
      _id: id,
      companyId: req.companyId
    });

    if (!preBooking) {
      return res.status(404).json({
        success: false,
        message: "Pre-booking not found in your company"
      });
    }

    const company = await require('../models/Company').findOne({ code: req.companyId });
    
    // Check if the user is authorized to approve
    const rawRole = (req.user && req.user.role) ? req.user.role : req.userRole;
    const role = rawRole ? rawRole.toUpperCase().replace(/\s+/g, '_') : '';
    const isSaaSAdmin = rawRole === 'SaaS Super Admin' || role === 'SAAS_SUPER_ADMIN' || (req.userId && String(req.userId).startsWith('bootstrap-'));
    
    const allowedRoles = ['SUPER_ADMIN', 'SAAS_SUPER_ADMIN', 'MD', 'SENIOR_HR', 'ADMIN', 'BRANCH_ADMIN', 'HR'];
    const isRoleAllowed = allowedRoles.includes(role);
    
    const allowedApprovers = ['sandeep', 'avinash', 'agila', 'jeo', 'joe christo', 'vaideeswari'];
    const userNameLower = req.userName ? req.userName.toLowerCase().trim() : '';
    const isNamedAllowed = allowedApprovers.some(allowed => userNameLower.includes(allowed));

    let hasDbPerm = false;
    if (role) {
      const ApprovalPermission = require('../models/ApprovalPermission');
      const perm = await ApprovalPermission.findOne({ role });
      if (perm && perm.canApprove) hasDbPerm = true;
    }

    if (!isSaaSAdmin && !isRoleAllowed && !isNamedAllowed && !hasDbPerm) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to approve pre-bookings."
      });
    }

    if (preBooking.status !== "PENDING") {
      return res.status(400).json({
        success: false,
        message: `Cannot approve a booking with status ${preBooking.status}.`,
      });
    }

    const qrToken = crypto.randomBytes(32).toString("hex");

    preBooking.status = "APPROVED";
    preBooking.qrToken = qrToken;
    preBooking.approvedAt = new Date();

    preBooking.approvalDetails = {
      approvedBy: req.userId,
      approvedByRole: req.userRole,
      approvedAt: new Date(),
      method: 'Dashboard'
    };

    preBooking.statusHistory.push({
      status: 'APPROVED',
      changedBy: req.userId,
      changedByRole: req.userRole,
      changedAt: new Date(),
      reason: ''
    });

    await preBooking.save();

    try {
      await sendApprovalEmail(preBooking);
    } catch (emailError) {
      console.error("Brevo approval email failed:", emailError);
    }

    // Send notifications to Super Admins and the assigned HR
    try {
      const User = require("../models/User");
      const Notification = require("../models/Notification");

      // 1. Find all dashboard users of this specific tenant company
      const companyRegex = new RegExp(`^${preBooking.companyId || 'FIC001'}$`, 'i');
      const dashboardUsers = await User.find({
        role: { $in: ["Super Admin", "Company Admin", "Admin", "MD", "HR", "Receptionist", "Security"] },
        companyId: companyRegex,
        status: "Active"
      });

      const approverName = formatDisplayName(req.userName || req.userRole || "Authorized Personnel");
      const visitorName = formatDisplayName(preBooking.fullName);
      const notificationMessage = `${visitorName} was approved by ${approverName}.`;

      const recipientIds = dashboardUsers.map(u => String(u._id));
      const uniqueRecipientIds = [...new Set(recipientIds)];

      const eventId = `PREBOOK_APPROVED_${preBooking._id}`;

      // 2. Create or find main persistent notification document in DB
      const mainNotification = await Notification.findOneAndUpdate(
        { eventId },
        {
          $set: {
            title: "Pre-Booking Approved",
            message: notificationMessage,
            visitorName: visitorName
          },
          $setOnInsert: {
            eventId,
            companyId: preBooking.companyId || 'FIC001',
            branchId: preBooking.branchLocation || 'Head Office(KRISHNAGIRI)',
            recipients: uniqueRecipientIds.map(id => ({
              userId: String(id),
              user: id
            })),
            roles: ["Super Admin", "Company Admin", "Admin", "MD", "HR", "Receptionist", "Security"],
            visitorId: preBooking.visitorId,
            visitorType: 'PRE_BOOKING',
            preBookingId: preBooking._id,
            type: "PREBOOKING_APPROVED",
            module: "PreBooking",
            createdBy: approverName,
            isRead: false
          }
        },
        {
          upsert: true,
          returnDocument: "after"
        }
      );

      // 3. Emit real saved DB notification over socket.io
      const io = req.app.get('io');
      if (io && mainNotification) {
        io.to(`company:${mainNotification.companyId}`).emit('new_notification', mainNotification);
      }
    } catch (notifErr) {
      console.error("Error creating approval notifications:", notifErr);
    }

    return res.status(200).json({
      success: true,
      message: "Pre-Booking approved successfully.",
      data: {
        visitorId: preBooking.visitorId,
        qrToken: preBooking.qrToken,
        status: preBooking.status,
      },
    });
  } catch (error) {
    console.error("Approve Pre-Booking Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to approve Pre-Booking.",
      error: error.message,
    });
  }
};

// Reject Pre-Booking
const rejectPreBooking = async (req, res) => {
  try {
    const { id } = req.params;

    const preBooking = await PreBooking.findOne({
      _id: id,
      companyId: req.companyId
    });

    if (!preBooking) {
      return res.status(404).json({
        success: false,
        message: "Pre-booking not found in your company"
      });
    }

    // Check if the user is authorized to reject
    const rawRoleReject = (req.user && req.user.role) ? req.user.role : req.userRole;
    const roleReject = rawRoleReject ? rawRoleReject.toUpperCase().replace(/\s+/g, '_') : '';
    const isSaaSAdminReject = rawRoleReject === 'SaaS Super Admin' || roleReject === 'SAAS_SUPER_ADMIN' || (req.userId && String(req.userId).startsWith('bootstrap-'));
    
    const allowedRolesReject = ['SUPER_ADMIN', 'SAAS_SUPER_ADMIN', 'MD', 'SENIOR_HR', 'ADMIN', 'BRANCH_ADMIN', 'HR'];
    const isRoleAllowedReject = allowedRolesReject.includes(roleReject);
    
    const allowedApproversReject = ['sandeep', 'avinash', 'agila', 'jeo', 'joe christo', 'vaideeswari'];
    const userNameLowerReject = req.userName ? req.userName.toLowerCase().trim() : '';
    const isNamedAllowedReject = allowedApproversReject.some(allowed => userNameLowerReject.includes(allowed));

    let hasDbPermReject = false;
    if (roleReject) {
      const ApprovalPermission = require('../models/ApprovalPermission');
      const perm = await ApprovalPermission.findOne({ role: roleReject });
      if (perm && perm.canApprove) hasDbPermReject = true;
    }

    if (!isSaaSAdminReject && !isRoleAllowedReject && !isNamedAllowedReject && !hasDbPermReject) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to reject pre-bookings."
      });
    }

    if (preBooking.status !== "PENDING") {
      return res.status(400).json({
        success: false,
        message: `Cannot reject a booking with status ${preBooking.status}.`,
      });
    }

    preBooking.status = "REJECTED";
    preBooking.rejectedAt = new Date();
    preBooking.qrToken = undefined;
    preBooking.activeBookingKey = undefined;
    preBooking.activeEmailLock = undefined;
    preBooking.activeMobileLock = undefined;

    await preBooking.save();

    // Send notifications to Super Admins and the assigned HR
    try {
      const User = require("../models/User");
      const Notification = require("../models/Notification");

      // 1. Find all dashboard users of this specific tenant company
      const companyRegex = new RegExp(`^${preBooking.companyId || 'FIC001'}$`, 'i');
      const dashboardUsers = await User.find({
        role: { $in: ["Super Admin", "Company Admin", "Admin", "MD", "HR", "Receptionist", "Security"] },
        companyId: companyRegex,
        status: "Active"
      });

      const rejectorName = formatDisplayName(req.userName || req.userRole || "Authorized Personnel");
      const visitorName = formatDisplayName(preBooking.fullName);
      const notificationMessage = `${preBooking.fullName} was rejected by ${rejectorName}.`;

      const recipientIds = dashboardUsers.map(u => String(u._id));
      const uniqueRecipientIds = [...new Set(recipientIds)];
      const eventId = `PREBOOK_REJECTED_${preBooking._id}`;

      // 2. Create or find main persistent notification document in DB
      const notification = await Notification.findOneAndUpdate(
        { eventId },
        {
          $setOnInsert: {
            eventId,
            companyId: preBooking.companyId || "FIC001",
            branchId: preBooking.branchLocation,
            recipients: uniqueRecipientIds.map(id => ({
              userId: String(id),
              user: id
            })),
            roles: ["Super Admin", "Company Admin", "Admin", "MD", "HR", "Receptionist", "Security"],
            visitorId: preBooking.visitorId,
            visitorType: "PRE_BOOKING",
            preBookingId: preBooking._id,
            type: "PREBOOKING_REJECTED",
            module: "PreBooking",
            title: "Pre-Booking Rejected",
            message: `${preBooking.fullName} was rejected by ${rejectorName}.`,
            isRead: false
          }
        },
        {
          upsert: true,
          returnDocument: "after"
        }
      );

      // 3. Emit live socket alert to all dashboard users
      const io = req.app.get('io');
      if (io && notification) {
        io.to(`company:${notification.companyId}`).emit('new_notification', notification);
      }
    } catch (notifErr) {
      console.error("Error creating rejection notifications:", notifErr);
    }

    return res.status(200).json({
      success: true,
      message: "Pre-Booking rejected successfully.",
      data: {
        visitorId: preBooking.visitorId,
        status: preBooking.status,
      },
    });
  } catch (error) {
    console.error("Reject Pre-Booking Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to reject Pre-Booking.",
      error: error.message,
    });
  }
};

// Backfill: Assign qrToken to any pre-booking that doesn't have one yet
const backfillQrTokens = async (req, res) => {
  try {
    const records = await PreBooking.find({ 
      qrToken: { $in: [null, undefined, ''] },
      status: "APPROVED" 
    });
    let updated = 0;
    for (const record of records) {
      record.qrToken = `vms_${crypto.randomBytes(16).toString("hex")}`;
      await record.save();
      updated++;
    }
    return res.status(200).json({
      success: true,
      message: `Backfill complete. Updated ${updated} records with QR tokens.`,
      updated,
    });
  } catch (error) {
    console.error("Backfill QR Tokens Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to backfill QR tokens.",
      error: error.message,
    });
  }
};

// Get single Pre-Booking by visitorId, mobileNumber, or _id
const getPreBookingByVisitId = async (req, res) => {
  try {
    const rawId = (req.params.visitId || req.params.visitorId || "").trim();
    if (!rawId) {
      return res.status(400).json({ success: false, message: "Visitor ID is required." });
    }

    const cleanId = rawId.trim();
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

    let pb = await PreBooking.findOne({ $or: searchConditions }).populate("assignedHr");

    if (!pb) {
      const Visitor = require("../models/Visitor");
      const vDoc = await Visitor.findOne({ $or: searchConditions });

      if (vDoc) {
        return res.status(200).json({
          success: true,
          data: {
            id: vDoc._id,
            _id: vDoc._id,
            visitorId: vDoc.visitorId || vDoc.visitId || vDoc.profileId || vDoc._id,
            visitId: vDoc.visitId || vDoc.visitorId || vDoc.profileId,
            profileId: vDoc.profileId || vDoc.visitId || vDoc.visitorId,
            fullName: vDoc.visitorName || vDoc.fullName,
            visitorName: vDoc.visitorName || vDoc.fullName,
            mobileNumber: vDoc.mobileNumber,
            email: vDoc.email || '',
            visitingCompany: vDoc.companyName || 'Forge India Connect Private Limited',
            companyName: vDoc.companyName || 'Forge India Connect Private Limited',
            hostEmployee: vDoc.hostName,
            hostName: vDoc.hostName,
            visitPurpose: vDoc.purpose,
            purpose: vDoc.purpose,
            visitDate: vDoc.visitDate,
            expectedTime: vDoc.expectedArrivalTime || '10:00 AM',
            expectedArrivalTime: vDoc.expectedArrivalTime || '10:00 AM',
            branchLocation: vDoc.branch || 'Head Office',
            branch: vDoc.branch || 'Head Office',
            vehicleNumber: vDoc.vehicleNumber || '-',
            idType: vDoc.idType || '',
            idProofUrl: vDoc.idProofUrl || '',
            facePhoto: vDoc.photoUrl,
            photoUrl: vDoc.photoUrl,
            status: vDoc.status || 'PENDING',
            checkInTime: vDoc.checkInTime || null,
            checkOutTime: vDoc.checkOutTime || null
          }
        });
      }

      return res.status(404).json({
        success: false,
        message: "Visitor not found.",
      });
    }

    if (req.userRole === 'HR' && pb.assignedHr && pb.assignedHr.toString() !== req.userId) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to view this pre-booking assignment."
      });
    }

    const visitorObj = {
      id: pb._id,
      _id: pb._id,
      visitorId: pb.visitorId,
      visitId: pb.visitorId,
      profileId: pb.visitorId,
      fullName: pb.fullName,
      visitorName: pb.fullName,
      mobileNumber: pb.mobileNumber,
      email: pb.email,
      visitingCompany: pb.visitingCompany || 'Forge India Connect Private Limited',
      companyName: pb.visitingCompany || 'Forge India Connect Private Limited',
      hostEmployee: pb.hostEmployee,
      hostName: pb.hostEmployee,
      visitPurpose: pb.visitPurpose,
      purpose: pb.visitPurpose,
      visitDate: pb.visitDate,
      expectedTime: pb.expectedTime,
      expectedArrivalTime: pb.expectedTime,
      branchLocation: pb.branchLocation || 'Head Office',
      branch: pb.branchLocation || 'Head Office',
      vehicleNumber: pb.vehicleNumber,
      idType: pb.idType || '',
      idProofUrl: pb.idProofUrl || '',
      facePhoto: pb.facePhoto,
      photoUrl: pb.facePhoto,
      status: pb.status,
      visitorType: pb.visitorType || 'NORMAL',
      qrToken: pb.qrToken || null,
      checkInTime: pb.checkInTime || null,
      checkInBy: pb.checkInBy || null,
      checkOutTime: pb.checkOutTime || null,
      checkOutBy: pb.checkOutBy || null,
      checkOutNotes: pb.checkOutNotes || pb.exitNotes || '',
      assignedHr: pb.assignedHr ? {
        id: pb.assignedHr._id,
        _id: pb.assignedHr._id,
        name: pb.assignedHr.name,
        email: pb.assignedHr.email
      } : null,
      createdAt: pb.createdAt
    };

    return res.status(200).json({
      success: true,
      data: visitorObj,
      ...visitorObj
    });
  } catch (error) {
    console.error("Get Pre-Booking By VisitId Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch Pre-Booking details.",
      error: error.message,
    });
  }
};

// Get Pre-Booking by QR token
const getPreBookingByQR = async (req, res) => {
  try {
    const token = (req.params.token || req.params.qrToken || "").trim();
    if (!token) {
      return res.status(400).json({ success: false, message: "QR Token is required." });
    }

    const pb = await PreBooking.findOne({
      qrToken: token,
      status: {
        $in: ["APPROVED", "CHECKED_IN", "CHECKED_OUT"]
      }
    }).populate("assignedHr");

    if (!pb) {
      return res.status(404).json({
        success: false,
        message: "Invalid or unavailable visitor pass",
      });
    }

    const visitorObj = {
      id: pb._id,
      _id: pb._id,
      visitorId: pb.visitorId,
      visitId: pb.visitorId,
      profileId: pb.visitorId,
      fullName: pb.fullName,
      visitorName: pb.fullName,
      mobileNumber: pb.mobileNumber,
      email: pb.email,
      visitingCompany: pb.visitingCompany || 'Forge India Connect Private Limited',
      companyName: pb.visitingCompany || 'Forge India Connect Private Limited',
      hostEmployee: pb.hostEmployee,
      hostName: pb.hostEmployee,
      visitPurpose: pb.visitPurpose,
      purpose: pb.visitPurpose,
      visitDate: pb.visitDate,
      expectedTime: pb.expectedTime,
      expectedArrivalTime: pb.expectedTime,
      branchLocation: pb.branchLocation || 'Head Office',
      branch: pb.branchLocation || 'Head Office',
      vehicleNumber: pb.vehicleNumber,
      idType: pb.idType || '',
      idProofUrl: pb.idProofUrl || '',
      facePhoto: pb.facePhoto,
      photoUrl: pb.facePhoto,
      status: pb.status,
      visitorType: pb.visitorType || 'NORMAL',
      checkInTime: pb.checkInTime || null,
      checkInBy: pb.checkInBy || null,
      checkOutTime: pb.checkOutTime || null,
      checkOutBy: pb.checkOutBy || null,
      checkOutNotes: pb.checkOutNotes || pb.exitNotes || '',
      assignedHr: pb.assignedHr ? {
        id: pb.assignedHr._id,
        _id: pb.assignedHr._id,
        name: pb.assignedHr.name,
        email: pb.assignedHr.email
      } : null,
      createdAt: pb.createdAt
    };

    return res.status(200).json({
      success: true,
      data: visitorObj,
      ...visitorObj
    });
  } catch (error) {
    console.error("Get Pre-Booking By QR Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch Pre-Booking details by QR.",
      error: error.message,
    });
  }
};

// Delete a single Pre-Booking
const deletePreBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const mongoose = require('mongoose');
    const query = {
      companyId: req.companyId
    };
    if (mongoose.isValidObjectId(id)) {
      query._id = id;
    } else {
      query.$or = [{ visitorId: id }, { visitId: id }];
    }

    const deleted = await PreBooking.findOneAndDelete(query);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Pre-booking not found in your company"
      });
    }
    return res.status(200).json({ success: true, message: "Pre-Booking deleted successfully." });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to delete Pre-Booking.", error: error.message });
  }
};

// Clear all test/dummy Pre-Bookings
const clearAllPreBookings = async (req, res) => {
  try {
    await PreBooking.deleteMany({});
    return res.status(200).json({ success: true, message: "All test pre-booking data cleared successfully." });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to clear pre-bookings.", error: error.message });
  }
};

// Check-In Controller
const checkInPreBooking = async (req, res) => {
  try {
    const rawId = (req.params.visitorId || req.params.id || req.params.visitId || "").trim();
    if (!rawId) {
      return res.status(400).json({ success: false, message: "Visitor ID is required." });
    }

    const isValidObjectId = require('mongoose').isValidObjectId(rawId);
    const searchRegex = new RegExp(`^${rawId.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}$`, 'i');

    const preBooking = await PreBooking.findOne({
      $and: [
        {
          $or: [
            { visitorId: searchRegex },
            { visitorId: rawId.toUpperCase() },
            { mobileNumber: rawId },
            { qrToken: rawId },
            ...(isValidObjectId ? [{ _id: rawId }] : [])
          ]
        },
        { companyId: req.companyId }
      ]
    });

    if (!preBooking) {
      return res.status(404).json({
        success: false,
        message: "Pre-booking not found in your company"
      });
    }

    if (preBooking.status === "CHECKED_IN" || preBooking.status === "Checked In") {
      return res.status(400).json({
        success: false,
        message: "Visitor is already checked in."
      });
    }

    if (preBooking.status === "CHECKED_OUT" || preBooking.status === "Checked Out") {
      return res.status(400).json({
        success: false,
        message: "Visitor has already checked out."
      });
    }

    // Visitor must be approved first
    const isApproved = preBooking.status === "APPROVED" || preBooking.status === "Approved" || preBooking.status === "Pre-Booked";
    if (!isApproved) {
      return res.status(403).json({
        success: false,
        message: "Visitor must be approved before check-in"
      });
    }

    preBooking.status = "CHECKED_IN";
    preBooking.checkInTime = new Date();
    preBooking.checkInBy = req.user?.fullName || req.user?.name || "Self Check-In";

    await preBooking.save();

    try {
      const User = require("../models/User");
      const Notification = require("../models/Notification");

      const notifiableUsers = await User.find({
        companyId: preBooking.companyId || 'FIC001',
        role: { $in: ['Super Admin', 'Security'] }
      });

      const recipientIds = notifiableUsers.map(u => u._id.toString());
      if (preBooking.assignedHr) {
        recipientIds.push(preBooking.assignedHr.toString());
      }

      const uniqueRecipientIds = [...new Set(recipientIds)];
      const eventId = `PREBOOK_CHECKIN_${preBooking._id}`;

      const notification = await Notification.findOneAndUpdate(
        { eventId },
        {
          $set: {
            title: "Pre-Booking Checked In",
            message: `${preBooking.fullName} has checked in.`,
            visitorName: formatDisplayName(preBooking.fullName)
          },
          $setOnInsert: {
            eventId,
            companyId: preBooking.companyId || "FIC001",
            branchId: preBooking.branchLocation,
            recipients: uniqueRecipientIds.map(id => ({
              userId: String(id),
              user: id
            })),
            visitorId: preBooking.visitorId,
            visitorType: "PRE_BOOKING",
            preBookingId: preBooking._id,
            type: "PREBOOKING_CHECKED_IN",
            module: "PreBooking",
            createdBy: req.user?.fullName || "Security",
            isRead: false
          }
        },
        {
          upsert: true,
          returnDocument: "after"
        }
      );

      const io = req.app.get("io");

      if (io && notification) {
        io.to(`company:${String(notification.companyId).trim().toUpperCase()}`).emit("new_notification", notification);
      }
    } catch (notifErr) {
      console.error("Error creating check-in notifications:", notifErr);
    }

    const dataObj = {
      id: preBooking._id,
      _id: preBooking._id,
      visitorId: preBooking.visitorId,
      visitId: preBooking.visitorId,
      fullName: preBooking.fullName,
      visitorName: preBooking.fullName,
      mobileNumber: preBooking.mobileNumber,
      email: preBooking.email,
      visitingCompany: preBooking.visitingCompany || 'Forge India Connect Private Limited',
      companyName: preBooking.visitingCompany || 'Forge India Connect Private Limited',
      hostEmployee: preBooking.hostEmployee,
      hostName: preBooking.hostEmployee,
      visitPurpose: preBooking.visitPurpose,
      purpose: preBooking.visitPurpose,
      visitDate: preBooking.visitDate,
      expectedTime: preBooking.expectedTime,
      expectedArrivalTime: preBooking.expectedTime,
      branchLocation: preBooking.branchLocation,
      branch: preBooking.branchLocation,
      vehicleNumber: preBooking.vehicleNumber,
      idType: preBooking.idType || '',
      idProofUrl: preBooking.idProofUrl || '',
      facePhoto: preBooking.facePhoto,
      photoUrl: preBooking.facePhoto,
      status: "CHECKED_IN",
      checkInTime: preBooking.checkInTime,
      checkInBy: preBooking.checkInBy,
      entryTime: new Date(preBooking.checkInTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
    };

    return res.status(200).json({
      success: true,
      message: "Visitor checked in successfully.",
      data: dataObj,
      ...dataObj
    });
  } catch (error) {
    console.error("Check-In Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to check in visitor.",
      error: error.message
    });
  }
};

// Check-Out Controller with Mandatory Exit Notes
const checkOutPreBooking = async (req, res) => {
  try {
    const rawId = (req.params.visitorId || req.params.id || req.params.visitId || "").trim();
    const { checkOutNotes, exitNotes } = req.body;

    const notes = (checkOutNotes || exitNotes || "").trim();
    if (!notes) {
      return res.status(400).json({
        success: false,
        message: "Check-Out Notes / Exit Notes are mandatory before completing check-out."
      });
    }

    const isValidObjectId = require('mongoose').isValidObjectId(rawId);
    const searchRegex = new RegExp(`^${rawId.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}$`, 'i');

    const preBooking = await PreBooking.findOne({
      $and: [
        {
          $or: [
            { visitorId: searchRegex },
            { visitorId: rawId.toUpperCase() },
            { mobileNumber: rawId },
            { qrToken: rawId },
            ...(isValidObjectId ? [{ _id: rawId }] : [])
          ]
        },
        { companyId: req.companyId }
      ]
    });

    if (!preBooking) {
      return res.status(404).json({
        success: false,
        message: "Pre-booking not found in your company"
      });
    }

    if (preBooking.status !== "CHECKED_IN" && preBooking.status !== "Checked In") {
      return res.status(400).json({
        success: false,
        message: "Only checked-in visitors can be checked out."
      });
    }

    preBooking.status = "CHECKED_OUT";
    preBooking.checkOutTime = new Date();
    preBooking.checkOutBy = req.user?.fullName || req.user?.name || "Self Check-Out";
    preBooking.checkOutNotes = notes;
    preBooking.exitNotes = notes;
    preBooking.activeBookingKey = undefined;
    preBooking.activeEmailLock = undefined;
    preBooking.activeMobileLock = undefined;

    await preBooking.save();

    try {
      const User = require("../models/User");
      const Notification = require("../models/Notification");

      const notifiableUsers = await User.find({
        companyId: preBooking.companyId || 'FIC001',
        role: { $in: ['Super Admin', 'Security'] }
      });

      const recipientIds = notifiableUsers.map(u => u._id.toString());
      if (preBooking.assignedHr) {
        recipientIds.push(preBooking.assignedHr.toString());
      }

      const uniqueRecipientIds = [...new Set(recipientIds)];
      const eventId = `PREBOOK_CHECKOUT_${preBooking._id}`;

      const notification = await Notification.findOneAndUpdate(
        { eventId },
        {
          $set: {
            title: "Pre-Booking Checked Out",
            message: `${preBooking.fullName} has checked out.`,
            visitorName: formatDisplayName(preBooking.fullName)
          },
          $setOnInsert: {
            eventId,
            companyId: preBooking.companyId || "FIC001",
            branchId: preBooking.branchLocation,
            recipients: uniqueRecipientIds.map(id => ({
              userId: String(id),
              user: id
            })),
            visitorId: preBooking.visitorId,
            visitorType: "PRE_BOOKING",
            preBookingId: preBooking._id,
            type: "PREBOOKING_CHECKED_OUT",
            module: "PreBooking",
            createdBy: req.user?.fullName || "Security",
            isRead: false
          }
        },
        {
          upsert: true,
          returnDocument: "after"
        }
      );

      const io = req.app.get("io");

      if (io && notification) {
        io.to(`company:${String(notification.companyId).trim().toUpperCase()}`).emit("new_notification", notification);
      }
    } catch (notifErr) {
      console.error("Error creating check-out notifications:", notifErr);
    }

    const dataObj = {
      id: preBooking._id,
      _id: preBooking._id,
      visitorId: preBooking.visitorId,
      visitId: preBooking.visitorId,
      fullName: preBooking.fullName,
      visitorName: preBooking.fullName,
      mobileNumber: preBooking.mobileNumber,
      visitingCompany: preBooking.visitingCompany || 'Forge India Connect Private Limited',
      companyName: preBooking.visitingCompany || 'Forge India Connect Private Limited',
      hostEmployee: preBooking.hostEmployee,
      hostName: preBooking.hostEmployee,
      status: "CHECKED_OUT",
      checkInTime: preBooking.checkInTime,
      checkInBy: preBooking.checkInBy,
      checkOutTime: preBooking.checkOutTime,
      checkOutBy: preBooking.checkOutBy,
      checkOutNotes: notes,
      exitNotes: notes,
      exitTime: new Date(preBooking.checkOutTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
    };

    return res.status(200).json({
      success: true,
      message: "Visitor checked out successfully.",
      data: dataObj,
      ...dataObj
    });
  } catch (error) {
    console.error("Check-Out Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to check out visitor.",
      error: error.message
    });
  }
};

const getMyPreBookings = async (req, res) => {
  try {
    const mongoose = require('mongoose');
    let userObj = req.user;
    if (!userObj && req.userId && mongoose.isValidObjectId(req.userId)) {
      const User = require('../models/User');
      userObj = await User.findById(req.userId);
    }
    const hrName = (userObj?.name || req.headers['x-user-name'] || req.userId || 'Priyadharshini').trim();

    // Strict host name match: only return pre-bookings where hostEmployee matches this HR's name
    const filter = {
      companyId: req.companyId,
      hostEmployee: new RegExp(hrName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    };

    const visitors = await PreBooking.find(filter)
      .populate("assignedHr", "name email")
      .sort({
        createdAt: -1
      });

    return res.status(200).json({
      success: true,
      data: visitors
    });
  } catch (error) {
    console.error("HR Pre-bookings error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch pre-bookings."
    });
  }
};

const getPreBookingReports = async (req, res) => {
  try {
    const allowedRoles = ["Super Admin", "SaaS Super Admin", "MD"];
    if (!allowedRoles.includes(req.userRole)) {
      return res.status(403).json({
        success: false,
        message: "Only Super Admin and MD can access pre-booking reports"
      });
    }

    const reportsQuery = {
      companyId: req.companyId,
      hostEmployee: { $not: /direct\s*visit/i },
      visitPurpose: { $not: /direct\s*visit/i },
      registrationType: { $not: /direct/i },
      visitType: { $not: /direct/i },
      visitorType: { $not: /direct|NEW_VISITOR/i }
    };
    if (req.userRole === 'SaaS Super Admin') {
      delete reportsQuery.companyId;
    }

    const reports = await PreBooking.find(reportsQuery)
      .populate("assignedHr", "name email")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: reports.length,
      data: reports
    });
  } catch (error) {
    console.error("Get pre-booking reports error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch pre-booking reports"
    });
  }
};

const reschedulePreBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const { visitDate, expectedTime, appointmentEndTime, reason } = req.body;

    const mongoose = require('mongoose');

    const searchConditions = [
      { visitorId: id },
      { visitId: id }
    ];

    if (mongoose.isValidObjectId(id)) {
      searchConditions.push({ _id: id });
    }

    const preBooking = await PreBooking.findOne({
      $and: [
        { $or: searchConditions },
        { companyId: req.companyId }
      ]
    });

    if (!preBooking) {
      return res.status(404).json({
        success: false,
        message: "Pre-booking not found in your company"
      });
    }

    if (preBooking.status === "CHECKED_IN" || preBooking.status === "CHECKED_OUT" || preBooking.status === "Checked Out") {
      return res.status(400).json({
        success: false,
        message: "Cannot reschedule an active or completed visit."
      });
    }

    if (!visitDate) {
      return res.status(400).json({
        success: false,
        message: "Please select a new appointment date."
      });
    }

    if (!expectedTime) {
      return res.status(400).json({
        success: false,
        message: "Please select a start time."
      });
    }

    const oldVisitDate = preBooking.visitDate;
    const oldExpectedTime = preBooking.expectedTime;
    const oldEndTime = preBooking.appointmentEndTime;

    const cleanRescheduleDateStr = String(visitDate).split('T')[0];
    const newDateObj = new Date(`${cleanRescheduleDateStr}T00:00:00`);
    if (isNaN(newDateObj.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid visit date."
      });
    }

    const allowedDays = [1, 3, 6]; // Monday, Wednesday, Saturday

    if (!allowedDays.includes(newDateObj.getDay())) {
      return res.status(400).json({
        success: false,
        message: "Pre-booking is allowed only on Monday, Wednesday, and Saturday."
      });
    }

    const reschedulerName = formatDisplayName(req.userName || req.body?.rescheduledByName || (req.user && req.user.name) || req.userRole || "Authorized Personnel");
    const reschedulerRole = req.userRole || (req.user && req.user.role) || "User";
    const reschedulerUserId = req.userId || (req.user && req.user._id) || 'system';

    if (!preBooking.rescheduleHistory) {
      preBooking.rescheduleHistory = [];
    }

    preBooking.rescheduleHistory.push({
      oldVisitDate,
      oldExpectedTime,
      oldEndTime,
      newVisitDate: newDateObj,
      newExpectedTime: expectedTime,
      newEndTime: appointmentEndTime || oldEndTime,
      reason: reason || "Appointment Rescheduled",
      rescheduledBy: {
        userId: reschedulerUserId,
        name: reschedulerName,
        role: reschedulerRole
      },
      rescheduledAt: new Date()
    });

    preBooking.visitDate = newDateObj;
    preBooking.expectedTime = expectedTime;
    if (appointmentEndTime) {
      preBooking.appointmentEndTime = appointmentEndTime;
    }
    preBooking.approvalStatus = "DATE_CHANGED";

    await preBooking.save();

    // Real-time update for Security/Admin dashboards
    const io = req.app.get('io');
    if (io) {
      io.to(`company:${String(preBooking.companyId || req.companyId).trim().toUpperCase()}`).emit('visitor-status-updated', {
        visitorId: preBooking._id.toString(),
        visitorType: 'PRE_BOOKING',
        status: preBooking.status,
        visitDate: preBooking.visitDate,
        expectedTime: preBooking.expectedTime,
        visitor: {
          _id: preBooking._id,
          visitorId: preBooking.visitorId,
          fullName: preBooking.fullName,
          visitDate: preBooking.visitDate,
          expectedTime: preBooking.expectedTime,
          expectedArrivalTime: preBooking.expectedTime,
          status: preBooking.status
        }
      });
    }

    // Trigger Notification Service
    try {
      await visitorNotificationService.notifyVisitorEvent({
        visitor: {
          _id: preBooking._id,
          visitorId: preBooking.visitorId,
          visitorName: preBooking.fullName,
          fullName: preBooking.fullName,
          visitDate: preBooking.visitDate,
          expectedArrivalTime: preBooking.expectedTime,
          expectedTime: preBooking.expectedTime,
          hostName: preBooking.hostEmployee,
          hostId: preBooking.assignedHr,
          email: preBooking.email,
          companyId: preBooking.companyId || 'FIC001',
          branch: preBooking.branchLocation,
          rescheduleHistory: preBooking.rescheduleHistory
        },
        event: visitorNotificationService.VISITOR_EVENTS.RESCHEDULED,
        actor: {
          _id: reschedulerUserId,
          name: reschedulerName,
          role: reschedulerRole
        },
        reason: reason || "Appointment Rescheduled",
        io: req.app.get('io')
      });
    } catch (notifErr) {
      console.error("Error triggering reschedule notifications:", notifErr);
    }

    return res.status(200).json({
      success: true,
      message: "Appointment rescheduled successfully.",
      data: preBooking
    });
  } catch (error) {
    console.error("Reschedule Pre-Booking Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to reschedule Pre-Booking.",
      error: error.message
    });
  }
};

// Re-Approve rejected Pre-Booking
const reApprovePreBooking = async (req, res) => {
  try {
    const { id } = req.params;

    // Strict Super Admin role check
    const rawRole = (req.user && req.user.role) ? req.user.role : req.userRole;
    const isSuperAdmin = rawRole === 'Super Admin' || rawRole === 'SaaS Super Admin' || (req.userId && String(req.userId).startsWith('bootstrap-'));
    
    if (!isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: "Only Super Admin can re-approve rejected pre-bookings."
      });
    }

    const mongoose = require("mongoose");
    const crypto = require("crypto");

    const query = {
      $and: [
        mongoose.isValidObjectId(id)
          ? { $or: [{ _id: id }, { visitorId: id }, { visitId: id }] }
          : { $or: [{ visitorId: id }, { visitId: id }] },
        { status: { $in: ["REJECTED", "Rejected"] } },
        { companyId: req.companyId }
      ]
    };

    const updatedPreBooking = await PreBooking.findOneAndUpdate(
      query,
      {
        $set: {
          status: "APPROVED",
          approvalStatus: "APPROVED",
          rejectedAt: null,
          rejectionReason: null,
          approvedAt: new Date(),
          qrToken: crypto.randomBytes(32).toString("hex"),
          trackingToken: crypto.randomBytes(32).toString("hex"),
          trackingTokenExpiresAt: new Date(
            Date.now() + 30 * 24 * 60 * 60 * 1000
          ),
          approvalDetails: {
            approvedBy: req.userId,
            approvedByRole: req.userRole || rawRole || "Super Admin",
            approvedAt: new Date(),
            method: "Super Admin Re-Approval"
          }
        },
        $push: {
          reApprovalHistory: {
            reApprovedBy: req.userId,
            reApprovedByRole: req.userRole || rawRole || "Super Admin",
            reApprovedAt: new Date(),
            previousStatus: "REJECTED"
          }
        }
      },
      {
        new: true
      }
    );

    if (!updatedPreBooking) {
      return res.status(404).json({
        success: false,
        message: "Pre-booking not found in your company or not in rejected status."
      });
    }

    // Send notifications and email only after atomic update succeeds
    try {
      const User = require("../models/User");
      const Notification = require("../models/Notification");
      const { sendEmail } = require("../utils/emailService");

      const dashboardUsers = await User.find({
        companyId: updatedPreBooking.companyId,
        role: {
          $in: [
            "Super Admin",
            "Admin",
            "MD",
            "HR",
            "Security",
            "Receptionist"
          ]
        }
      });

      const recipientIds = [
        ...new Set(dashboardUsers.map(u => String(u._id)))
      ];

      const notification = await Notification.findOneAndUpdate(
        {
          eventId: `PREBOOK_REAPPROVED_${updatedPreBooking._id}`
        },
        {
          $setOnInsert: {
            eventId: `PREBOOK_REAPPROVED_${updatedPreBooking._id}`,
            companyId: updatedPreBooking.companyId || "FIC001",
            branchId: updatedPreBooking.branchLocation,

            recipients: recipientIds.map(id => ({
              userId: id,
              user: id
            })),

            visitorId: updatedPreBooking.visitorId,
            visitorType: "PRE_BOOKING",
            preBookingId: updatedPreBooking._id,

            type: "PREBOOKING_REAPPROVED",
            module: "PreBooking",
            title: "Pre-Booking Re-Approved",
            message: `Visitor pre-booking for ${formatDisplayName(updatedPreBooking.fullName || updatedPreBooking.visitorName)} has been re-approved by ${formatDisplayName(req.userName || req.userRole || "Super Admin")}.`,
            createdBy: formatDisplayName(req.userName || req.userRole || "Super Admin"),
            isRead: false
          }
        },
        {
          new: true,
          upsert: true
        }
      );

      const io = req.app.get("io");

      if (io) {
        const companyRoom = `company:${String(updatedPreBooking.companyId || notification.companyId || req.companyId).trim().toUpperCase()}`;
        io.to(companyRoom).emit("new_notification", notification);

        io.to(companyRoom).emit("visitor-status-updated", {
          visitorId: updatedPreBooking._id.toString(),
          visitorType: "PRE_BOOKING",
          status: "APPROVED",
          visitor: {
            _id: updatedPreBooking._id,
            visitorId: updatedPreBooking.visitorId,
            status: "APPROVED"
          }
        });
      }

      if (updatedPreBooking.email) {
        const frontendUrl =
          process.env.FRONTEND_URL ||
          "https://zone-monitor.vercel.app";

        const passUrl =
          `${frontendUrl}/pass/${updatedPreBooking.trackingToken}`;

        await sendEmail(
          updatedPreBooking.email,
          "Your Visitor Appointment Has Been Re-Approved",
          `
            <div style="font-family:Arial,sans-serif;">
              <h2>Visitor Appointment Re-Approved</h2>

              <p>
                Hello <strong>${updatedPreBooking.fullName || updatedPreBooking.visitorName}</strong>,
              </p>

              <p>
                Your visitor appointment has been re-approved.
              </p>

              <p>
                <strong>Date:</strong>
                ${new Date(updatedPreBooking.visitDate).toLocaleDateString()}
              </p>

              <p>
                <strong>Time:</strong>
                ${updatedPreBooking.expectedTime || updatedPreBooking.expectedArrivalTime || "10:00 AM"}
              </p>

              <div style="margin-top:20px;">
                <a
                  href="${passUrl}"
                  style="
                    display:inline-block;
                    background:#312e81;
                    color:#ffffff;
                    padding:12px 24px;
                    text-decoration:none;
                    border-radius:8px;
                    font-weight:bold;
                  "
                >
                  VIEW VISITOR PASS
                </a>
              </div>
            </div>
          `
        );
      }

    } catch (err) {
      console.error(
        "Re-Approve notification/email error:",
        err
      );
    }

    return res.status(200).json({
      success: true,
      message: "Visitor re-approved successfully.",
      data: updatedPreBooking
    });
  } catch (error) {
    console.error("Re-Approve Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to re-approve visitor."
    });
  }
};

const getReturningVisitor = async (req, res) => {
  try {
    const mobile = String(req.params.mobile || "")
      .replace(/\D/g, "")
      .slice(-10);

    if (mobile.length !== 10) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid 10-digit mobile number."
      });
    }

    // First check whether this visitor already has an ACTIVE booking
    const activeBooking = await PreBooking.findOne({
      mobileNumber: mobile,
      status: {
        $in: [
          "PENDING",
          "APPROVED",
          "CHECKED_IN",
          "Pending",
          "Approved",
          "Checked In",
          "Pre-Booked"
        ]
      }
    }).sort({ createdAt: -1 });

    if (activeBooking) {
      return res.status(200).json({
        success: true,
        hasActiveBooking: true,
        returningVisitor: true,

        data: {
          visitorId: activeBooking.visitorId,
          fullName: activeBooking.fullName,
          mobileNumber: activeBooking.mobileNumber,
          email: activeBooking.email,
          visitDate: activeBooking.visitDate,
          expectedTime: activeBooking.expectedTime,
          status: activeBooking.status
        }
      });
    }

    // Otherwise find their previous visit
    const previousBooking = await PreBooking.findOne({
      mobileNumber: mobile
    }).sort({ createdAt: -1 });

    if (!previousBooking) {
      return res.status(200).json({
        success: true,
        hasActiveBooking: false,
        returningVisitor: false
      });
    }

    return res.status(200).json({
      success: true,
      hasActiveBooking: false,
      returningVisitor: true,

      data: {
        fullName: previousBooking.fullName,
        mobileNumber: previousBooking.mobileNumber,
        email: previousBooking.email || "",
        visitingCompany: previousBooking.visitingCompany || "",
        vehicleNumber: previousBooking.vehicleNumber || ""
      }
    });

  } catch (error) {
    console.error("Returning Visitor Lookup Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to check visitor."
    });
  }
};

const updatePreBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      fullName,
      mobileNumber,
      email,
      visitingCompany,
      hostEmployee,
      visitPurpose,
      visitDate,
      expectedTime,
      appointmentEndTime,
      branchLocation,
      vehicleNumber,
      status
    } = req.body;

    const mongoose = require('mongoose');
    const searchConditions = [
      { visitorId: id },
      { visitId: id }
    ];
    if (mongoose.isValidObjectId(id)) {
      searchConditions.push({ _id: id });
    }

    const preBooking = await PreBooking.findOne({
      $and: [
        { $or: searchConditions },
        { companyId: req.companyId }
      ]
    });
    if (!preBooking) {
      return res.status(404).json({ success: false, message: "Pre-booking not found in your company" });
    }

    if (fullName !== undefined) preBooking.fullName = fullName;
    if (mobileNumber !== undefined) preBooking.mobileNumber = mobileNumber;
    if (email !== undefined) preBooking.email = email;
    if (visitingCompany !== undefined) preBooking.visitingCompany = visitingCompany;
    if (hostEmployee !== undefined) preBooking.hostEmployee = hostEmployee;
    if (visitPurpose !== undefined) preBooking.visitPurpose = visitPurpose;
    if (visitDate !== undefined) preBooking.visitDate = new Date(visitDate);
    if (expectedTime !== undefined) preBooking.expectedTime = expectedTime;
    if (appointmentEndTime !== undefined) preBooking.appointmentEndTime = appointmentEndTime;
    if (branchLocation !== undefined) preBooking.branchLocation = branchLocation;
    if (vehicleNumber !== undefined) preBooking.vehicleNumber = vehicleNumber;
    if (status !== undefined) preBooking.status = status;

    // If host changed, re-assign HR
    if (hostEmployee) {
      const User = require('../models/User');
      const hrUser = await User.findOne({ 
        name: new RegExp(`^${hostEmployee.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'), 
        role: { $in: ['HR', 'Super Admin', 'Admin'] } 
      });
      if (hrUser) {
        preBooking.assignedHr = hrUser._id;
      }
    }

    await preBooking.save();

    return res.status(200).json({
      success: true,
      message: "Pre-booking updated successfully.",
      data: preBooking
    });
  } catch (error) {
    console.error("Update Pre-Booking Error:", error);
    return res.status(500).json({ success: false, message: "Failed to update pre-booking.", error: error.message });
  }
};

module.exports = {
  createPreBooking,
  getAllPreBookings,
  approvePreBooking,
  rejectPreBooking,
  reApprovePreBooking,
  getPreBookingByVisitId,
  getPreBookingByQR,
  deletePreBooking,
  clearAllPreBookings,
  checkInPreBooking,
  checkOutPreBooking,
  backfillQrTokens,
  getMyPreBookings,
  getPreBookingReports,
  reschedulePreBooking,
  getReturningVisitor,
  updatePreBooking,
};
