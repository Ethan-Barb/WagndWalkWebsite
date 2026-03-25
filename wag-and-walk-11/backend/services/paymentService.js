const stripe  = require('../config/stripe');
const Payment = require('../models/Payment');
const Tip     = require('../models/Tip');
const User    = require('../models/User');

const PLATFORM_FEE_PERCENT = 20;

/**
 * Create a Stripe PaymentIntent with manual capture (hold funds).
 */
exports.createPaymentIntent = async (booking, client) => {
  try {
    const intent = await stripe.paymentIntents.create({
      amount:   booking.totalPrice,
      currency: 'usd',
      capture_method: 'manual',
      metadata: {
        bookingId: booking._id.toString(),
        clientId:  client._id.toString(),
      },
    });

    await Payment.create({
      booking: booking._id,
      client:  client._id,
      walker:  booking.walker,
      type:    'walk_payment',
      amount:  booking.totalPrice,
      status:  'pending',
      stripePaymentIntentId: intent.id,
    });

    return intent;
  } catch (err) {
    console.error('Stripe createPaymentIntent error:', err.message);
    throw err;
  }
};

/**
 * Capture a held PaymentIntent (when walker accepts).
 */
exports.capturePayment = async (paymentIntentId) => {
  try {
    const intent = await stripe.paymentIntents.capture(paymentIntentId);
    await Payment.findOneAndUpdate(
      { stripePaymentIntentId: paymentIntentId },
      { status: 'succeeded', processedAt: new Date() }
    );
    return intent;
  } catch (err) {
    console.error('Stripe capture error:', err.message);
    throw err;
  }
};

/**
 * Cancel a PaymentIntent (refund hold).
 */
exports.cancelPaymentIntent = async (paymentIntentId) => {
  try {
    await stripe.paymentIntents.cancel(paymentIntentId);
    await Payment.findOneAndUpdate(
      { stripePaymentIntentId: paymentIntentId },
      { status: 'refunded', processedAt: new Date() }
    );
  } catch (err) {
    console.error('Stripe cancel error:', err.message);
  }
};

/**
 * Transfer walker's share (80%) via Stripe Connect.
 */
exports.transferToWalker = async (booking) => {
  try {
    const walker = await User.findById(booking.walker);
    if (!walker?.walkerProfile?.stripeAccountId) {
      console.log('Walker has no Stripe Connect account — skipping transfer');
      return null;
    }

    const walkerAmount = Math.round(booking.totalPrice * (100 - PLATFORM_FEE_PERCENT) / 100);

    const transfer = await stripe.transfers.create({
      amount:      walkerAmount,
      currency:    'usd',
      destination: walker.walkerProfile.stripeAccountId,
      metadata:    { bookingId: booking._id.toString() },
    });

    await Payment.findOneAndUpdate(
      { booking: booking._id, type: 'walk_payment' },
      {
        stripeTransferId:   transfer.id,
        platformFeeAmount:  booking.totalPrice - walkerAmount,
        walkerPayoutAmount: walkerAmount,
      }
    );

    // Update walker earnings
    walker.walkerProfile.totalEarnings += walkerAmount;
    await walker.save();

    return transfer;
  } catch (err) {
    console.error('Stripe transfer error:', err.message);
    throw err;
  }
};

/**
 * Process a tip — 100% to walker.
 */
exports.processTip = async (booking, tipAmount) => {
  try {
    const tipIntent = await stripe.paymentIntents.create({
      amount:   tipAmount,
      currency: 'usd',
      confirm:  true,
      automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
      metadata: {
        bookingId: booking._id.toString(),
        type:      'tip',
      },
    });

    await Tip.create({
      booking: booking._id,
      client:  booking.client,
      walker:  booking.walker,
      amount:  tipAmount,
      stripePaymentIntentId: tipIntent.id,
      status:  'succeeded',
    });

    // Transfer tip to walker
    const walker = await User.findById(booking.walker);
    if (walker?.walkerProfile?.stripeAccountId) {
      await stripe.transfers.create({
        amount:      tipAmount,
        currency:    'usd',
        destination: walker.walkerProfile.stripeAccountId,
        metadata:    { bookingId: booking._id.toString(), type: 'tip' },
      });
    }

    // Update walker tip total
    if (walker) {
      walker.walkerProfile.totalTips += tipAmount;
      await walker.save();
    }

    return tipIntent;
  } catch (err) {
    console.error('Stripe tip error:', err.message);
    throw err;
  }
};

/**
 * Create Stripe Connect Express account for walker onboarding.
 */
exports.createConnectAccount = async (walker) => {
  try {
    const account = await stripe.accounts.create({
      type:    'express',
      country: 'US',
      email:   walker.email,
      capabilities: {
        card_payments: { requested: true },
        transfers:     { requested: true },
      },
    });

    walker.walkerProfile.stripeAccountId = account.id;
    await walker.save();

    const link = await stripe.accountLinks.create({
      account:     account.id,
      refresh_url: `${process.env.CLIENT_URL || 'http://localhost:3000'}/dashboard/walker`,
      return_url:  `${process.env.CLIENT_URL || 'http://localhost:3000'}/dashboard/walker`,
      type:        'account_onboarding',
    });

    return { url: link.url, accountId: account.id };
  } catch (err) {
    console.error('Stripe Connect error:', err.message);
    throw err;
  }
};
