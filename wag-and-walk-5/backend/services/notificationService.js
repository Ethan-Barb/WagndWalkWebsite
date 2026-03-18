const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host:   process.env.EMAIL_HOST  || 'smtp.gmail.com',
  port:   process.env.EMAIL_PORT  || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const FROM   = `Wag & Walk <${process.env.EMAIL_FROM || 'noreply@wagandwalk.com'}>`;
const CLIENT = process.env.CLIENT_URL || 'http://localhost:3000';

const send = async ({ to, subject, html }) => {
  if (process.env.NODE_ENV === 'test') return;
  if (!process.env.EMAIL_USER) { console.log(`[EMAIL] to=${to} | ${subject}`); return; }
  try {
    await transporter.sendMail({ from: FROM, to, subject, html });
  } catch (e) { console.error('Email error:', e.message); }
};

const fmtDate  = (d) => new Date(d).toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' });
const fmtMoney = (cents) => `$${(cents/100).toFixed(2)}`;

// ── Email templates ──────────────────────────────────────────

exports.sendWelcomeEmail = (user, token) => send({
  to: user.email,
  subject: '🐾 Welcome to Wag & Walk!',
  html: `
    <div style="font-family:sans-serif;max-width:520px;margin:auto;">
      <h2 style="color:#D4883E;">Welcome, ${user.firstName}! 🐾</h2>
      <p>Thanks for joining Wag & Walk — Naperville's trusted dog walking platform.</p>
      <p><a href="${CLIENT}/api/auth/verify-email/${token}" style="background:#D4883E;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;">Verify Email</a></p>
    </div>`,
});

exports.sendBookingRequest = (walker, booking) => send({
  to: walker.email,
  subject: '🐕 New walk request!',
  html: `
    <div style="font-family:sans-serif;max-width:520px;margin:auto;">
      <h2 style="color:#D4883E;">New Walk Request</h2>
      <p>Hi ${walker.firstName}, you have a new booking!</p>
      <p><strong>Date:</strong> ${fmtDate(booking.scheduledDate)}</p>
      <p><strong>Time:</strong> ${booking.startTime} – ${booking.endTime}</p>
      <p><strong>Address:</strong> ${booking.pickupAddress?.street}, Naperville</p>
      <p><strong>Your payout:</strong> ${fmtMoney(booking.totalPrice * 0.8)}</p>
      <p><a href="${CLIENT}/walkers/walker-dashboard.html" style="background:#D4883E;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;">View Request</a></p>
    </div>`,
});

exports.sendBookingConfirmation = (client, booking) => send({
  to: client.email,
  subject: '✅ Walk Confirmed!',
  html: `
    <div style="font-family:sans-serif;max-width:520px;margin:auto;">
      <h2 style="color:#D4883E;">Your Walk is Confirmed!</h2>
      <p>Hi ${client.firstName}, your booking has been accepted.</p>
      <p><strong>Date:</strong> ${fmtDate(booking.scheduledDate)}</p>
      <p><strong>Time:</strong> ${booking.startTime} – ${booking.endTime}</p>
      <p><strong>Total charged:</strong> ${fmtMoney(booking.totalPrice)}</p>
    </div>`,
});

exports.sendBookingCancelled = (user, booking) => send({
  to: user.email,
  subject: '❌ Walk Cancelled',
  html: `
    <div style="font-family:sans-serif;max-width:520px;margin:auto;">
      <h2>Walk Cancelled</h2>
      <p>Hi ${user.firstName}, a walk scheduled for ${fmtDate(booking.scheduledDate)} has been cancelled.</p>
      <p><strong>Reason:</strong> ${booking.cancellationReason || 'Not specified'}</p>
      ${booking.paymentStatus === 'refunded' ? '<p>✅ A full refund has been issued.</p>' : ''}
    </div>`,
});

exports.sendWalkCompleted = (client, booking) => send({
  to: client.email,
  subject: '🎉 Walk Complete — Leave a Tip!',
  html: `
    <div style="font-family:sans-serif;max-width:520px;margin:auto;">
      <h2 style="color:#D4883E;">Walk Complete!</h2>
      <p>Hi ${client.firstName}, your dog's walk is done. 🐾</p>
      <p>Did your walker do a great job? Show your appreciation!</p>
      <p><a href="${CLIENT}/clients/client-dashboard.html" style="background:#D4883E;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;">Leave a Tip / Review</a></p>
    </div>`,
});

exports.sendTipReceived = (walker, booking, amount) => send({
  to: walker.email,
  subject: '💰 You received a tip!',
  html: `
    <div style="font-family:sans-serif;max-width:520px;margin:auto;">
      <h2 style="color:#D4883E;">Tip Received! 💰</h2>
      <p>Hi ${walker.firstName}, you got a ${fmtMoney(amount)} tip for your walk on ${fmtDate(booking.scheduledDate)}!</p>
      <p>Keep up the great work! 🐾</p>
    </div>`,
});

exports.sendAppointmentReminder = (user, booking) => send({
  to: user.email,
  subject: '⏰ Walk Reminder — Tomorrow!',
  html: `
    <div style="font-family:sans-serif;max-width:520px;margin:auto;">
      <h2>Walk Reminder</h2>
      <p>Hi ${user.firstName}, just a reminder — you have a walk tomorrow!</p>
      <p><strong>Date:</strong> ${fmtDate(booking.scheduledDate)}</p>
      <p><strong>Time:</strong> ${booking.startTime}</p>
      <p><strong>Address:</strong> ${booking.pickupAddress?.street}, Naperville</p>
    </div>`,
});
