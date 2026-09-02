const express = require('express');
const router = express.Router();
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');
const SaasLead = require('../models/SaasLead');
const Company = require('../models/Company');
const User = require('../models/User');
const Notification = require('../models/Notification');
const authMiddleware = require('../middleware/authMiddleware');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'fic-vms/saas-leads',
    allowed_formats: ['png', 'jpg', 'jpeg', 'webp']
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 2 * 1024 * 1024 } 
});

// Public route: Register a new SaaS lead
router.post('/register', upload.single('companyLogo'), async (req, res) => {
  try {
    const { companyName, contactPerson, email, mobileNumber, expectedBranches, expectedEmployees, message } = req.body;

    // Basic validation
    if (!companyName || !contactPerson || !email || !mobileNumber) {
      return res.status(400).json({ success: false, message: 'Required fields are missing' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedMobile = String(mobileNumber).replace(/\D/g, '');

    // Check if lead already exists with this email or mobile and is not Lost/Won
    const existingLead = await SaasLead.findOne({ 
      status: { $nin: ['Won', 'Lost'] },
      $or: [
        { email: normalizedEmail },
        { mobileNumber: normalizedMobile }
      ]
    });

    if (existingLead) {
      return res.status(409).json({ success: false, message: 'Your company registration is already under review' });
    }

    let logoUrl = '';
    if (req.file && req.file.path) {
      logoUrl = req.file.path;
    }

    // Save lead
    const lead = await SaasLead.create({
      companyName: companyName.trim(),
      contactPerson: contactPerson.trim(),
      email: normalizedEmail,
      mobileNumber: normalizedMobile,
      expectedBranches: expectedBranches || 1,
      expectedEmployees: expectedEmployees || 1,
      message: message || '',
      logoUrl: logoUrl,
      status: 'New'
    });

    // Notify SaaS admins via socket
    const io = req.app.get('io');
    
    // Create Notification
    const notification = await Notification.create({
      eventId: `SAAS_LEAD_${lead._id}`,
      companyId: 'SYSTEM',
      type: 'SAAS_LEAD_CREATED',
      module: 'SaaS',
      title: 'New Company Registration',
      message: `${lead.companyName} registered through the SaaS landing page.`,
      createdBy: lead.contactPerson,
      roles: ['SaaS Super Admin']
    });

    if (io) {
      io.to('saas-admins').emit('new_saas_lead', lead);
      io.to('company:SYSTEM').emit('new_saas_lead', lead);
      io.to('saas-admins').emit('new_notification', notification);
    }

    res.status(201).json({ success: true, message: 'Registration submitted successfully. Our team will contact you shortly.', data: lead });
  } catch (error) {
    console.error('Lead registration error:', error);
    res.status(500).json({ success: false, message: 'Failed to submit registration' });
  }
});

// Middleware for SaaS Super Admin routes
router.use(authMiddleware);
router.use((req, res, next) => {
  if (req.userRole !== 'SaaS Super Admin') {
    return res.status(403).json({ success: false, message: 'Forbidden: SaaS Super Admin access required' });
  }
  next();
});

// GET all leads
router.get('/', async (req, res) => {
  try {
    const leads = await SaasLead.find().sort({ createdAt: -1 });
    res.json({ success: true, data: leads });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PATCH update lead status
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const lead = await SaasLead.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });
    res.json({ success: true, lead });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST convert lead to company
router.post('/:leadId/convert', async (req, res) => {
  try {
    if (req.userRole !== 'SaaS Super Admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const lead = await SaasLead.findById(req.params.leadId);

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: 'Lead not found'
      });
    }

    if (lead.status !== 'Won') {
      return res.status(400).json({
        success: false,
        message: 'Complete the deal before creating the dashboard'
      });
    }

    if (lead.convertedCompanyId) {
      return res.status(409).json({
        success: false,
        message: 'This lead has already been converted'
      });
    }

    const prefix = lead.companyName
      .replace(/[^a-zA-Z]/g, '')
      .slice(0, 3)
      .toUpperCase()
      .padEnd(3, 'X');

    let companyCode = `${prefix}123`;
    if (await Company.exists({ code: companyCode })) {
      do {
        companyCode = `${prefix}${Math.floor(100 + Math.random() * 900)}`;
      } while (await Company.exists({ code: companyCode }));
    }

    const subscription = req.body.subscription || req.body.plan || 'Standard';
    
    // Support either old durationDays or new subscriptionExpiresAt
    let subscriptionExpiresAt;
    if (req.body.subscriptionExpiresAt) {
      subscriptionExpiresAt = new Date(req.body.subscriptionExpiresAt);
    } else {
      subscriptionExpiresAt = new Date();
      subscriptionExpiresAt.setDate(subscriptionExpiresAt.getDate() + (parseInt(req.body.durationDays, 10) || 30));
    }

    if (Number.isNaN(subscriptionExpiresAt.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Valid subscription expiry date is required'
      });
    }

    const logoUrl = req.body.logoUrl || lead.logoUrl || '';
    const primaryColor = req.body.primaryColor || '#1E1B6E';
    const initialBranchName = req.body.initialBranch?.trim() || 'Main Branch';

    const company = await Company.create({
      name: lead.companyName,
      code: companyCode,
      subscription,
      subscriptionExpiresAt,
      status: 'Active',
      createdBy: req.userId || 'SaaS Conversion',
      branding: {
        logoUrl: logoUrl,
        primaryColor: primaryColor
      }
    });

    // Create Initial BranchSetting for this Company
    const BranchSetting = require('../models/BranchSetting');
    await BranchSetting.create({
      companyId: company.code,
      branchName: initialBranchName,
      latitude: 12.9716,
      longitude: 77.5946,
      radius: 50
    }).catch(err => console.warn('Initial BranchSetting creation note:', err.message));

    const crypto = require('crypto');
    const activationToken = crypto.randomBytes(32).toString('hex');
    const activationTokenHash = crypto.createHash('sha256').update(activationToken).digest('hex');
    
    const temporaryPassword = crypto.randomBytes(32).toString('hex');
    const bcrypt = require('bcrypt');
    const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

    const superAdmin = await User.create({
      name: lead.contactPerson,
      email: lead.email,
      mobileNumber: lead.mobileNumber,
      role: 'Super Admin',
      companyId: company.code,
      branch: initialBranchName,
      branchId: initialBranchName,
      status: 'Active',
      password: hashedPassword,
      passwordSetupTokenHash: activationTokenHash,
      passwordSetupExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      mustSetPassword: true
    });

    lead.convertedCompanyId = company._id;
    await lead.save();

    const frontendUrl = String(process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '');
    const activationUrl = `${frontendUrl}/activate-account/${activationToken}`;

    // Send the account activation email
    const { sendCompanyActivationEmail } = require('../utils/emailService');
    const emailSent = await sendCompanyActivationEmail({
      recipientName: superAdmin.name,
      email: superAdmin.email,
      companyName: company.name,
      companyCode: company.code,
      subscription: company.subscription,
      activationUrl
    });

    return res.status(201).json({
      success: true,
      message: emailSent
        ? 'Company dashboard created and activation email sent'
        : 'Company dashboard created, but activation email failed',
      emailSent,
      data: {
        company,
        superAdmin: {
          id: superAdmin._id,
          name: superAdmin.name,
          email: superAdmin.email,
          role: superAdmin.role
        }
      }
    });
  } catch (error) {
    console.error('Lead conversion failed:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Unable to create company dashboard'
    });
  }
});

