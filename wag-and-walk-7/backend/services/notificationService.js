const nodemailer = require('nodemailer');

let transporter;

const getTransporter = () => {
  if (transporter) return transporter;

  // In dev / test we just log; in production we send real email
  if (process.env.NODE_ENV === 'production' && process.env.EMAIL_USER) {
    transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.EMAIL_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  } else {
    // Ethereal / no-op in dev
    transporter = {
      sendMail: async (opts) => {
        console.log('📧 [DEV EMAIL]', opts.to, '—', opts.subject);
        return { messageId: 'dev-' + Date.now() };
      },
    };
  }
  return transporter;
};

const from = process.env.EMAIL_FROM || 'Wag & Walk <noreply@wagandwalk.com>';

const sendEmail = async (to, subject, html) => {
  try {
    const t = getTransporter();
    await t.sendMail({ from, to, subject, html });
  } catch (err) {
    console.error('Email send failed:', err.message);
  }
};

/* ── Template helpers ─────────────────────────── */

exports.sendBookingRequest = async (walkerEmail, booking) => {
  await sendEmail(walkerEmail, '🐾 New Walk Request!',
    `<h2>New Walk Request</h2>
     <p>You have a new walk request for <strong>${new Date(booking.scheduledDate).toLocaleDateString()}</strong>
     at <strong>${booking.startTime}</strong>.</p>
     <p>Log in to your dashboard to accept or decline.</p>`);
};

exports.sendBookingAccepted = async (clientEmail, booking) => {
  await sendEmail(clientEmail, '✅ Walk Confirmed!',
    `<h2>Your Walk is Confirmed</h2>
     <p>Great news! Your walk on <strong>${new Date(booking.scheduledDate).toLocaleDateString()}</strong>
     at <strong>${booking.startTime}</strong> has been accepted.</p>`);
};

exports.sendBookingDeclined = async (clientEmail, booking) => {
  await sendEmail(clientEmail, '❌ Walk Request Declined',
    `<h2>Walk Request Update</h2>
     <p>Unfortunately, your walk request for <strong>${new Date(booking.scheduledDate).toLocaleDateString()}</strong>
     was declined. Please book another walker.</p>`);
};

exports.sendBookingCancelled = async (email, booking, cancelledBy) => {
  await sendEmail(email, '🚫 Walk Cancelled',
    `<h2>Walk Cancelled</h2>
     <p>The walk scheduled for <strong>${new Date(booking.scheduledDate).toLocaleDateString()}</strong>
     at <strong>${booking.startTime}</strong> has been cancelled by the ${cancelledBy}.</p>`);
};

exports.sendBookingCompleted = async (clientEmail, booking) => {
  await sendEmail(clientEmail, '🎉 Walk Completed!',
    `<h2>Walk Completed</h2>
     <p>Your dog's walk on <strong>${new Date(booking.scheduledDate).toLocaleDateString()}</strong> is done!</p>
     <p>Log in to leave a review and tip your walker.</p>`);
};

exports.sendTipReceived = async (walkerEmail, amount) => {
  await sendEmail(walkerEmail, '💰 You received a tip!',
    `<h2>Tip Received</h2>
     <p>A client just tipped you <strong>$${(amount / 100).toFixed(2)}</strong>. Great job!</p>`);
};

exports.sendPaymentConfirmation = async (clientEmail, amount) => {
  await sendEmail(clientEmail, '💳 Payment Confirmation',
    `<h2>Payment Confirmed</h2>
     <p>Your payment of <strong>$${(amount / 100).toFixed(2)}</strong> has been processed.</p>`);
};
