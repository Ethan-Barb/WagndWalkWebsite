const Payment        = require('../models/Payment');
const Booking        = require('../models/Booking');
const paymentService = require('../services/paymentService');
const stripe         = require('../config/stripe');

/* ── Create PaymentIntent ─────────────────────── */
exports.createIntent = async (req, res, next) => {
  try {
    const { bookingId } = req.body;
    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    if (booking.client.toString() !== req.user._id.toString())
      return res.status(403).json({ error: 'Access denied' });

    const intent = await paymentService.createPaymentIntent(booking, req.user);
    booking.stripePaymentIntentId = intent.id;
    booking.paymentStatus = 'pending';
    await booking.save();

    res.json({ clientSecret: intent.client_secret });
  } catch (err) {
    next(err);
  }
};

/* ── Payment history ──────────────────────────── */
exports.getHistory = async (req, res, next) => {
  try {
    const filter = {};
    if (req.user.role === 'client') filter.client = req.user._id;
    else if (req.user.role === 'walker') filter.walker = req.user._id;

    const payments = await Payment.find(filter)
      .populate('booking', 'scheduledDate startTime status')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ payments });
  } catch (err) {
    next(err);
  }
};

/* ── Stripe Connect onboarding (walker) ───────── */
exports.stripeConnect = async (req, res, next) => {
  try {
    if (req.user.role !== 'walker')
      return res.status(403).json({ error: 'Only walkers can connect Stripe' });

    const result = await paymentService.createConnectAccount(req.user);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

/* ── Stripe webhook ───────────────────────────── */
exports.webhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET || 'whsec_placeholder'
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const pi = event.data.object;
        await Payment.findOneAndUpdate(
          { stripePaymentIntentId: pi.id },
          { status: 'succeeded', processedAt: new Date() }
        );
        if (pi.metadata?.bookingId) {
          await Booking.findByIdAndUpdate(pi.metadata.bookingId, {
            paymentStatus: 'paid',
            paidAt: new Date(),
          });
        }
        break;
      }
      case 'payment_intent.payment_failed': {
        const pi = event.data.object;
        await Payment.findOneAndUpdate(
          { stripePaymentIntentId: pi.id },
          { status: 'failed' }
        );
        if (pi.metadata?.bookingId) {
          await Booking.findByIdAndUpdate(pi.metadata.bookingId, {
            paymentStatus: 'failed',
          });
        }
        break;
      }
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  } catch (err) {
    console.error('Webhook processing error:', err.message);
  }

  res.json({ received: true });
};
