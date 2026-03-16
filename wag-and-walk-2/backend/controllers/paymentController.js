const stripe     = require('../config/stripe');
const Booking    = require('../models/Booking');
const Payment    = require('../models/Payment');
const paymentSvc = require('../services/paymentService');

// POST /api/payments/create-intent
exports.createPaymentIntent = async (req, res, next) => {
  try {
    const { bookingId, paymentMethodId } = req.body;
    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ error: 'Booking not found.' });

    const intent = await paymentSvc.createPaymentIntent(
      booking.totalPrice, req.user.stripeCustomerId, paymentMethodId
    );
    res.json({ clientSecret: intent.client_secret });
  } catch (err) { next(err); }
};

// POST /api/payments/webhook  (raw body — set up in server.js before json parser)
exports.handleWebhook = async (req, res, next) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET || 'whsec_placeholder');
  } catch (err) {
    return res.status(400).json({ error: `Webhook error: ${err.message}` });
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await paymentSvc.handlePaymentSucceeded(event.data.object);
        break;
      case 'payment_intent.payment_failed':
        await paymentSvc.handlePaymentFailed(event.data.object);
        break;
      case 'transfer.created':
        console.log('Transfer created:', event.data.object.id);
        break;
      default:
        break;
    }
    res.json({ received: true });
  } catch (err) { next(err); }
};

// GET /api/payments/history
exports.getPaymentHistory = async (req, res, next) => {
  try {
    const q = req.user.role === 'walker'
      ? { walker: req.user._id }
      : { client: req.user._id };

    const payments = await Payment.find(q)
      .populate('booking', 'scheduledDate status')
      .sort({ createdAt: -1 });

    res.json({ payments });
  } catch (err) { next(err); }
};

// POST /api/payments/stripe-connect  (walker connects payout account)
exports.setupStripeConnect = async (req, res, next) => {
  try {
    if (req.user.role !== 'walker')
      return res.status(403).json({ error: 'Only walkers can connect Stripe accounts.' });
    const link = await paymentSvc.createStripeConnectAccount(req.user);
    res.json({ url: link.url });
  } catch (err) { next(err); }
};
