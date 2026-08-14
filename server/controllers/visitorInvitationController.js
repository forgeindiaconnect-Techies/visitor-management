const crypto = require("crypto");
const QRCode = require("qrcode");
const Invitation = require("../models/Invitation");
const { sendVisitorInvitationEmail } = require("../utils/emailService");

const createInvitation = async (req, res) => {
  try {
    const {
      visitorName,
      email,
      mobile,
      companyName,
      purposeOfVisit,
      visitDate,
      visitTime,
      branch,
      numberOfVisitors,
      notes
    } = req.body;

    // 1. Validate required fields
    if (
      !visitorName ||
      !email ||
      !visitDate ||
      !visitTime ||
      !branch
    ) {
      return res.status(400).json({
        success: false,
        message: "Required visitor details are missing",
      });
    }

    // 2. Generate secure random token
    const rawToken = crypto.randomBytes(32).toString("hex");

    // 3. Hash token before storing in database
    const tokenHash = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    // 4. Invitation expiry - 24 hours
    const expiresAt = new Date(
      Date.now() + 24 * 60 * 60 * 1000
    );

    // 5. Save invitation
    const invitation = await Invitation.create({
      visitorName,
      email,
      mobile,
      companyName,
      purposeOfVisit,
      visitDate,
      visitTime,
      branch,
      numberOfVisitors: numberOfVisitors || 1,
      notes,
      tokenHash,
      expiresAt,
      status: "PENDING",
      used: false,
    });

    // 6. Create visitor invitation URL
    const frontendUrl =
      process.env.FRONTEND_URL || "http://localhost:5173";
    const backendUrl =
      process.env.BACKEND_URL || "http://localhost:5000";

    const invitationUrl =
      `${frontendUrl}/visitor-invitation/${rawToken}`;
    const qrUrl =
      `${backendUrl}/api/visitor-invitations/qr/${rawToken}`;

    // 7. Generate QR code
    const qrCode = await QRCode.toDataURL(invitationUrl);

    // 7.5 Send Email
    await sendVisitorInvitationEmail({
      visitorName,
      email,
      companyName,
      purposeOfVisit,
      visitDate,
      visitTime,
      branch,
      numberOfVisitors: numberOfVisitors || 1,
      qrUrl,
      invitationUrl
    });

    // 8. Send response
    return res.status(201).json({
      success: true,
      message: "Invitation created successfully",

      invitation: {
        id: invitation._id,
        visitorName: invitation.visitorName,
        email: invitation.email,
        status: invitation.status,
        expiresAt: invitation.expiresAt,
      },

      invitationUrl,
      qrCode,
    });

  } catch (error) {
    console.error("Create invitation error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create invitation",
      error: error.message,
    });
  }
};

const getInvitationByToken = async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Invitation token is required",
      });
    }

    // Hash the token received from the QR/link
    const tokenHash = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    // Find invitation
    const invitation = await Invitation.findOne({
      tokenHash,
    });

    if (!invitation) {
      return res.status(404).json({
        success: false,
        message: "Invalid invitation link",
      });
    }

    // Check expiry
    if (new Date() > invitation.expiresAt) {
      invitation.status = "EXPIRED";
      await invitation.save();

      return res.status(410).json({
        success: false,
        message: "This invitation has expired",
      });
    }

    // Return only the information that the visitor is allowed to see
    return res.status(200).json({
      success: true,
      invitation: {
        visitorName: invitation.visitorName,
        email: invitation.email,
        mobile: invitation.mobile,
        companyName: invitation.companyName,
        purposeOfVisit: invitation.purposeOfVisit,
        visitDate: invitation.visitDate,
        visitTime: invitation.visitTime,
        branch: invitation.branch,
        numberOfVisitors: invitation.numberOfVisitors,
        notes: invitation.notes,
        status: invitation.status,
        expiresAt: invitation.expiresAt,
      },
    });

  } catch (error) {
    console.error("Get invitation error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load invitation",
    });
  }
};

const getInvitationQR = async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Invitation token is required",
      });
    }

    const frontendUrl =
      process.env.FRONTEND_URL || "http://localhost:5173";

    const invitationUrl =
      `${frontendUrl}/visitor-invitation/${token}`;

    const qrBuffer = await QRCode.toBuffer(invitationUrl, {
      type: "png",
      width: 400,
      margin: 2,
    });

    res.setHeader("Content-Type", "image/png");
    res.send(qrBuffer);
  } catch (error) {
    console.error("QR generation error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to generate QR code",
    });
  }
};

module.exports = {
  createInvitation,
  getInvitationByToken,
  getInvitationQR
};
