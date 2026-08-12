const express = require("express");

const {
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
} = require("../controllers/preBookingController");

const router = express.Router();

// Create Pre-Booking
router.post("/", createPreBooking);

// Get all Pre-Bookings
router.get("/", getAllPreBookings);

// Get single Pre-Booking by visitorId / visitId
router.get("/visitor/:visitorId", getPreBookingByVisitId);
router.get("/visitor/:visitId", getPreBookingByVisitId);

// Get single Pre-Booking by QR token
router.get("/qr/:token", getPreBookingByQR);

// Check-In Pre-Booking
router.put("/visitor/:visitorId/check-in", checkInPreBooking);
router.post("/visitor/:visitorId/check-in", checkInPreBooking);
router.post("/:id/check-in", checkInPreBooking);

// Check-Out Pre-Booking (Requires checkOutNotes)
router.put("/visitor/:visitorId/check-out", checkOutPreBooking);
router.post("/visitor/:visitorId/check-out", checkOutPreBooking);
router.post("/:id/check-out", checkOutPreBooking);

// Approve Pre-Booking
router.put("/:id/approve", approvePreBooking);

// Reject Pre-Booking
router.put("/:id/reject", rejectPreBooking);

// Clear all Pre-Bookings (must come before /:id)
router.delete("/clear/all", clearAllPreBookings);

// Delete single Pre-Booking
router.delete("/:id", deletePreBooking);

module.exports = router;
