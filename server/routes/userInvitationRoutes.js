const express = require('express');
const crypto = require('crypto');

const router = express.Router();

const authMiddleware =
  require('../middleware/authMiddleware');

const UserInvitation =
  require('../models/UserInvitation');

const User = require('../models/User');
const Company = require('../models/Company');
const BranchSetting =
  require('../models/BranchSetting');

const {
  sendEmail
} = require('../utils/emailService');

router.post(
  '/activate/:token',
  async (req, res) => {
    try {
      const {
        password,
        confirmPassword
      } = req.body;

      if (!password || password.length < 8) {
        return res.status(400).json({
          success: false,
          message: 'Password must contain at least 8 characters'
        });
      }

      if (password !== confirmPassword) {
        return res.status(400).json({
          success: false,
          message: 'Passwords do not match'
        });
      }

      const tokenHash = crypto
        .createHash('sha256')
        .update(req.params.token)
        .digest('hex');

      const invitation =
        await UserInvitation.findOne({
          tokenHash,
          used: false,
          expiresAt: {
            $gt: new Date()
          }
        });

      if (!invitation) {
        return res.status(400).json({
          success: false,
          message: 'Invitation link is invalid, expired or already used'
        });
      }

      const existingUser = await User.findOne({
        companyId: invitation.companyId,
        email: invitation.email
      });

      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'This employee account already exists'
        });
      }

      const user = await User.create({
        name: invitation.name,
        email: invitation.email,
        password,
        role: invitation.role,
        companyId: invitation.companyId,
        branch: invitation.branch,
        department: invitation.department,
        status: 'Active'
      });

      invitation.used = true;
      await invitation.save();

      return res.status(201).json({
        success: true,
        message: 'Account activated successfully. You can now log in.',
        data: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          companyId: user.companyId
        }
      });
    } catch (error) {
      console.error(
        'Employee activation failed:',
        error
      );

      return res.status(500).json({
        success: false,
        message: 'Unable to activate employee account'
      });
    }
  }
);

router.post(
  '/',
  authMiddleware,
  async (req, res) => {
    try {
      const allowedInviters = [
        'Super Admin',
        'Admin'
      ];

      if (!allowedInviters.includes(req.userRole)) {
        return res.status(403).json({
          success: false,
          message: 'You cannot invite users'
        });
      }

      const {
        name,
        email,
        role,
        branch,
        department
      } = req.body;

      if (!name || !email || !role || !branch) {
        return res.status(400).json({
          success: false,
          message: 'Please complete all required fields'
        });
      }

      const normalizedEmail =
        email.trim().toLowerCase();

      const existingUser = await User.findOne({
        companyId: req.companyId,
        email: normalizedEmail
      });

      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'This user already exists'
        });
      }

      const validBranch =
        await BranchSetting.findOne({
          companyId: req.companyId,
          branchName: branch
        });

      if (!validBranch) {
        return res.status(400).json({
          success: false,
          message: 'Selected branch is invalid'
        });
      }

      await UserInvitation.deleteMany({
        companyId: req.companyId,
        email: normalizedEmail,
        used: false
      });

      const rawToken = crypto
        .randomBytes(32)
        .toString('hex');

      const tokenHash = crypto
        .createHash('sha256')
        .update(rawToken)
        .digest('hex');

      const invitation =
        await UserInvitation.create({
          companyId: req.companyId,
          name: name.trim(),
          email: normalizedEmail,
          role,
          branch,
          department: department || '',
          tokenHash,
          expiresAt: new Date(
            Date.now() + 24 * 60 * 60 * 1000
          ),
          invitedBy: req.userId
        });

      const company = await Company.findOne({
        code: req.companyId
      });

      const frontendUrl = String(
        process.env.FRONTEND_URL || 'https://visitor-management-indol.vercel.app'
      ).replace(/\/+$/, '');

      const activationUrl =
        `${frontendUrl}/employee-activate/${rawToken}`;

      const emailSent = await sendEmail(
        invitation.email,
        `${company?.name || 'Company'} – Employee Account Invitation`,
        `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;">
            <h2>${company?.name || 'Company'}</h2>

            <p>Hello <strong>${invitation.name}</strong>,</p>

            <p>
              You have been invited to join the company
              Visitor Management System.
            </p>

            <p><strong>Role:</strong> ${invitation.role}</p>
            <p><strong>Branch:</strong> ${invitation.branch}</p>

            <div style="margin:30px 0;text-align:center;">
              <a
                href="${activationUrl}"
                style="background:#4f46e5;color:#ffffff;padding:14px 26px;border-radius:8px;text-decoration:none;"
              >
                Create Your Password
              </a>
            </div>

            <p>
              This link expires in 24 hours and can be used only once.
            </p>

            <p>
              Powered by
              <a href="https://forgeindiaconnect.com/">
                ForgeIndiaConnect
              </a>
            </p>
          </div>
        `
      );

      if (!emailSent) {
        await UserInvitation.findByIdAndDelete(
          invitation._id
        );

        return res.status(502).json({
          success: false,
          message: 'Invitation email could not be delivered'
        });
      }

      return res.status(201).json({
        success: true,
        message: 'Employee invitation sent successfully'
      });
    } catch (error) {
      console.error(
        'Employee invitation failed:',
        error
      );

      return res.status(500).json({
        success: false,
        message: 'Unable to send employee invitation'
      });
    }
  }
);

// List invitations for the logged-in company
router.get('/', authMiddleware, async (req, res) => {
  try {
    if (!['Super Admin', 'Admin'].includes(req.userRole)) {
      return res.status(403).json({
        message: 'Only Super Admin or Admin can view invitations.'
      });
    }

    const invitations = await UserInvitation.find({
      companyId: req.companyId
    })
      .select('-tokenHash')
      .sort({ createdAt: -1 })
      .lean();

    const data = invitations.map((invitation) => ({
      ...invitation,
      invitationStatus: invitation.used
        ? 'Activated'
        : new Date(invitation.expiresAt) <= new Date()
          ? 'Expired'
          : 'Pending'
    }));

    return res.json({ success: true, data });
  } catch (error) {
    console.error('Fetch invitations error:', error);
    return res.status(500).json({
      message: 'Unable to fetch invitations.'
    });
  }
});

// Revoke a pending invitation
router.delete('/:invitationId', authMiddleware, async (req, res) => {
  try {
    if (!['Super Admin', 'Admin'].includes(req.userRole)) {
      return res.status(403).json({
        message: 'Only Super Admin or Admin can revoke invitations.'
      });
    }

    const invitation = await UserInvitation.findOneAndDelete({
      _id: req.params.invitationId,
      companyId: req.companyId,
      used: false
    });

    if (!invitation) {
      return res.status(404).json({
        message: 'Pending invitation not found.'
      });
    }

    return res.json({
      success: true,
      message: 'Invitation revoked successfully.'
    });
  } catch (error) {
    console.error('Revoke invitation error:', error);
    return res.status(500).json({
      message: 'Unable to revoke invitation.'
    });
  }
});

module.exports = router;
