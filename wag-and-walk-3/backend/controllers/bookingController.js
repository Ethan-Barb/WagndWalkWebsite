const Booking   = require('../models/Booking');
const User      = require('../models/User');
const Dog       = require('../models/Dog');
const paymentSvc  = require('../services/paymentService');
const scheduleSvc = require('../services/schedulingService');
const notif       = require('../services/notificationService');

const PRICE_PER_HOUR      = 2000;  // $20.00 cents
const ADDITIONAL_DOG_FEE  = 500;   // $5.00 cents
const PLATFORM_FEE        = 0.20;  // 20%

// POST /api/bookings
exports.createBooking = async (req, res, next) => {
  try {
    const { walkerId, dogIds, scheduledDate, startTime, endTime, durationMinutes, pickupAddress, specialInstructions, paymentMethodId } = req.body;

    // Validate dogs belong to client
    const dogs = await Dog.find({ _id: { $in: dogIds }, owner: req.user._id, isActive: true });
    if (dogs.length !== dogIds.length)
      return res.status(400).json({ error: 'One or more dogs not found.' });

    // Price
    const basePrice  = Math.round(((durationMinutes || 60) / 60) * PRICE_PER_HOUR);
    const addOnPrice = (dogs.length - 1) * ADDITIONAL_DOG_FEE;
    const totalPrice = basePrice + addOnPrice;

    // Walker availability check
    if (walkerId) {
      const avail = await scheduleSvc.checkWalkerAvailability(walkerId, scheduledDate, startTime, endTime);
      if (!avail) return res.status(409).json({ error: 'Walker not available at that time.' });
    }

    // Create Stripe PaymentIntent (manual capture = hold funds)
    const intent = await paymentSvc.createPaymentIntent(totalPrice, req.user.stripeCustomerId, paymentMethodId);

    const booking = await Booking.create({
      client: req.user._id,
      walker: walkerId || null,
      dogs:   dogIds,
      scheduledDate,
      startTime,
      endTime,
      durationMinutes: durationMinutes || 60,
      pickupAddress,
      specialInstructions,
      basePrice,
      addOnPrice,
      totalPrice,
      stripePaymentIntentId: intent.id,
    });

    await booking.populate(['client', 'walker', 'dogs']);

    if (walkerId) {
      const walker = await User.findById(walkerId);
      if (walker) notif.sendBookingRequest(walker, booking).catch(console.error);
    }

    res.status(201).json({ booking, clientSecret: intent.client_secret });
  } catch (err) { next(err); }
};

