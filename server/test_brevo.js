require('dotenv').config();
const { BrevoClient } = require("@getbrevo/brevo");
const nodemailer = require('nodemailer');

async function testEmail() {
  console.log("=== TESTING BREVO CONFIGURATION ===");
  console.log("BREVO_API_KEY:", process.env.BREVO_API_KEY ? "Present" : "Missing");
  console.log("BREVO_SENDER_EMAIL:", process.env.BREVO_SENDER_EMAIL);
  console.log("SMTP_HOST:", process.env.SMTP_HOST);
  console.log("SMTP_USER:", process.env.SMTP_USER);
  console.log("SMTP_PASS:", process.env.SMTP_PASS ? "Present" : "Missing");

  const to = "forgeindiaconnectfic@gmail.com";
  const subject = "Test Email from Brevo Diagnostic Script";
  const htmlBody = "<p>This is a test email to diagnose Brevo email delivery issues.</p>";

  // 1. Test Brevo API
  console.log("\n1. Testing Brevo REST API...");
  try {
    const client = new BrevoClient({ apiKey: process.env.BREVO_API_KEY });
    const response = await client.transactionalEmails.sendTransacEmail({
      subject: subject,
      htmlContent: htmlBody,
      sender: {
        name: process.env.BREVO_SENDER_NAME || 'ForgeIndiaConnect',
        email: process.env.BREVO_SENDER_EMAIL || 'forgeindiaconnectfic@gmail.com',
      },
      to: [{ email: to }],
    });
    console.log("✅ Brevo API Success:", response);
  } catch (err) {
    console.error("❌ Brevo API Error:", err.statusCode || err.name, err.message);
    if (err.body) console.error("Body:", JSON.stringify(err.body));
    if (err.response) console.error("Response body:", JSON.stringify(err.response.body));
  }

  // 2. Test SMTP
  console.log("\n2. Testing Nodemailer SMTP...");
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp-relay.brevo.com',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      },
      tls: {
        rejectUnauthorized: false
      }
    });
    const info = await transporter.sendMail({
      from: `"${process.env.BREVO_SENDER_NAME}" <${process.env.BREVO_SENDER_EMAIL}>`,
      to: to,
      subject: subject,
      html: htmlBody
    });
    console.log("✅ SMTP Success:", info.messageId);
  } catch (err) {
    console.error("❌ SMTP Error:", err.message);
  }
}

testEmail();
