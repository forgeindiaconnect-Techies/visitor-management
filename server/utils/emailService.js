const nodemailer = require('nodemailer');
const { BrevoClient } = require("@getbrevo/brevo");

const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_USER = process.env.SMTP_USER || 'forgeindiaconnectfic@gmail.com';
const SMTP_PASS = process.env.SMTP_PASS || 'nuyy dzpp ysfp tcdl';

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465, // true for 465, false for other ports
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS
  },
  tls: {
    rejectUnauthorized: false
  }
});

const syncToGmailSentFolder = (to, subject, htmlBody) => {
  try {
    const senderEmail = process.env.BREVO_SENDER_EMAIL || SMTP_USER || 'forgeindiaconnectfic@gmail.com';
    transporter.sendMail({
      from: `"${process.env.BREVO_SENDER_NAME || 'FIC VMS'}" <${senderEmail}>`,
      to: to,
      subject: subject,
      html: htmlBody
    }).then(() => {
      console.log(`📥 Synced copy to Gmail Sent folder for ${to}`);
    }).catch((err) => {
      console.warn(`⚠️ Gmail Sent folder sync notice: ${err.message}`);
    });
  } catch (err) {
    // Non-critical background sync catch
  }
};

const sendEmail = async (to, subject, htmlBody) => {
  const senderEmail = process.env.BREVO_SENDER_EMAIL || SMTP_USER || 'forgeindiaconnectfic@gmail.com';
  const senderName = process.env.BREVO_SENDER_NAME || 'ForgeIndiaConnect';

  // 1. Primary Attempt: Send via Gmail SMTP for clean From address (no @brevosend.com) & automatic Gmail Sent folder logging
  try {
    const info = await transporter.sendMail({
      from: `"${senderName}" <${senderEmail}>`,
      to: to,
      replyTo: `"${senderName}" <${senderEmail}>`,
      subject: subject,
      html: htmlBody
    });
    console.log(`📧 Gmail SMTP email sent successfully to ${to}. MessageId: ${info.messageId}`);
    return true;
  } catch (gmailErr) {
    console.warn(`⚠️ Gmail SMTP failed (${gmailErr.message}). Falling back to Brevo API...`);
  }

  // 2. Fallback Attempt: Send via Brevo API
  try {
    if (!process.env.BREVO_API_KEY) {
       console.warn("⚠️ BREVO_API_KEY is not set. Email will not be sent.");
       return false;
    }

    const brevo = new BrevoClient({ apiKey: process.env.BREVO_API_KEY });

    await brevo.transactionalEmails.sendTransacEmail({
      subject: subject,
      htmlContent: htmlBody,
      sender: {
        name: senderName,
        email: senderEmail,
      },
      to: [{ email: to }],
      replyTo: { email: senderEmail, name: senderName },
      bcc: [{ email: senderEmail, name: senderName }]
    });
    console.log(`📧 Brevo API email sent successfully to ${to}. Subject: ${subject}`);

    return true;
  } catch (err) {
    console.warn(`⚠️ Brevo email error (${err.message}). Logging email to console:`);
    console.log('\n' + '='.repeat(60));
    console.log('📧 EMAIL DISPATCH LOG');
    console.log('='.repeat(60));
    console.log(`To:      ${to}`);
    console.log(`Subject: ${subject}`);
    console.log('-'.repeat(60));
    console.log(htmlBody.replace(/<[^>]*>?/gm, ''));
    console.log('='.repeat(60) + '\n');
    return false;
  }
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

module.exports = {
  sendEmail,
  sendPreBookingInvitation,
  sendRegistrationConfirmation,
  sendVisitorInvitationEmail,
  sendPreBookingRequestReceived,
  sendApprovalEmail,
  sendRejectionEmail,
  EmailTemplates
};