// GET /api/bookings
exports.getMyBookings = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const q = {};
    if (req.user.role === 'client') q.client = req.user._id;
    if (req.user.role === 'walker') q.walker = req.user._id;
    if (status) q.status = status;

    const [bookings, total] = await Promise.all([
      Booking.find(q)
        .populate('client', 'firstName lastName phone profilePhoto')
        .populate('walker', 'firstName lastName phone profilePhoto walkerProfile')
        .populate('dogs')
        .sort({ scheduledDate: -1 })
        .limit(Number(limit))
        .skip((Number(page) - 1) * Number(limit)),
      Booking.countDocuments(q),
    ]);

    res.json({ bookings, total, page: +page, pages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
};

// GET /api/bookings/:id
exports.getBooking = async (req, res, next) => {
  try {
    const b = await Booking.findById(req.params.id)
      .populate('client', 'firstName lastName phone email profilePhoto address')
      .populate('walker', 'firstName lastName phone profilePhoto walkerProfile')
      .populate('dogs');

    if (!b) return res.status(404).json({ error: 'Booking not found.' });

    const isClient = b.client._id.toString() === req.user._id.toString();
    const isWalker = b.walker && b.walker._id.toString() === req.user._id.toString();
    if (!isClient && !isWalker && req.user.role !== 'admin')
      return res.status(403).json({ error: 'Not authorized.' });

    res.json({ booking: b });
  } catch (err) { next(err); }
};

// PATCH /api/bookings/:id/accept
exports.acceptBooking = async (req, res, next) => {
  try {
    const b = await Booking.findById(req.params.id).populate('client');
    if (!b) return res.status(404).json({ error: 'Booking not found.' });
    if (b.walker?.toString() !== req.user._id.toString())
      return res.status(403).json({ error: 'Not authorized.' });
    if (b.status !== 'pending')
      return res.status(400).json({ error: 'Booking not in pending state.' });

    // Capture held payment
    await paymentSvc.capturePaymentIntent(b.stripePaymentIntentId);
    b.status        = 'accepted';
    b.acceptedAt    = new Date();
    b.paymentStatus = 'paid';
    b.paidAt        = new Date();
    await b.save();

    notif.sendBookingConfirmation(b.client, b).catch(console.error);
    res.json({ booking: b });
  } catch (err) { next(err); }
};

// PATCH /api/bookings/:id/decline
exports.declineBooking = async (req, res, next) => {
  try {
    const b = await Booking.findById(req.params.id).populate('client');
    if (!b) return res.status(404).json({ error: 'Booking not found.' });
    const isWalker = b.walker?.toString() === req.user._id.toString();
    if (!isWalker && req.user.role !== 'admin')
      return res.status(403).json({ error: 'Not authorized.' });

    b.status             = 'declined';
    b.cancelledBy        = req.user.role === 'admin' ? 'admin' : 'walker';
    b.cancellationReason = req.body.reason || 'Declined by walker';
    b.cancelledAt        = new Date();
    await b.save();

    await paymentSvc.cancelPaymentIntent(b.stripePaymentIntentId);
    notif.sendBookingCancelled(b.client, b).catch(console.error);
    res.json({ booking: b });
  } catch (err) { next(err); }
};

// PATCH /api/bookings/:id/cancel
exports.cancelBooking = async (req, res, next) => {
  try {
    const b = await Booking.findById(req.params.id).populate('walker');
    if (!b) return res.status(404).json({ error: 'Booking not found.' });

    const isClient = b.client.toString() === req.user._id.toString();
    if (!isClient && req.user.role !== 'admin')
      return res.status(403).json({ error: 'Not authorized.' });
    if (['completed', 'cancelled'].includes(b.status))
      return res.status(400).json({ error: 'Cannot cancel a completed or already cancelled booking.' });

    b.status             = 'cancelled';
    b.cancelledBy        = isClient ? 'client' : 'admin';
    b.cancellationReason = req.body.reason || 'Cancelled';
    b.cancelledAt        = new Date();

    if (b.paymentStatus === 'paid') {
      await paymentSvc.refundPaymentIntent(b.stripePaymentIntentId);
      b.paymentStatus = 'refunded';
    } else {
      await paymentSvc.cancelPaymentIntent(b.stripePaymentIntentId);
    }
    await b.save();

    if (b.walker) notif.sendBookingCancelled(b.walker, b).catch(console.error);
    res.json({ booking: b });
  } catch (err) { next(err); }
};

// PATCH /api/bookings/:id/complete
exports.completeBooking = async (req, res, next) => {
  try {
    const b = await Booking.findById(req.params.id).populate('client walker');
    if (!b) return res.status(404).json({ error: 'Booking not found.' });

    const isWalker = b.walker._id.toString() === req.user._id.toString();
    if (!isWalker && req.user.role !== 'admin')
      return res.status(403).json({ error: 'Not authorized.' });
    if (!['accepted', 'in_progress'].includes(b.status))
      return res.status(400).json({ error: 'Booking must be accepted or in_progress.' });

    b.status      = 'completed';
    b.completedAt = new Date();
    await b.save();

    // Transfer payout to walker
    await paymentSvc.transferToWalker(b);

    await User.findByIdAndUpdate(b.walker._id, {
      $inc: { 'walkerProfile.totalEarnings': Math.round(b.totalPrice * (1 - PLATFORM_FEE)), 'walkerProfile.totalWalks': 1 },
    });

    notif.sendWalkCompleted(b.client, b).catch(console.error);
    res.json({ booking: b });
  } catch (err) { next(err); }
};

// POST /api/bookings/:id/tip
exports.tipWalker = async (req, res, next) => {
  try {
    const { amount, paymentMethodId, message } = req.body;
    const b = await Booking.findById(req.params.id).populate('walker client');
    if (!b) return res.status(404).json({ error: 'Booking not found.' });
    if (b.client._id.toString() !== req.user._id.toString())
      return res.status(403).json({ error: 'Only the client can tip.' });
    if (b.status !== 'completed')
      return res.status(400).json({ error: 'Walk not completed yet.' });
    if (b.tipAmount > 0)
      return res.status(400).json({ error: 'Already tipped for this booking.' });

    const intent = await paymentSvc.createTipPayment(amount, req.user.stripeCustomerId, paymentMethodId, b);
    b.tipAmount                = amount;
    b.tipPaidAt                = new Date();
    b.stripeTipPaymentIntentId = intent.id;
    await b.save();

    await User.findByIdAndUpdate(b.walker._id, { $inc: { 'walkerProfile.totalTips': amount } });
    notif.sendTipReceived(b.walker, b, amount).catch(console.error);

    res.json({ message: 'Tip sent!', tipAmount: amount });
  } catch (err) { next(err); }
};

// POST /api/bookings/:id/review
exports.reviewWalker = async (req, res, next) => {
  try {
    const { rating, comment } = req.body;
    const b = await Booking.findById(req.params.id).populate('walker');
    if (!b) return res.status(404).json({ error: 'Booking not found.' });
    if (b.client.toString() !== req.user._id.toString())
      return res.status(403).json({ error: 'Only the client can review.' });
    if (b.status !== 'completed')
      return res.status(400).json({ error: 'Walk not completed yet.' });
    if (b.review) return res.status(400).json({ error: 'Already reviewed.' });

    b.review = { rating, comment };
    await b.save();

    const walker = await User.findById(b.walker._id);
    const newCount = walker.walkerProfile.ratingCount + 1;
    walker.walkerProfile.averageRating =
      (walker.walkerProfile.averageRating * walker.walkerProfile.ratingCount + rating) / newCount;
    walker.walkerProfile.ratingCount = newCount;
    await walker.save();

    res.json({ message: 'Review submitted.', booking: b });
  } catch (err) { next(err); }
};

// GET /api/bookings/available-slots
exports.getAvailableSlots = async (req, res, next) => {
  try {
    const { date, walkerId } = req.query;
    const slots = await scheduleSvc.getAvailableSlots(date, walkerId);
    res.json({ slots });
  } catch (err) { next(err); }
};
