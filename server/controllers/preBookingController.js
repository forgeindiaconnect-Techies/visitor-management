const crypto = require("crypto");
const PreBooking = require("../models/PreBooking");

const createVisitorId = () => {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");

  return `VIS-${date}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
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

    let hrUser = null;
    if (assignedHr) {
      const User = require("../models/User");
      hrUser = await User.findOne({
        _id: assignedHr,
        role: "HR",
        status: "Active"
      });

      if (!hrUser) {
        return res.status(400).json({
          success: false,
          message: "Selected HR is invalid or inactive."
        });
      }
    }

    const visitorId = createVisitorId();
    const qrToken = `vms_${crypto.randomBytes(16).toString("hex")}`;

    const isNewVisitor = hostEmployee === "New Visitors" || hostEmployee === "New Visitor";
    const finalAssignedHr = isNewVisitor ? null : assignedHr;
    const visitorType = isNewVisitor ? "NEW_VISITOR" : "NORMAL";

    const preBooking = await PreBooking.create({
      visitorId,
      qrToken,
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
      idType: idType || "",
      idProofUrl: idProofUrl || "",
      assignedHr: finalAssignedHr,
      visitorType,
      status: "PENDING",
    });

    // Create Notifications
    try {
      const User = require("../models/User");
      const Notification = require("../models/Notification");

      // 1. Find all Super Admin and Security users
      const superAdmins = await User.find({
        companyId: preBooking.companyId || 'FIC001',
        role: 'Super Admin'
      });

      // 2. Create notification for each Super Admin
      const superAdminNotifications = superAdmins.map((admin) => ({
        companyId: preBooking.companyId || 'FIC001',
        branchId: branchLocation,
        recipient: admin._id,
        type: "PREBOOKING_CREATED",
        title: "New Pre-Booking Request",
        message: `${preBooking.fullName} has submitted a new pre-booking.`,
        preBookingId: preBooking._id,
        createdBy: "Visitor Registration"
      }));

      if (superAdminNotifications.length > 0) {
        await Notification.insertMany(superAdminNotifications);
      }

      // 3. Create notification for the assigned HR user only
      if (finalAssignedHr) {
        const selectedHrUser = await User.findById(finalAssignedHr);
        if (selectedHrUser) {
        await Notification.create({
          companyId: preBooking.companyId || 'FIC001',
          branchId: branchLocation,
          recipient: selectedHrUser._id,
          type: "PREBOOKING_CREATED",
          title: "New Pre-Booking Assigned",
          message: `${preBooking.fullName} has submitted a pre-booking assigned to you.`,
          preBookingId: preBooking._id,
          createdBy: "Visitor Registration"
        });
        }
      }

      const io = req.app.get('io');
      if (io) {
        io.emit('new_notification', {
          _id: 'notif_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
          createdAt: new Date().toISOString(),
          type: 'PREBOOKING_CREATED',
          title: 'New Pre-Booking Request',
          message: `${preBooking.fullName} has submitted a pre-booking request.`,
          preBookingId: preBooking._id,
          companyId: preBooking.companyId || 'FIC001',
          branchId: branchLocation,
          recipients: [
            ...superAdmins.map(admin => admin._id.toString()),
            ...(finalAssignedHr ? [finalAssignedHr.toString()] : [])
          ].filter(Boolean)
        });
      }
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

    return res.status(500).json({
      success: false,
      message: "Failed to create Pre-Booking.",
      error: error.message,
    });
  }
};

const getAllPreBookings = async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) {
      // Support matching single status or an array/comma-separated list if needed
      filter.status = req.query.status;
    }

    // Role-based filtering: HR users only see their assigned visitors
    if (req.userRole === 'HR' || req.userRole === 'Employee') {
      filter.assignedHr = req.userId;
      filter.visitorType = { $ne: 'NEW_VISITOR' };
    }

    const preBookings = await PreBooking.find(filter)
      .populate('assignedHr', 'name email')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: preBookings.length,
      data: preBookings,
    });
  } catch (error) {
    console.error("Get Pre-Bookings Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch Pre-Bookings.",
      error: error.message,
    });
  }
};

// Approve Pre-Booking and generate QR token
const approvePreBooking = async (req, res) => {
  try {
    const { id } = req.params;

    const preBooking = await PreBooking.findById(id);

    if (!preBooking) {
      return res.status(404).json({
        success: false,
        message: "Pre-Booking not found.",
      });
    }

    if (!['Super Admin', 'Security', 'HR'].includes(req.userRole)) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to approve pre-bookings. Security or Admin role required."
      });
    }

    if (req.userRole === 'HR' && preBooking.assignedHr && preBooking.assignedHr.toString() !== req.userId) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to approve this pre-booking assignment."
      });
    }

    if (preBooking.visitorType === "NEW_VISITOR" && req.userRole !== "Security") {
      return res.status(403).json({
        success: false,
        message: "Only Security can approve a new visitor"
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

    await preBooking.save();

    // Send notifications to Super Admins and the assigned HR
    try {
      const User = require("../models/User");
      const Notification = require("../models/Notification");

      // 1. Find all Super Admin and Security users
      const superAdmins = await User.find({
        companyId: preBooking.companyId || 'FIC001',
        role: { $in: ['Super Admin', 'Security'] }
      });

      // 2. Create notification for each Super Admin
      const superAdminNotifications = superAdmins.map((admin) => ({
        companyId: preBooking.companyId || 'FIC001',
        branchId: preBooking.branchLocation,
        recipient: admin._id,
        type: "PREBOOKING_APPROVED",
        title: "Pre-Booking Approved",
        message: `Visitor pre-booking for ${preBooking.fullName} has been approved.`,
        preBookingId: preBooking._id,
        createdBy: "System Approval"
      }));

      if (superAdminNotifications.length > 0) {
        await Notification.insertMany(superAdminNotifications);
      }

      // 3. Create notification for the assigned HR user
      if (preBooking.assignedHr) {
        await Notification.create({
          companyId: preBooking.companyId || 'FIC001',
          branchId: preBooking.branchLocation,
          recipient: preBooking.assignedHr,
          type: "PREBOOKING_APPROVED",
          title: "Pre-Booking Approved",
          message: `Visitor pre-booking for ${preBooking.fullName} has been approved.`,
          preBookingId: preBooking._id,
          createdBy: "System Approval"
        });
      }

      // 4. Emit live socket alert to both Super Admins and the HR
      const io = req.app.get('io');
      if (io) {
        io.emit('new_notification', {
          _id: 'notif_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
          createdAt: new Date().toISOString(),
          type: 'PREBOOKING_APPROVED',
          title: 'Pre-Booking Approved',
          message: `Visitor pre-booking for ${preBooking.fullName} has been approved.`,
          preBookingId: preBooking._id,
          companyId: preBooking.companyId || 'FIC001',
          branchId: preBooking.branchLocation,
          recipients: [
            ...superAdmins.map(admin => admin._id.toString()),
            preBooking.assignedHr ? preBooking.assignedHr.toString() : null
          ].filter(Boolean)
        });
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

    const preBooking = await PreBooking.findById(id);

    if (!preBooking) {
      return res.status(404).json({
        success: false,
        message: "Pre-Booking not found.",
      });
    }

    if (!['Super Admin', 'Security', 'HR'].includes(req.userRole)) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to reject pre-bookings. Security or Admin role required."
      });
    }

    if (req.userRole === 'HR' && preBooking.assignedHr && preBooking.assignedHr.toString() !== req.userId) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to reject this pre-booking assignment."
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

    await preBooking.save();

    // Send notifications to Super Admins and the assigned HR
    try {
      const User = require("../models/User");
      const Notification = require("../models/Notification");

      // 1. Find all Super Admin and Security users
      const superAdmins = await User.find({
        companyId: preBooking.companyId || 'FIC001',
        role: { $in: ['Super Admin', 'Security'] }
      });

      // 2. Create notification for each Super Admin
      const superAdminNotifications = superAdmins.map((admin) => ({
        companyId: preBooking.companyId || 'FIC001',
        branchId: preBooking.branchLocation,
        recipient: admin._id,
        type: "PREBOOKING_REJECTED",
        title: "Pre-Booking Rejected",
        message: `Visitor pre-booking for ${preBooking.fullName} has been rejected.`,
        preBookingId: preBooking._id,
        createdBy: "System Rejection"
      }));

      if (superAdminNotifications.length > 0) {
        await Notification.insertMany(superAdminNotifications);
      }

      // 3. Create notification for the assigned HR user
      if (preBooking.assignedHr) {
        await Notification.create({
          companyId: preBooking.companyId || 'FIC001',
          branchId: preBooking.branchLocation,
          recipient: preBooking.assignedHr,
          type: "PREBOOKING_REJECTED",
          title: "Pre-Booking Rejected",
          message: `Visitor pre-booking for ${preBooking.fullName} has been rejected.`,
          preBookingId: preBooking._id,
          createdBy: "System Rejection"
        });
      }

      // 4. Emit live socket alert to both Super Admins and the HR
      const io = req.app.get('io');
      if (io) {
        io.emit('new_notification', {
          _id: 'notif_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
          createdAt: new Date().toISOString(),
          type: 'PREBOOKING_REJECTED',
          title: 'Pre-Booking Rejected',
          message: `Visitor pre-booking for ${preBooking.fullName} has been rejected.`,
          preBookingId: preBooking._id,
          companyId: preBooking.companyId || 'FIC001',
          branchId: preBooking.branchLocation,
          recipients: [
            ...superAdmins.map(admin => admin._id.toString()),
            preBooking.assignedHr ? preBooking.assignedHr.toString() : null
          ].filter(Boolean)
        });
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
    const records = await PreBooking.find({ qrToken: { $in: [null, undefined, ''] } });
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

    const isValidObjectId = require('mongoose').isValidObjectId(rawId);
    const searchRegex = new RegExp(`^${rawId.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}$`, 'i');

    const pb = await PreBooking.findOne({
      $or: [
        { visitorId: searchRegex },
        { visitorId: rawId.toUpperCase() },
        { mobileNumber: rawId },
        { qrToken: rawId },
        ...(isValidObjectId ? [{ _id: rawId }] : [])
      ]
    }).populate("assignedHr");

    if (!pb) {
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

    const searchRegex = new RegExp(`^${token.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}$`, 'i');
    const isValidObjectId = require('mongoose').isValidObjectId(token);

    const pb = await PreBooking.findOne({
      $or: [
        { qrToken: token },
        { qrToken: searchRegex },
        { visitorId: token.toUpperCase() },
        { visitorId: searchRegex },
        ...(isValidObjectId ? [{ _id: token }] : [])
      ]
    }).populate("assignedHr");

    if (!pb) {
      return res.status(404).json({
        success: false,
        message: "Visitor not found for scanned QR code.",
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
    await PreBooking.findByIdAndDelete(id);
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
      $or: [
        { visitorId: searchRegex },
        { visitorId: rawId.toUpperCase() },
        { mobileNumber: rawId },
        { qrToken: rawId },
        ...(isValidObjectId ? [{ _id: rawId }] : [])
      ]
    });

    if (!preBooking) {
      return res.status(404).json({
        success: false,
        message: "Visitor not found."
      });
    }

    if (req.userRole !== "Security") {
      return res.status(403).json({
        success: false,
        message: "Only Security can check in this visitor"
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
    preBooking.checkInBy = req.user?.fullName || req.user?.name || "Security";

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

      const notificationDocs = recipientIds.map(id => ({
        companyId: preBooking.companyId || 'FIC001',
        branchId: preBooking.branchLocation,
        recipient: id,
        type: "PREBOOKING_CHECKED_IN",
        title: "Pre-Booking Checked In",
        message: `Visitor ${preBooking.fullName} has checked in.`,
        preBookingId: preBooking._id,
        createdBy: req.user?.fullName || "Security"
      }));

      if (notificationDocs.length > 0) {
        await Notification.insertMany(notificationDocs);
      }

      const io = req.app.get('io');
      if (io) {
        io.emit('new_notification', {
          _id: 'notif_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
          createdAt: new Date().toISOString(),
          type: 'PREBOOKING_CHECKED_IN',
          title: 'Pre-Booking Checked In',
          message: `Visitor ${preBooking.fullName} has checked in.`,
          preBookingId: preBooking._id,
          companyId: preBooking.companyId || 'FIC001',
          branchId: preBooking.branchLocation,
          recipients: recipientIds
        });
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
      $or: [
        { visitorId: searchRegex },
        { visitorId: rawId.toUpperCase() },
        { mobileNumber: rawId },
        { qrToken: rawId },
        ...(isValidObjectId ? [{ _id: rawId }] : [])
      ]
    });

    if (!preBooking) {
      return res.status(404).json({
        success: false,
        message: "Visitor not found."
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
    preBooking.checkOutBy = req.user?.fullName || req.user?.name || "Security";
    preBooking.checkOutNotes = notes;
    preBooking.exitNotes = notes;

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

      const notificationDocs = recipientIds.map(id => ({
        companyId: preBooking.companyId || 'FIC001',
        branchId: preBooking.branchLocation,
        recipient: id,
        type: "PREBOOKING_CHECKED_OUT",
        title: "Pre-Booking Checked Out",
        message: `Visitor ${preBooking.fullName} has checked out.`,
        preBookingId: preBooking._id,
        createdBy: req.user?.fullName || "Security"
      }));

      if (notificationDocs.length > 0) {
        await Notification.insertMany(notificationDocs);
      }

      const io = req.app.get('io');
      if (io) {
        io.emit('new_notification', {
          _id: 'notif_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
          createdAt: new Date().toISOString(),
          type: 'PREBOOKING_CHECKED_OUT',
          title: 'Pre-Booking Checked Out',
          message: `Visitor ${preBooking.fullName} has checked out.`,
          preBookingId: preBooking._id,
          companyId: preBooking.companyId || 'FIC001',
          branchId: preBooking.branchLocation,
          recipients: recipientIds
        });
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
    const visitors = await PreBooking.find({
      assignedHr: req.userId
    })
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
    if (req.userRole !== "Super Admin" && req.userRole !== "SaaS Super Admin") {
      return res.status(403).json({
        success: false,
        message: "Only Super Admin can access pre-booking reports"
      });
    }

    const reports = await PreBooking.find({})
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

module.exports = {
  createPreBooking,
  getAllPreBookings,
  approvePreBooking,
  rejectPreBooking,
  getPreBookingByVisitId,
  getPreBookingByQR,
  deletePreBooking,
  clearAllPreBookings,
  checkInPreBooking,
  checkOutPreBooking,
  backfillQrTokens,
  getMyPreBookings,
  getPreBookingReports,
};
