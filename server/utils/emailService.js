const nodemailer = require('nodemailer');
const { BrevoClient } = require("@getbrevo/brevo");

const isBrevoApiKey = process.env.BREVO_API_KEY && process.env.BREVO_API_KEY.startsWith('xkeysib-');
const isBrevoSmtpKey = (process.env.BREVO_API_KEY && process.env.BREVO_API_KEY.startsWith('xsmtpsib-')) || 
                       (process.env.SMTP_PASS && process.env.SMTP_PASS.startsWith('xsmtpsib-')) ||
                       (process.env.SMTP_HOST && process.env.SMTP_HOST.includes('brevo'));

const SMTP_HOST = process.env.SMTP_HOST || (isBrevoSmtpKey ? 'smtp-relay.brevo.com' : 'smtp.gmail.com');
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_USER = process.env.SMTP_USER || process.env.BREVO_SENDER_EMAIL || 'forgeindiaconnectfic@gmail.com';
const SMTP_PASS = process.env.SMTP_PASS || (isBrevoSmtpKey ? process.env.BREVO_API_KEY : '');

// High-performance pooled transporter with fast connection timeout
const transporter = nodemailer.createTransport({
  pool: true,
  maxConnections: 5,
  maxMessages: 100,
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465,
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS
  },
  tls: {
    rejectUnauthorized: false
  },
  connectionTimeout: 5000,
  greetingTimeout: 5000,
  socketTimeout: 10000
});

// Singleton Brevo client for instant REST API calls
let brevoClient = null;
if (isBrevoApiKey) {
  try {
    brevoClient = new BrevoClient({ apiKey: process.env.BREVO_API_KEY });
  } catch (initErr) {
    console.warn("⚠️ Failed to initialize BrevoClient singleton:", initErr.message);
  }
}

const sendEmailDetailed = async (to, subject, htmlBody) => {
  const senderEmail = process.env.BREVO_SENDER_EMAIL || SMTP_USER || 'forgeindiaconnectfic@gmail.com';
  const senderName = process.env.BREVO_SENDER_NAME || 'ForgeIndiaConnect';
  let lastError = '';

  // 1. Primary Attempt: Brevo REST API (when xkeysib- key is provided)
  if (isBrevoApiKey && (brevoClient || process.env.BREVO_API_KEY)) {
    try {
      const client = brevoClient || new BrevoClient({ apiKey: process.env.BREVO_API_KEY });
      const apiRes = await client.transactionalEmails.sendTransacEmail({
        subject: subject,
        htmlContent: htmlBody,
        sender: {
          name: senderName,
          email: senderEmail,
        },
        to: [{ email: to }],
        replyTo: { email: senderEmail, name: senderName }
      });
      console.log(`⚡ Instant Brevo API email dispatched to ${to} (${subject})`);
      return {
        delivered: true,
        provider: 'BREVO_API',
        messageId: apiRes?.messageId || apiRes?.body?.messageId || null,
        error: ''
      };
    } catch (brevoErr) {
      lastError = `Brevo API error: ${brevoErr.message}`;
      console.warn(`⚠️ Brevo API delivery notice (${brevoErr.message}). Falling back to SMTP...`);
    }
  }

  // 2. Secondary Attempt: Configured SMTP Delivery (Brevo SMTP relay)
  try {
    const info = await transporter.sendMail({
      from: `"${senderName}" <${senderEmail}>`,
      to: to,
      replyTo: `"${senderName}" <${senderEmail}>`,
      subject: subject,
      html: htmlBody
    });
    console.log(`📧 SMTP (${SMTP_HOST}) email sent to ${to}. MessageId: ${info.messageId}`);
    return {
      delivered: true,
      provider: 'BREVO_SMTP',
      messageId: info.messageId,
      error: ''
    };
  } catch (smtpErr) {
    lastError = lastError ? `${lastError} | Brevo SMTP error: ${smtpErr.message}` : `Brevo SMTP error: ${smtpErr.message}`;
    console.warn(`⚠️ Primary SMTP (${SMTP_HOST}) failed (${smtpErr.message}). Attempting Gmail SMTP fallback...`);
  }

  // 3. Tertiary Attempt: Fallback Gmail SMTP
  try {
    const fallbackTransporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'forgeindiaconnectfic@gmail.com',
        pass: 'nuyy dzpp ysfp tcdl'
      },
      tls: { rejectUnauthorized: false }
    });

    const info = await fallbackTransporter.sendMail({
      from: `"${senderName}" <${senderEmail}>`,
      to: to,
      replyTo: `"${senderName}" <${senderEmail}>`,
      subject: subject,
      html: htmlBody
    });
    console.log(`📧 Fallback Gmail SMTP email sent to ${to}. MessageId: ${info.messageId}`);
    return {
      delivered: true,
      provider: 'GMAIL_SMTP',
      messageId: info.messageId,
      error: ''
    };
  } catch (fallbackErr) {
    lastError = `${lastError} | Gmail SMTP error: ${fallbackErr.message}`;
    console.warn(`⚠️ Fallback Gmail SMTP failed (${fallbackErr.message}). Logging email to console.`);
  }

  // 4. Ultimate Fallback: Log email to server console
  console.log('\n' + '='.repeat(60));
  console.log('📧 EMAIL DISPATCH LOG (Console Fallback)');
  console.log('='.repeat(60));
  console.log(`To:      ${to}`);
  console.log(`Subject: ${subject}`);
  console.log('-'.repeat(60));
  console.log(htmlBody.replace(/<[^>]*>?/gm, ''));
  console.log('='.repeat(60) + '\n');

  return {
    delivered: false,
    provider: 'CONSOLE',
    messageId: null,
    error: lastError || 'All email delivery providers failed'
  };
};

