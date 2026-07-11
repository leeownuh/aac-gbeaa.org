const nodemailer = require('nodemailer');
const config = require('../config');

const normalizeField = (value, maxLength) =>
  String(value || '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLength);

const isConfigured = () =>
  Boolean(config.mail.smtpHost && config.mail.smtpUser && config.mail.smtpPass && config.mail.to);

const createTransporter = () => nodemailer.createTransport({
  host: config.mail.smtpHost,
  port: config.mail.smtpPort,
  secure: config.mail.smtpSecure,
  auth: {
    user: config.mail.smtpUser,
    pass: config.mail.smtpPass
  }
});

const buildContactEmail = ({ name, location, contactNumber, message }) => {
  const safeName = normalizeField(name, 120);
  const safeLocation = normalizeField(location, 160);
  const safeContactNumber = normalizeField(contactNumber, 80);
  const safeMessage = normalizeField(message, 4000);

  return {
    safeName,
    safeLocation,
    safeContactNumber,
    safeMessage,
    subject: `Website contact form: ${safeName || 'New enquiry'}`,
    text: [
      'New website contact form submission',
      '',
      `Name: ${safeName}`,
      `Location: ${safeLocation}`,
      `Contact number: ${safeContactNumber}`,
      '',
      'Message:',
      safeMessage
    ].join('\n'),
    html: `
      <h2>New website contact form submission</h2>
      <p><strong>Name:</strong> ${escapeHtml(safeName)}</p>
      <p><strong>Location:</strong> ${escapeHtml(safeLocation)}</p>
      <p><strong>Contact number:</strong> ${escapeHtml(safeContactNumber)}</p>
      <p><strong>Message:</strong></p>
      <p>${escapeHtml(safeMessage).replace(/\n/g, '<br>')}</p>
    `
  };
};

const escapeHtml = (value) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const sendContactFormEmail = async (payload) => {
  if (!isConfigured()) {
    const error = new Error('Contact email is not configured');
    error.code = 'MAIL_NOT_CONFIGURED';
    throw error;
  }

  const email = buildContactEmail(payload);
  const from = config.mail.from || config.mail.to;

  return createTransporter().sendMail({
    from,
    to: config.mail.to,
    subject: email.subject,
    text: email.text,
    html: email.html
  });
};

module.exports = {
  sendContactFormEmail
};
