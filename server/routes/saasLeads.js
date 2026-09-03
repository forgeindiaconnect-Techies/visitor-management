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
const { calculateSubscriptionCycle } = require('../services/subscriptionCycleService');
const planLimits = require('../config/plans');

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

const requireSaasSuperAdmin = (
  req,
  res,
  next
) => {
  const role =
    req.user?.role ||
    req.userRole ||
    '';

  const normalizedRole = String(role)
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');

  if (normalizedRole !== 'SAAS_SUPER_ADMIN') {
    return res.status(403).json({
      success: false,
      message:
        'Only SaaS Super Admin can perform this action.'
    });
  }

  next();
};

// Public route: Register a new SaaS lead
router.post('/register', upload.single('companyLogo'), async (req, res) => {
  try {
    const {
      companyName,
      contactPerson,
      email,
      mobileNumber,
      requestedPlan = 'One Day Trial',
      message
    } = req.body;

    // Basic validation
    if (!companyName || !contactPerson || !email || !mobileNumber) {
      return res.status(400).json({ success: false, message: 'Required fields are missing' });
    }

    const selectedPlan = String(requestedPlan).trim();

    const allowedPlans = [
      'One Day Trial',
      'Basic',
      'Standard',
      'Enterprise'
    ];

    if (
      !allowedPlans.includes(selectedPlan) ||
      !planLimits[selectedPlan]
    ) {
      return res.status(400).json({
        success: false,
        message: 'Please select a valid subscription plan.'
      });
    }

    const paymentStatus =
      selectedPlan === 'One Day Trial'
        ? 'Not Required'
        : 'Pending';

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
      requestedPlan: selectedPlan,
      paymentStatus,
      message: message || '',
      logoUrl,
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
      message: `${lead.companyName} requested the ${lead.requestedPlan} plan through the SaaS landing page.`,
      createdBy: lead.contactPerson,
      roles: ['SaaS Super Admin']
    });

    if (io) {
      io.to('saas-admins').emit('new_saas_lead', lead);
      io.to('company:SYSTEM').emit('new_saas_lead', lead);
      io.to('saas-admins').emit('new_notification', notification);
    }

    // Send instant registration confirmation email to lead applicant
    const { sendEmail } = require('../utils/emailService');
    sendEmail(
      normalizedEmail,
      `Registration Received - ${companyName.trim()}`,
      `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
          <div style="background-color: #1E1B6E; color: white; padding: 24px; text-align: center;">
            <h2 style="margin: 0;">Registration Received</h2>
          </div>
          <div style="padding: 24px; color: #334155;">
            <p>Hello <strong>${contactPerson.trim()}</strong>,</p>
            <p>Thank you for registering <strong>${companyName.trim()}</strong> for Zone Monitor Visitor Management System.</p>
            <p>
              <strong>Requested Plan:</strong>
              ${selectedPlan}
            </p>

            <p>
              <strong>Validity:</strong>
              ${planLimits[selectedPlan].durationDays === 1
                ? '24 hours'
                : `${planLimits[selectedPlan].durationDays} days`}
            </p>

            <p>
              <strong>Visitor Passes:</strong>
              ${planLimits[selectedPlan].visitorPasses === -1
                ? 'Unlimited'
                : planLimits[selectedPlan].visitorPasses}
            </p>

            <p>
              <strong>Branches:</strong>
              ${planLimits[selectedPlan].branches === -1
                ? 'Unlimited'
                : planLimits[selectedPlan].branches}
            </p>

            <p>
              <strong>System Users:</strong>
              ${planLimits[selectedPlan].users === -1
                ? 'Unlimited'
                : planLimits[selectedPlan].users}
            </p>

            <p>Our sales & onboarding team is reviewing your registration and will contact you shortly to schedule a demo and set up your workspace.</p>
            <p style="font-size: 12px; color: #64748b; margin-top: 24px;">Powered by ForgeIndiaConnect</p>
          </div>
        </div>
      `
    ).catch(err => console.warn('Lead confirmation email failed:', err.message));

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
router.patch(
  '/:id/status',
  authMiddleware,
  requireSaasSuperAdmin,
  async (req, res) => {
    try {
      const { status } = req.body;

      const allowedStatuses = [
        'New',
        'Contacted',
        'Demo Scheduled',
        'Negotiation',
        'Won',
        'Lost'
      ];

      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid lead status.'
        });
      }

      const lead =
        await SaasLead.findByIdAndUpdate(
          req.params.id,
          {
            $set: {
              status
            }
          },
          {
            new: true,
            runValidators: true
          }
        );

      if (!lead) {
        return res.status(404).json({
          success: false,
          message: 'Lead not found'
        });
      }

      const io = req.app.get('io');

      if (io) {
        io.to('saas-admins').emit(
          'saas_lead_updated',
          lead
        );
      }

      return res.json({
        success: true,
        message: 'Lead status updated.',
        lead
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
);

// PATCH update payment status
router.patch(
  '/:id/payment-status',
  authMiddleware,
  requireSaasSuperAdmin,
  async (req, res) => {
    try {
      const { paymentStatus } = req.body;

      const allowedPaymentStatuses = [
        'Pending',
        'Paid',
        'Failed',
        'Refunded',
        'Not Required'
      ];

      if (
        !allowedPaymentStatuses.includes(
          paymentStatus
        )
      ) {
        return res.status(400).json({
          success: false,
          message: 'Invalid payment status.'
        });
      }

      const lead =
        await SaasLead.findById(
          req.params.id
        );

      if (!lead) {
        return res.status(404).json({
          success: false,
          message: 'Lead not found.'
        });
      }

      const selectedPlan =
        lead.requestedPlan ||
        'One Day Trial';

      if (
        selectedPlan === 'One Day Trial' &&
        paymentStatus !== 'Not Required'
      ) {
        return res.status(400).json({
          success: false,
          message:
            'Payment is not required for the One Day Trial.'
        });
      }

      if (
        selectedPlan !== 'One Day Trial' &&
        paymentStatus === 'Not Required'
      ) {
        return res.status(400).json({
          success: false,
          message:
            'A paid plan cannot use Not Required payment status.'
        });
      }

      lead.paymentStatus = paymentStatus;
      await lead.save();

      const notification =
        await Notification.create({
          eventId:
            `SAAS_PAYMENT_${lead._id}_${Date.now()}`,

          companyId: 'SYSTEM',
          type:
            paymentStatus === 'Paid'
              ? 'success'
              : paymentStatus === 'Failed'
                ? 'error'
                : 'info',

          module: 'Subscription',

          title: 'Payment Status Updated',

          message:
            `${lead.companyName} — ${selectedPlan} payment changed to ${paymentStatus}.`,

          createdBy:
            req.user?.name ||
            req.userName ||
            'SaaS Super Admin',

          roles: ['SaaS Super Admin']
        });

      const io = req.app.get('io');

      if (io) {
        io.to('saas-admins').emit(
          'saas_lead_updated',
          lead
        );

        io.to('saas-admins').emit(
          'new_notification',
          notification
        );
      }

      return res.status(200).json({
        success: true,
        message:
          'Payment status updated successfully.',
        lead
      });
    } catch (error) {
      console.error(
        'Payment status update error:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          'Failed to update payment status.'
      });
    }
  }
);

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

    const subscription =
      lead.requestedPlan ||
      req.body.subscription ||
      req.body.plan ||
      'One Day Trial';

    const allowedPlans = [
      'One Day Trial',
      'Basic',
      'Standard',
      'Enterprise'
    ];

    if (!allowedPlans.includes(subscription)) {
      return res.status(400).json({
        success: false,
        message:
          'The client selected an invalid subscription plan.'
      });
    }

    const isTrial =
      subscription === 'One Day Trial';

    if (
      !isTrial &&
      lead.paymentStatus !== 'Paid'
    ) {
      return res.status(400).json({
        success: false,
        code: 'PAYMENT_REQUIRED',
        message:
          `${subscription} cannot be activated until payment is completed.`
      });
    }

    let subscriptionCycle;

    try {
      subscriptionCycle =
        calculateSubscriptionCycle(
          subscription,
          new Date()
        );
    } catch (cycleError) {
      return res
        .status(cycleError.statusCode || 400)
        .json({
          success: false,
          message: cycleError.message
        });
    }

    const logoUrl = lead.logoUrl || req.body.logoUrl || '';
    const primaryColor = req.body.primaryColor || '#1E1B6E';

    const company = await Company.create({
      name: lead.companyName,
      code: companyCode,
      subscription,

      subscriptionStartedAt:
        subscriptionCycle.subscriptionStartedAt,

      subscriptionExpiresAt:
        subscriptionCycle.subscriptionExpiresAt,

      status: 'Active',

      createdBy:
        req.userId || 'SaaS Conversion',

      branding: {
        logoUrl,
        primaryColor
      },

      upgradeHistory: [
        {
          plan: subscription,
          startDate:
            subscriptionCycle.subscriptionStartedAt,
          endDate:
            subscriptionCycle.subscriptionExpiresAt,
          updatedBy:
            req.userId || 'SaaS Conversion'
        }
      ]
    });

    const crypto = require('crypto');
    const activationToken = crypto.randomBytes(32).toString('hex');
    const activationTokenHash = crypto.createHash('sha256').update(activationToken).digest('hex');
    
    const temporaryPassword = crypto.randomBytes(32).toString('hex');
    const bcrypt = require('bcrypt');
    const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

    let superAdmin = await User.findOne({ email: lead.email });
    if (superAdmin) {
      superAdmin.companyId = company.code;
      superAdmin.name = lead.contactPerson;
      superAdmin.mobileNumber = lead.mobileNumber;
      superAdmin.role = 'Super Admin';
      superAdmin.branch = 'All Branches';
      superAdmin.branchId = 'All Branches';
      superAdmin.status = 'Active';
      superAdmin.password = hashedPassword;
      superAdmin.passwordSetupTokenHash = activationTokenHash;
      superAdmin.passwordSetupExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      superAdmin.mustSetPassword = true;
      await superAdmin.save();
    } else {
      superAdmin = await User.create({
        name: lead.contactPerson,
        email: lead.email,
        mobileNumber: lead.mobileNumber,
        role: 'Super Admin',
        companyId: company.code,
        branch: 'All Branches',
        branchId: 'All Branches',
        status: 'Active',
        password: hashedPassword,
        passwordSetupTokenHash: activationTokenHash,
        passwordSetupExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        mustSetPassword: true
      });
    }

    lead.status = 'Won';
    lead.convertedCompanyId = company.code;
    lead.convertedAt = new Date();

    lead.activatedPlan = subscription;

    if (subscription === 'One Day Trial') {
      lead.paymentStatus = 'Not Required';
    }

    await lead.save();

    const frontendUrl = String(process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '');
    const activationUrl = `${frontendUrl}/activate-account/${activationToken}`;
    const loginUrl = `${frontendUrl}/login?company=${company.code}`;
    const preBookingUrl = `${frontendUrl}/pre-booking/${company.code}`;

    // Send the account activation email
    const { sendCompanyActivationEmail } = require('../utils/emailService');
    const emailSent = await sendCompanyActivationEmail({
      recipientName: superAdmin.name,
      email: superAdmin.email,
      companyName: company.name,
      companyCode: company.code,
      subscription: company.subscription,
      activationUrl,
      loginUrl,
      preBookingUrl
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

      const {
        sendEmailDetailed
      } = require('../utils/emailService');

      const deliveryResult =
        await sendEmailDetailed(
          lead.email,
          subject.trim(),
          htmlBody
        );

      const attemptDate = new Date();

      // Always record the attempt.
      lead.communicationHistory.push({
        subject: subject.trim(),
        message: message.trim(),

        deliveryStatus:
          deliveryResult.delivered
            ? 'SENT'
            : 'FAILED',

        provider:
          deliveryResult.provider ||
          'UNKNOWN',

        errorMessage:
          deliveryResult.error || '',

        attemptedAt: attemptDate,

        sentAt:
          deliveryResult.delivered
            ? attemptDate
            : null,

        sentBy:
          req.userName ||
          req.user?.name ||
          'SaaS Super Admin'
      });

      // Mark Contacted only after real delivery.
      if (deliveryResult.delivered) {
        lead.lastContactedAt = attemptDate;

        if (lead.status === 'New') {
          lead.status = 'Contacted';
        }
      }

      await lead.save();

      // The request itself was processed successfully.
      // `delivered` tells the frontend the actual email result.
      return res.status(200).json({
        success: true,
        delivered: deliveryResult.delivered,

        message: deliveryResult.delivered
          ? 'Email delivered successfully.'
          : 'Email was not delivered. The failed attempt was saved in communication history.',

        delivery: {
          status:
            deliveryResult.delivered
              ? 'SENT'
              : 'FAILED',

          provider:
            deliveryResult.provider,

          messageId:
            deliveryResult.messageId,

          error:
            deliveryResult.error
        },

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