const sendEmail = async (to, subject, htmlBody) => {
  const res = await sendEmailDetailed(to, subject, htmlBody);
  return res.delivered;
};

const sendPreBookingInvitation = async ({ visitorName, email, registrationLink, expiryDate, companyName }) => {
  const appName = companyName || 'FIC Visitor Management';
  const subject = `Complete Your Registration - ${appName}`;
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; rounded: 12px;">
      <div style="background-color: #0f172a; color: white; padding: 16px 24px; border-radius: 8px 8px 0 0; text-align: center;">
        <h2 style="margin: 0; font-size: 20px;">${appName}</h2>
      </div>
      <div style="padding: 24px; background-color: #ffffff;">
        <p style="font-size: 16px; color: #1e293b;">Hello <strong>${visitorName}</strong>,</p>
        <p style="font-size: 14px; color: #475569; line-height: 1.6;">Your pre-booking has been created successfully.</p>
        <p style="font-size: 14px; color: #475569; line-height: 1.6;">Please complete your registration using the secure link below.</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${registrationLink}" target="_blank" style="background-color: #4f46e5; color: #ffffff; padding: 12px 28px; text-decoration: none; font-weight: bold; border-radius: 6px; display: inline-block; font-size: 14px;">Complete Registration</a>
        </div>
        
        <p style="font-size: 12px; color: #64748b;">Or copy and paste this link into your browser:</p>
        <p style="font-size: 12px; color: #4f46e5; word-break: break-all;"><a href="${registrationLink}">${registrationLink}</a></p>

        <p style="font-size: 13px; color: #b45309; background-color: #fef3c7; padding: 10px 14px; border-radius: 6px; border-left: 4px solid #f59e0b;">
          ⏳ This registration link is valid until <strong>${expiryDate}</strong>.
        </p>
        <p style="font-size: 14px; color: #475569;">After completing your registration, your Visitor Pass will be generated automatically.</p>
        
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="font-size: 14px; color: #1e293b; margin: 0;">Thank You,<br/><strong>${appName}</strong></p>
      </div>
    </div>
  `;
  return await sendEmail(email, subject, htmlBody);
};

const sendRegistrationConfirmation = async ({ visitorName, email, passUrl, bookingId, companyName }) => {
  const appName = companyName || 'FIC Visitor Management';
  const subject = `Your Visit Has Been Approved - Booking ID: ${bookingId}`;
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
      <div style="background-color: #16a34a; color: white; padding: 16px 24px; border-radius: 8px 8px 0 0; text-align: center;">
        <h2 style="margin: 0; font-size: 20px;">✅ Registration Complete</h2>
      </div>
      <div style="padding: 24px; background-color: #ffffff;">
        <p style="font-size: 16px; color: #1e293b;">Hello <strong>${visitorName}</strong>,</p>
        <p style="font-size: 14px; color: #475569;">Your registration has been completed successfully and your Visitor Pass has been generated.</p>
        <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; padding: 16px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 4px 0; font-size: 14px;"><strong>Booking ID:</strong> ${bookingId}</p>
        </div>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${passUrl}" target="_blank" style="background-color: #0f172a; color: #ffffff; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 6px; display: inline-block;">View Visitor Pass & QR Code</a>
        </div>
        <p style="font-size: 13px; color: #64748b;">Please show your QR Pass at the security gate upon arrival.</p>
        <p style="font-size: 14px; color: #1e293b; margin-top: 24px;">Thank You,<br/><strong>${appName}</strong></p>
      </div>
    </div>
  `;
  return await sendEmail(email, subject, htmlBody);
};

