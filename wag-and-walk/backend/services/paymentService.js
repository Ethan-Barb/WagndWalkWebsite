const stripe  = require('../config/stripe');
const Payment = require('../models/Payment');
const User    = require('../models/User');

const PLATFORM_FEE = 0.20;

exports.createStripeCustomer = async (user, paymentMethodId) =>
  stripe.customers.create({
    email: user.email,
    name:  user.fullName,
    phone: user.phone,
    metadata: { userId: user._id.toString() },
    payment_method: paymentMethodId,
    invoice_settings: { default_payment_method: paymentMethodId },
  });

exports.attachPaymentMethod = async (customerId, paymentMethodId) => {
  await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
  await stripe.customers.update(customerId, {
    invoice_settings: { default_payment_method: paymentMethodId },
  });
};

exports.createSetupIntent = (customerId) =>
  stripe.setupIntents.create({ customer: customerId, payment_method_types: ['card'] });

exports.createPaymentIntent = async (amount, customerId, paymentMethodId, metadata = {}) => {
  const params = {
    amount,
    currency:           'usd',
    capture_method:     'manual',   // hold funds until walk done
    confirmation_method:'automatic',
    metadata,
  };
  if (customerId)      params.customer       = customerId;
  if (paymentMethodId) { params.payment_method = paymentMethodId; params.confirm = true; }
  return stripe.paymentIntents.create(params);
};

exports.capturePaymentIntent = (id) => stripe.paymentIntents.capture(id);

exports.cancelPaymentIntent = async (id) => {
  try { return await stripe.paymentIntents.cancel(id); }
  catch (e) { console.error('cancelPaymentIntent:', e.message); }
};

exports.refundPaymentIntent = (id) => stripe.refunds.create({ payment_intent: id });

exports.createTipPayment = async (amount, customerId, paymentMethodId, booking) => {
  const params = {
    amount,
    currency: 'usd',
    confirm:  true,
    metadata: { type: 'tip', bookingId: booking._id.toString() },
  };
  if (customerId)      params.customer       = customerId;
  if (paymentMethodId) params.payment_method = paymentMethodId;
  return stripe.paymentIntents.create(params);
};

exports.transferToWalker = async (booking) => {
  try {
    const walker = await User.findById(booking.walker);
    if (!walker?.walkerProfile?.stripeAccountId) {
      console.warn('Walker has no Stripe Connect account — skipping transfer');
      return;
    }
    const walkerAmount = Math.round(booking.totalPrice * (1 - PLATFORM_FEE));
    const transfer = await stripe.transfers.create({
      amount:      walkerAmount,
      currency:    'usd',
      destination: walker.walkerProfile.stripeAccountId,
      metadata:    { bookingId: booking._id.toString() },
    });
    await Payment.create({
      booking:               booking._id,
      client:                booking.client,
      walker:                booking.walker,
      type:                  'walk_payment',
      amount:                booking.totalPrice,
      stripePaymentIntentId: booking.stripePaymentIntentId,
      stripeTransferId:      transfer.id,
      status:                'succeeded',
      platformFeeAmount:     Math.round(booking.totalPrice * PLATFORM_FEE),
      walkerPayoutAmount:    walkerAmount,
      processedAt:           new Date(),
    });
    return transfer;
  } catch (e) { console.error('transferToWalker:', e.message); }
};

exports.createStripeConnectAccount = async (user) => {
  const account = await stripe.accounts.create({
    type:         'express',
    country:      'US',
    email:        user.email,
    capabilities: { transfers: { requested: true } },
    metadata:     { userId: user._id.toString() },
  });
  await User.findByIdAndUpdate(user._id, { 'walkerProfile.stripeAccountId': account.id });
  return stripe.accountLinks.create({
    account,
    refresh_url: `${process.env.CLIENT_URL}/walkers/stripe-refresh`,
    return_url:  `${process.env.CLIENT_URL}/walkers/stripe-return`,
    type:        'account_onboarding',
  });
};

exports.handlePaymentSucceeded = async (intent) => {
  console.log('✅ Payment succeeded:', intent.id);
};

exports.handlePaymentFailed = async (intent) => {
  console.error('❌ Payment failed:', intent.id);
};
