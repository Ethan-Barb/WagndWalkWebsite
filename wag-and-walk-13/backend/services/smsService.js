/**
 * SMS Service — Twilio integration for walk reminders and notifications.
 *
 * Setup:
 *   1. Create a free Twilio account at twilio.com
 *   2. Get a phone number from the Twilio console
 *   3. Add to .env: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER
 */

let twilioClient = null;

const getClient = () => {
  if (twilioClient) return twilioClient;
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    try {
      const twilio = require('twilio');
      twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    } catch (err) {
      console.log('Twilio not installed or configured — SMS disabled');
      twilioClient = null;
    }
  }
  return twilioClient;
};

const fromNumber = () => process.env.TWILIO_PHONE_NUMBER || '';

const sendSMS = async (to, body) => {
  const client = getClient();
  if (!client || !fromNumber()) {
    console.log(`📱 [DEV SMS] To: ${to} — ${body}`);
    return { sid: 'dev-' + Date.now() };
  }

  // Normalize phone number
  let phone = to.replace(/[^\d+]/g, '');
  if (!phone.startsWith('+')) {
    phone = phone.startsWith('1') ? `+${phone}` : `+1${phone}`;
  }

  try {
    const message = await client.messages.create({
      body,
      from: fromNumber(),
      to: phone,
    });
    console.log(`📱 SMS sent to ${phone}: ${message.sid}`);
    return message;
  } catch (err) {
    console.error('SMS send failed:', err.message);
    return null;
  }
};

/* ── Templates ────────────────────────────────── */

// Business contact number — used in customer-facing SMS
const BUSINESS_PHONE = '(630) 474-5248';

exports.sendBookingRequestSMS = async (walkerPhone, booking) => {
  if (!walkerPhone) return;
  const date = new Date(booking.scheduledDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  await sendSMS(walkerPhone,
    `Wag & Walk: New walk request for ${date} at ${booking.startTime}. Open your dashboard to accept or decline. Reply to ${BUSINESS_PHONE}`
  );
};

exports.sendBookingAcceptedSMS = async (clientPhone, booking) => {
  if (!clientPhone) return;
  const date = new Date(booking.scheduledDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  await sendSMS(clientPhone,
    `Wag & Walk: Your walk on ${date} at ${booking.startTime} has been confirmed! Reply to ${BUSINESS_PHONE}`
  );
};

exports.sendWalkerAssignedSMS = async (clientPhone, walkerName) => {
  if (!clientPhone) return;
  await sendSMS(clientPhone,
    `Wag & Walk: ${walkerName} has been assigned to your walk! Reply to ${BUSINESS_PHONE}`
  );
};

exports.sendOnTheWaySMS = async (clientPhone, walkerName) => {
  if (!clientPhone) return;
  await sendSMS(clientPhone,
    `Wag & Walk: Your walker ${walkerName} is on the way! 🐕 Reply to ${BUSINESS_PHONE}`
  );
};

exports.sendWalkInProgressSMS = async (clientPhone) => {
  if (!clientPhone) return;
  await sendSMS(clientPhone,
    `Wag & Walk: Your dog's walk is in progress! Sit back and relax. Reply to ${BUSINESS_PHONE}`
  );
};

exports.sendBookingReminderSMS = async (phone, booking, role) => {
  if (!phone) return;
  const date = new Date(booking.scheduledDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const msg = role === 'walker'
    ? `Wag & Walk reminder: You have a walk tomorrow (${date}) at ${booking.startTime}. Reply to ${BUSINESS_PHONE}`
    : `Wag & Walk reminder: Your dog's walk is tomorrow (${date}) at ${booking.startTime}. Reply to ${BUSINESS_PHONE}`;
  await sendSMS(phone, msg);
};

exports.sendBookingCompletedSMS = async (clientPhone) => {
  if (!clientPhone) return;
  await sendSMS(clientPhone,
    `Wag & Walk: Your dog's walk is complete! Log in to leave a review and tip your walker. Reply to ${BUSINESS_PHONE}`
  );
};

exports.sendBookingCancelledSMS = async (phone, cancelledBy) => {
  if (!phone) return;
  await sendSMS(phone,
    `Wag & Walk: A walk has been cancelled by the ${cancelledBy}. Check your dashboard for details. Reply to ${BUSINESS_PHONE}`
  );
};

exports.sendTipReceivedSMS = async (walkerPhone, amount) => {
  if (!walkerPhone) return;
  await sendSMS(walkerPhone,
    `Wag & Walk: You received a $${(amount / 100).toFixed(2)} tip! Great job.`
  );
};

exports.BUSINESS_PHONE = BUSINESS_PHONE;
exports.sendCustomSMS = sendSMS;

/**
 * updateAppointmentStatus — Central status update function with SMS hooks.
 * 
 * Usage: const updated = await updateAppointmentStatus(appointmentId, 'on_the_way');
 *
 * Triggers appropriate SMS notification based on the new status.
 * Returns the updated appointment document (populated with client/walker).
 */
exports.updateAppointmentStatus = async (appointmentId, newStatus) => {
  const Booking = require('../models/Booking');
  const User = require('../models/User');

  try {
    const booking = await Booking.findByIdAndUpdate(
      appointmentId,
      { status: newStatus },
      { new: true, runValidators: true }
    ).populate('client', 'firstName lastName phone')
     .populate('walker', 'firstName lastName phone');

    if (!booking) throw new Error('Booking not found');

    const clientPhone = booking.client?.phone;
    const walkerPhone = booking.walker?.phone;
    const walkerName = booking.walker ? `${booking.walker.firstName} ${booking.walker.lastName}` : 'Your walker';

    // Trigger SMS based on status
    switch (newStatus) {
      case 'accepted':
        await exports.sendBookingAcceptedSMS(clientPhone, booking);
        break;
      case 'walker_assigned':
        await exports.sendWalkerAssignedSMS(clientPhone, walkerName);
        break;
      case 'on_the_way':
        await exports.sendOnTheWaySMS(clientPhone, walkerName);
        break;
      case 'in_progress':
        await exports.sendWalkInProgressSMS(clientPhone);
        break;
      case 'completed':
        await exports.sendBookingCompletedSMS(clientPhone);
        break;
      case 'cancelled':
        await exports.sendBookingCancelledSMS(clientPhone, 'system');
        await exports.sendBookingCancelledSMS(walkerPhone, 'system');
        break;
    }

    return booking;
  } catch (err) {
    console.error('updateAppointmentStatus error:', err.message);
    throw err;
  }
};