const sendVisitorInvitationEmail = async ({ visitorName, email, companyName, purposeOfVisit, visitDate, visitTime, branch, numberOfVisitors, qrUrl, invitationUrl }) => {
  const subject = "Visitor Invitation";
  const htmlContent = `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
    <h2 style="text-align: center;">FIC VMS</h2>
    <h3>Visitor Invitation</h3>
    <p>Hello <strong>${visitorName}</strong>,</p>
    <p>Your visitor invitation has been created successfully.</p>
    <div style="background: #f5f5f5; padding: 20px; border-radius: 10px;">
      <p><strong>Visitor Name:</strong> ${visitorName}</p>
      <p><strong>Company:</strong> ${companyName || "Not provided"}</p>
      <p><strong>Purpose:</strong> ${purposeOfVisit || "Not provided"}</p>
      <p><strong>Date:</strong> ${visitDate}</p>
      <p><strong>Time:</strong> ${visitTime}</p>
      <p><strong>Branch:</strong> ${branch}</p>
      <p><strong>Visitors:</strong> ${numberOfVisitors || 1}</p>
    </div>
    <div style="text-align: center; margin: 30px 0;">
      <p><strong>Scan this QR code to view your invitation</strong></p>
      <img src="${qrUrl}" alt="Visitor Invitation QR Code" width="250" style="display: block; margin: 20px auto;" />
      <a href="${invitationUrl}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold;">
        View Invitation
      </a>
    </div>
    <p style="text-align: center; color: #777;">This invitation is valid for 24 hours.</p>
  </div>
  `;
  return await sendEmail(email, subject, htmlContent);
};

const EmailTemplates = {
  welcome: (companyName, adminName) => ({
    subject: 'Welcome to Zone Monitor Visitor Management System',
    body: `<h2>Welcome, ${adminName}!</h2>`
  })
};

const sendPreBookingRequestReceived = async ({ visitorName, email }) => {
  const subject = "Pre-Booking Request Received";
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
      <p style="font-size: 16px;">Hello <strong>${visitorName}</strong>,</p>
      <p style="font-size: 14px; color: #475569;">Your pre-booking request has been received and is currently waiting for approval.</p>
    </div>
  `;
  return await sendEmail(email, subject, htmlContent);
};

const sendApprovalEmail = async (preBooking) => {
  try {
    const rawFrontendUrl = process.env.FRONTEND_URL || 'https://zone-monitor.vercel.app';
    const frontendUrl = String(rawFrontendUrl).replace(/[\r\n\t]/g, '').trim().replace(/\/+$/, '');
    const passUrl = `${frontendUrl}/pass/${preBooking.visitorId || preBooking.visitId || preBooking._id}`;

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
        <h2>Visitor Booking Approved</h2>
        <p>Hello <strong>${preBooking.fullName || preBooking.visitorName}</strong>,</p>
        <p>Your visitor booking has been approved.</p>
        
        <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; padding: 16px; border-radius: 8px; margin: 20px 0;">
          <p>
            <strong>Visitor ID:</strong>
            ${preBooking.visitorId || preBooking.visitId}
          </p>
          <p>
            <strong>Visit Date:</strong>
            ${new Date(preBooking.visitDate).toLocaleDateString()}
          </p>
          <p>
            <strong>Expected Time:</strong>
            ${preBooking.expectedTime || preBooking.expectedArrivalTime}
          </p>
          <p>
            <strong>Host:</strong>
            ${preBooking.hostEmployee || preBooking.hostName || "N/A"}
          </p>
          <p>
            <strong>Purpose:</strong>
            ${preBooking.visitPurpose || preBooking.purpose || "N/A"}
          </p>
          <p>
            <strong>Status:</strong>
            <span style="color:#16a34a;font-weight:bold;">
              APPROVED
            </span>
          </p>
        </div>

        <p>
          Your visitor pass is now ready.
          Click the button below to view your pass.
        </p>

        <div style="text-align:center;margin:30px 0;">
          <a
            href="${passUrl}"
            style="
              display:inline-block;
              background:#312e81;
              color:white;
              padding:14px 28px;
              text-decoration:none;
              border-radius:8px;
              font-weight:bold;
            "
          >
            VIEW VISITOR PASS
          </a>
        </div>

        <p style="
          color:#64748b;
          font-size:13px;
        ">
          Please show your visitor pass to Security when
          you arrive at the office.
        </p>
      </div>
    `;

    const subject = "Your FIC VMS Visit Has Been Approved";
    return await sendEmail(preBooking.email, subject, htmlContent);
  } catch (error) {
    console.error("Approval email error:", error);
    return false;
  }
};

