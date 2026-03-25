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

exports.sendBookingRequestSMS = async (walkerPhone, booking) => {
  if (!walkerPhone) return;
  const date = new Date(booking.scheduledDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  await sendSMS(walkerPhone,
    `Wag & Walk: New walk request for ${date} at ${booking.startTime}. Open your dashboard to accept or decline.`
  );
};

exports.sendBookingAcceptedSMS = async (clientPhone, booking) => {
  if (!clientPhone) return;
  const date = new Date(booking.scheduledDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  await sendSMS(clientPhone,
    `Wag & Walk: Your walk on ${date} at ${booking.startTime} has been confirmed!`
  );
};

exports.sendBookingReminderSMS = async (phone, booking, role) => {
  if (!phone) return;
  const date = new Date(booking.scheduledDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const msg = role === 'walker'
    ? `Wag & Walk reminder: You have a walk tomorrow (${date}) at ${booking.startTime}.`
    : `Wag & Walk reminder: Your dog's walk is tomorrow (${date}) at ${booking.startTime}.`;
  await sendSMS(phone, msg);
};

exports.sendBookingCompletedSMS = async (clientPhone) => {
  if (!clientPhone) return;
  await sendSMS(clientPhone,
    `Wag & Walk: Your dog's walk is complete! Log in to leave a review and tip your walker.`
  );
};

exports.sendBookingCancelledSMS = async (phone, cancelledBy) => {
  if (!phone) return;
  await sendSMS(phone,
    `Wag & Walk: A walk has been cancelled by the ${cancelledBy}. Check your dashboard for details.`
  );
};

exports.sendTipReceivedSMS = async (walkerPhone, amount) => {
  if (!walkerPhone) return;
  await sendSMS(walkerPhone,
    `Wag & Walk: You received a $${(amount / 100).toFixed(2)} tip! Great job.`
  );
};

exports.sendCustomSMS = sendSMS;
