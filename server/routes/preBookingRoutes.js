const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");

const {
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
  createAndSendVisitorInvitation,
} = require("../controllers/preBookingController");

const router = express.Router();

// Check returning visitor by mobile number
router.get(
  "/returning-visitor/:mobile",
  getReturningVisitor
);

// Validate Company Pre-Booking Link & Subscription Status
router.get("/validate/:companyId", async (req, res) => {
  try {
    const Company = require("../models/Company");
    const targetId = (req.params.companyId || "").trim().toUpperCase();
    const company = await Company.findOne({ code: targetId }).select("code name status subscription subscriptionExpiresAt branding features");

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "This pre-booking link is invalid or unavailable. Company is not registered."
      });
    }

    if (company.status !== "Active") {
      return res.status(403).json({
        success: false,
        message: "Company account is currently inactive. Please contact the administrator."
      });
    }

    if (company.subscriptionExpiresAt && new Date(company.subscriptionExpiresAt) < new Date()) {
      return res.status(403).json({
        success: false,
        message: "Company subscription has expired. Pre-booking is unavailable."
      });
    }

    if (company.features && company.features.preBookingEnabled === false) {
      return res.status(403).json({
        success: false,
        message: "Pre-booking is unavailable for this plan. Please contact the administrator."
      });
    }

    // 1. Fetch only this company's active hosts/employees (exclude Security & Visitor roles)
    const User = require("../models/User");
    const BranchSetting = require("../models/BranchSetting");

    const companyUsers = await User.find({
      companyId: company.code,
      status: "Active",
      role: { $nin: ["Security", "Visitor"] }
    }).select("_id name role department email");

    const hosts = companyUsers.map(u => ({
      id: u._id,
      name: u.name,
      role: u.role,
      label: `${u.name} (${u.role || 'Host'})`
    }));

    // Always include Direct Visit option
    hosts.push({
      id: null,
      name: "Direct Visits",
      role: "General",
      label: "Direct Visits"
    });

    // 2. Fetch only this company's branches
    const companyBranches = await BranchSetting.find({
      companyId: company.code
    }).select("branchName location");

    let branches = companyBranches.map(b => b.branchName || b.location).filter(Boolean);
    if (branches.length === 0) {
      branches = [`${company.name} - Main Office`];
    }

    return res.json({
      success: true,
      company: {
        companyId: company.code,
        companyName: company.name,
        subscription: company.subscription,
        branding: company.branding,
        hosts,
        branches
      }
    });
  } catch (error) {
    console.error("Company pre-booking validation error:", error);
    return res.status(500).json({ success: false, message: "Unable to validate company" });
  }
});

// Get pre-bookings assigned to logged-in user (e.g. HR)
router.get("/my", authMiddleware, getMyPreBookings);

// Get Pre-Bookings report (Super Admin only)
router.get("/reports", authMiddleware, getPreBookingReports);

// Create Pre-Booking
router.post("/", authMiddleware, createPreBooking);

// Get all Pre-Bookings
router.get("/", authMiddleware, getAllPreBookings);

// Get single Pre-Booking by visitorId / visitId
router.get("/visitor/:visitorId", getPreBookingByVisitId);

// Get single Pre-Booking by QR token
router.get("/qr/:token", getPreBookingByQR);

// Super Admin creates an approved visitor pass and sends email
router.post(
  '/admin/send-invitation',
  authMiddleware,
  createAndSendVisitorInvitation
);

// Check-In Pre-Booking
router.put("/visitor/:visitorId/check-in", checkInPreBooking);
router.post("/visitor/:visitorId/check-in", checkInPreBooking);
router.post("/:id/check-in", checkInPreBooking);

// Check-Out Pre-Booking (Requires checkOutNotes)
router.put("/visitor/:visitorId/check-out", checkOutPreBooking);
router.post("/visitor/:visitorId/check-out", checkOutPreBooking);
router.post("/:id/check-out", checkOutPreBooking);

// Approve Pre-Booking
router.put("/:id/approve", authMiddleware, approvePreBooking);

// Re-Approve rejected Pre-Booking
router.put("/:id/reapprove", authMiddleware, reApprovePreBooking);
router.patch("/:id/reapprove", authMiddleware, reApprovePreBooking);

// Reject Pre-Booking
router.put("/:id/reject", authMiddleware, rejectPreBooking);

// Reschedule Pre-Booking
router.put("/:id/reschedule", authMiddleware, reschedulePreBooking);
router.patch("/:id/reschedule", authMiddleware, reschedulePreBooking);

// Update Pre-Booking details
router.put("/:id", authMiddleware, updatePreBooking);
router.patch("/:id", authMiddleware, updatePreBooking);

// Cleanup duplicate notifications (Temporary GET route for easy one-off execution)


// Clear all Pre-Bookings (must come before /:id)
router.delete("/clear/all", clearAllPreBookings);

// Delete single Pre-Booking
router.delete("/:id", authMiddleware, deletePreBooking);

module.exports = router;


