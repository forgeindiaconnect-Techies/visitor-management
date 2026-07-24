require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const nodemailer = require('nodemailer');

const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;

console.log('SMTP Config:');
console.log('  HOST:', SMTP_HOST);
console.log('  PORT:', SMTP_PORT);
console.log('  USER:', SMTP_USER);
console.log('  PASS:', SMTP_PASS ? '*** (set)' : '(NOT SET)');

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: false,
  auth: { user: SMTP_USER, pass: SMTP_PASS },
  tls: { rejectUnauthorized: false }
});

transporter.verify().then(() => {
  console.log('\n✅ SMTP connection VERIFIED successfully!');
  console.log('Sending test email to', SMTP_USER, '...');
  return transporter.sendMail({
    from: `"FIC Test" <${SMTP_USER}>`,
    to: SMTP_USER,
    subject: 'SMTP Test Email',
    html: '<h2>SMTP is working!</h2><p>This is a test email from the FIC server.</p>'
  });
}).then(info => {
  console.log('✅ Test email sent! Message ID:', info.messageId);
  process.exit(0);
}).catch(err => {
  console.error('\n❌ SMTP Error:', err.message);
  process.exit(1);
});
