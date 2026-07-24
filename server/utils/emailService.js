const nodemailer = require('nodemailer');

const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_USER = process.env.SMTP_USER || 'forgeindiaconnectfic@gmail.com';
const SMTP_PASS = process.env.SMTP_PASS || 'nuyy dzpp ysfp tcdl';

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: false, // true for 465, false for 587
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS
  },
  tls: {
    rejectUnauthorized: false
  }
});

const sendEmail = async (to, subject, htmlBody) => {
  try {
    const info = await transporter.sendMail({
      from: `"FIC Visitor Management" <${SMTP_USER}>`,
      to,
      subject,
      html: htmlBody
    });
    console.log(`📧 Email sent successfully to ${to}. MessageId: ${info.messageId}`);
    return true;
  } catch (err) {
    console.warn(`⚠️ Nodemailer error (${err.message}). Logging email to console:`);
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

const EmailTemplates = {
  welcome: (companyName, adminName) => ({
    subject: 'Welcome to Zone Monitor Visitor Management System',
    body: `<h2>Welcome, ${adminName}!</h2>`
  })
};

module.exports = {
  sendEmail,
  sendPreBookingInvitation,
  sendRegistrationConfirmation,
  EmailTemplates
};
