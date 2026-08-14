const express = require("express");
const {
  createInvitation,
  getInvitationByToken,
  getInvitationQR
} = require("../controllers/visitorInvitationController");

const router = express.Router();

// Create invitation
router.post("/", createInvitation);

// Get QR Code
router.get("/qr/:token", getInvitationQR);

// Get invitation using QR/link token
router.get("/:token", getInvitationByToken);

module.exports = router;