// Send Email and Update Communication History
router.post(
  '/:leadId/send-email',
  authMiddleware,
  async (req, res) => {
    try {
      if (req.userRole !== 'SaaS Super Admin') {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      const { subject, message } = req.body;

      if (!subject?.trim() || !message?.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Subject and message are required'
        });
      }

      const lead = await SaasLead.findById(
        req.params.leadId
      );

      if (!lead) {
        return res.status(404).json({
          success: false,
          message: 'Registration not found'
        });
      }

      const safeMessage = message
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br/>');

      const htmlBody = `
        <div style="background:#f1f5f9;padding:30px;font-family:Arial,sans-serif;">
          <div style="max-width:600px;margin:auto;background:#ffffff;border-radius:14px;overflow:hidden;">
            <div style="background:#1e1b6e;color:#ffffff;padding:24px;text-align:center;">
              <h2 style="margin:0;">FIC Visitor Management System</h2>
            </div>

            <div style="padding:30px;">
              <p>Hello <strong>${lead.contactPerson}</strong>,</p>

              <p style="line-height:1.7;color:#475569;">
                ${safeMessage}
              </p>

              <p style="margin-top:28px;">
                Regards,<br/>
                <strong>ForgeIndiaConnect</strong>
              </p>
            </div>

            <div style="background:#0f172a;color:#cbd5e1;padding:16px;text-align:center;font-size:12px;">
              <a
                href="https://forgeindiaconnect.com/"
                style="color:#ffffff;"
              >
                forgeindiaconnect.com
              </a>
            </div>
          </div>
        </div>
      `;

      const { sendEmail } = require('../utils/emailService');
      const emailSent = await sendEmail(
        lead.email,
        subject.trim(),
        htmlBody
      );

      if (!emailSent) {
        return res.status(502).json({
          success: false,
          message: 'Brevo could not deliver the email'
        });
      }

      lead.communicationHistory.push({
        subject: subject.trim(),
        message: message.trim(),
        sentAt: new Date(),
        sentBy: req.userName || 'SaaS Super Admin'
      });

      lead.lastContactedAt = new Date();

      if (lead.status === 'New') {
        lead.status = 'Contacted';
      }

      await lead.save();

      return res.json({
        success: true,
        message: 'Email sent successfully',
        data: lead
      });
    } catch (error) {
      console.error('Lead email failed:', error);

      return res.status(500).json({
        success: false,
        message: 'Unable to send email'
      });
    }
  }
);
router.put(
  '/:leadId/follow-up',
  authMiddleware,
  async (req, res) => {
    try {
      if (req.userRole !== 'SaaS Super Admin') {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      const { notes, followUpAt } = req.body;

      const lead = await SaasLead.findById(
        req.params.leadId
      );

      if (!lead) {
        return res.status(404).json({
          success: false,
          message: 'Registration not found'
        });
      }

      lead.notes = notes?.trim() || '';

      if (followUpAt) {
        const followUpDate = new Date(followUpAt);

        if (Number.isNaN(followUpDate.getTime())) {
          return res.status(400).json({
            success: false,
            message: 'Invalid follow-up date'
          });
        }

        lead.followUpAt = followUpDate;
      } else {
        lead.followUpAt = null;
      }

      await lead.save();

      const io = req.app.get('io');

      if (io) {
        io.to('saas-admins').emit(
          'saas_lead_updated',
          lead
        );
      }

      return res.json({
        success: true,
        message: 'Notes and follow-up updated',
        data: lead
      });
    } catch (error) {
      console.error('Follow-up update failed:', error);

      return res.status(500).json({
        success: false,
        message: 'Unable to update follow-up'
      });
    }
  }
);

module.exports = router;