const sendRejectionEmail = async ({ visitorName, email }) => {
  const subject = "Your pre-booking request has been rejected";
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
      <p style="font-size: 16px;">Hello <strong>${visitorName}</strong>,</p>
      <p style="font-size: 14px; color: #475569;">Your pre-booking request has been rejected.</p>
    </div>
  `;
  return await sendEmail(email, subject, htmlContent);
};

const sendAdminVisitorPassEmail = async ({
  visitorName,
  email,
  companyName,
  visitorId,
  visitDate,
  expectedTime,
  hostName,
  purpose,
  branchName,
  passUrl
}) => {
  const safeCompanyName = companyName || 'Visitor Management System';

  const subject = `${safeCompanyName} – Your Visitor Pass`;

  const htmlBody = `
    <div style="
      background:#f1f5f9;
      padding:30px 15px;
      font-family:Arial,sans-serif;
    ">
      <div style="
        max-width:620px;
        margin:auto;
        background:#ffffff;
        border-radius:16px;
        overflow:hidden;
        box-shadow:0 8px 28px rgba(15,23,42,0.12);
      ">
        <div style="
          background:linear-gradient(135deg,#1e1b6e,#4f46e5);
          color:#ffffff;
          padding:28px;
          text-align:center;
        ">
          <h1 style="margin:0;font-size:25px;">
            ${safeCompanyName}
          </h1>

          <p style="margin:8px 0 0;font-size:14px;">
            Official Visitor Invitation
          </p>
        </div>

        <div style="padding:30px;">
          <p style="font-size:16px;color:#0f172a;">
            Hello <strong>${visitorName}</strong>,
          </p>

          <p style="
            color:#475569;
            font-size:14px;
            line-height:1.7;
          ">
            Your visit to <strong>${safeCompanyName}</strong> has been
            registered successfully. Your visitor pass is ready.
          </p>

          <div style="
            background:#f8fafc;
            border:1px solid #e2e8f0;
            border-radius:12px;
            padding:20px;
            margin:24px 0;
          ">
            <p><strong>Visitor ID:</strong> ${visitorId}</p>
            <p><strong>Visit Date:</strong> ${visitDate}</p>
            <p><strong>Expected Time:</strong> ${expectedTime}</p>
            <p><strong>Host:</strong> ${hostName || 'Direct Visit'}</p>
            <p><strong>Purpose:</strong> ${purpose}</p>
            <p><strong>Branch:</strong> ${branchName}</p>
            <p style="margin-bottom:0;">
              <strong>Status:</strong>
              <span style="
                color:#15803d;
                background:#dcfce7;
                padding:4px 10px;
                border-radius:20px;
              ">
                Approved
              </span>
            </p>
          </div>

          <div style="text-align:center;margin:30px 0;">
            <a
              href="${passUrl}"
              target="_blank"
              style="
                display:inline-block;
                background:#4f46e5;
                color:#ffffff;
                padding:14px 28px;
                border-radius:8px;
                text-decoration:none;
                font-weight:bold;
              "
            >
              View Visitor Pass
            </a>
          </div>

          <p style="
            color:#64748b;
            font-size:13px;
            line-height:1.6;
          ">
            Please show this visitor pass when you arrive. You can use
            the pass to check in and check out.
          </p>
        </div>

        <div style="
          background:#0f172a;
          color:#cbd5e1;
          padding:18px;
          text-align:center;
          font-size:12px;
        ">
          This is an automated visitor invitation from
          ${safeCompanyName}.
        </div>
      </div>
    </div>
  `;

  return await sendEmail(email, subject, htmlBody);
};

const sendCompanyActivationEmail = async ({
  recipientName,
  email,
  companyName,
  companyCode,
  subscription,
  activationUrl,
  loginUrl: customLoginUrl,
  preBookingUrl: customPreBookingUrl
}) => {
  const subject = `${companyName} – Your VMS Dashboard Is Ready`;
  const baseUrl = process.env.FRONTEND_URL || 'https://visitor-management-indol.vercel.app';
  const cleanBaseUrl = baseUrl.replace(/\/+$/, '');
  const loginUrl = customLoginUrl || `${cleanBaseUrl}/login?company=${companyCode}`;
  const preBookingUrl = customPreBookingUrl || `${cleanBaseUrl}/pre-booking/${companyCode}`;

  const htmlBody = `
    <div style="background:#f1f5f9;padding:30px;font-family:Arial,sans-serif;">
      <div style="max-width:600px;margin:auto;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
        <div style="background:#1e1b6e;color:#ffffff;padding:26px;text-align:center;">
          <h2 style="margin:0;">Welcome to FIC VMS</h2>
        </div>

        <div style="padding:30px;">
          <p>Hello <strong>${recipientName}</strong>,</p>

          <p>
            Your company dashboard for <strong>${companyName}</strong> has been created successfully.
          </p>

          <div style="background:#f8fafc;padding:18px;border-radius:10px;border: 1px solid #e2e8f0;margin-bottom:24px;">
            <p style="margin:4px 0;"><strong>Company Name:</strong> ${companyName}</p>
            <p style="margin:4px 0;"><strong>Company Code:</strong> ${companyCode}</p>
            <p style="margin:4px 0;"><strong>Login Email:</strong> ${email}</p>
            <p style="margin:4px 0;"><strong>Plan:</strong> ${subscription}</p>
            <p style="margin:4px 0;"><strong>Role:</strong> Super Admin</p>
          </div>

          <div style="text-align:center;margin:28px 0;">
            <a
              href="${activationUrl}"
              target="_blank"
              style="background:#4f46e5;color:#ffffff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;"
            >
              Activate Account & Create Password
            </a>
            <p style="color:#64748b;font-size:12px;margin-top:8px;">
              * This one-time password setup link expires in 24 hours.
            </p>
          </div>

          <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />

          <div style="space-y:16px;">
            <div style="margin-bottom:16px;">
              <p style="margin:0 0 4px 0;font-weight:bold;color:#1e293b;">📌 Permanent Dashboard Login Link (Bookmark this):</p>
              <a href="${loginUrl}" target="_blank" style="color:#4f46e5;word-break:break-all;font-size:14px;">${loginUrl}</a>
            </div>

            <div>
              <p style="margin:0 0 4px 0;font-weight:bold;color:#1e293b;">🔗 Visitor Pre-Booking Link (Share with visitors):</p>
              <a href="${preBookingUrl}" target="_blank" style="color:#059669;word-break:break-all;font-size:14px;">${preBookingUrl}</a>
            </div>
          </div>
        </div>

        <div style="background:#0f172a;color:#cbd5e1;padding:16px;text-align:center;font-size:12px;">
          Powered by
          <a
            href="https://forgeindiaconnect.com/"
            style="color:#ffffff;"
          >
            ForgeIndiaConnect
          </a>
        </div>
      </div>
    </div>
  `;

  return await sendEmail(email, subject, htmlBody);
};

module.exports = {
  sendEmail,
  sendEmailDetailed,
  sendCompanyActivationEmail,
  sendPreBookingInvitation,
  sendRegistrationConfirmation,
  sendVisitorInvitationEmail,
  sendPreBookingRequestReceived,
  sendApprovalEmail,
  sendRejectionEmail,
  sendAdminVisitorPassEmail,
  EmailTemplates
};
