const Booking = require('../models/Booking');
const Dog     = require('../models/Dog');
const User    = require('../models/User');
const { isWalkerAvailable, getAvailableSlots, calculatePrice } = require('../services/schedulingService');
const notifications = require('../services/notificationService');

/* ── Create booking ───────────────────────────── */
exports.createBooking = async (req, res, next) => {
  try {
    const { walkerId, dogIds, scheduledDate, startTime, endTime,
            durationMinutes, pickupAddress, specialInstructions } = req.body;

    if (!dogIds || dogIds.length === 0)
      return res.status(400).json({ error: 'At least one dog is required' });

    // Verify dogs belong to this client
    const dogs = await Dog.find({ _id: { $in: dogIds }, owner: req.user._id });
    if (dogs.length !== dogIds.length)
      return res.status(400).json({ error: 'One or more dogs not found' });

    // Check walker exists and is available
    if (walkerId) {
      const walker = await User.findOne({ _id: walkerId, role: 'walker', isActive: true });
      if (!walker) return res.status(404).json({ error: 'Walker not found' });

      const available = await isWalkerAvailable(walkerId, scheduledDate, startTime, endTime);
      if (!available)
        return res.status(409).json({ error: 'Walker is not available for this time slot' });
    }

    // Calculate price
    const { basePrice, addOnPrice, totalPrice } = calculatePrice(
      durationMinutes || 60,
      dogIds.length
    );

    const booking = await Booking.create({
      client:  req.user._id,
      walker:  walkerId || undefined,
      dogs:    dogIds,
      scheduledDate,
      startTime,
      endTime,
      durationMinutes: durationMinutes || 60,
      pickupAddress,
      specialInstructions,
      basePrice,
      addOnPrice,
      totalPrice,
    });

    // Notify walker
    if (walkerId) {
      const walker = await User.findById(walkerId);
      if (walker) {
        notifications.sendBookingRequest(walker.email, booking).catch(() => {});
      }
    }

    const populated = await Booking.findById(booking._id)
      .populate('walker', 'firstName lastName')
      .populate('dogs', 'name breed size');

    res.status(201).json({ booking: populated });
  } catch (err) {
    next(err);
  }
};

/* ── List bookings for current user ───────────── */
exports.getBookings = async (req, res, next) => {
  try {
    const filter = {};
    if (req.user.role === 'client') filter.client = req.user._id;
    else if (req.user.role === 'walker') filter.walker = req.user._id;
    // admin sees all

    if (req.query.status) filter.status = req.query.status;

    const bookings = await Booking.find(filter)
      .populate('client', 'firstName lastName phone')
      .populate('walker', 'firstName lastName walkerProfile.averageRating')
      .populate('dogs', 'name breed size specialInstructions')
      .sort({ scheduledDate: -1 })
      .limit(50);

    res.json({ bookings });
  } catch (err) {
    next(err);
  }
};

/* ── Get single booking ───────────────────────── */
exports.getBooking = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('client', 'firstName lastName phone address')
      .populate('walker', 'firstName lastName phone walkerProfile')
      .populate('dogs');

    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    // Ensure user has access
    const uid = req.user._id.toString();
    if (req.user.role !== 'admin' &&
        booking.client._id.toString() !== uid &&
        booking.walker?._id.toString() !== uid) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ booking });
  } catch (err) {
    next(err);
  }
};

/* ── Available slots ──────────────────────────── */
exports.getAvailableSlots = async (req, res, next) => {
  try {
    const { date, walkerId } = req.query;
    if (!date) return res.status(400).json({ error: 'Date is required' });

    const slots = await getAvailableSlots(date, walkerId);
    res.json({ slots });
  } catch (err) {
    next(err);
  }
};

/* ── Accept booking (walker) ──────────────────── */
exports.acceptBooking = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    if (req.user.role !== 'walker' && req.user.role !== 'admin')
      return res.status(403).json({ error: 'Only walkers can accept bookings' });

    if (booking.walker && booking.walker.toString() !== req.user._id.toString() && req.user.role !== 'admin')
      return res.status(403).json({ error: 'Not your booking' });

    if (booking.status !== 'pending')
      return res.status(400).json({ error: `Cannot accept a ${booking.status} booking` });

    booking.status = 'accepted';
    booking.acceptedAt = new Date();
    if (!booking.walker) booking.walker = req.user._id;
    await booking.save();

    // Notify client
    const client = await User.findById(booking.client);
    if (client) notifications.sendBookingAccepted(client.email, booking).catch(() => {});

    const populated = await Booking.findById(booking._id)
      .populate('client', 'firstName lastName phone')
      .populate('walker', 'firstName lastName')
      .populate('dogs', 'name breed size');

    res.json({ booking: populated });
  } catch (err) {
    next(err);
  }
};

/* ── Decline booking (walker) ─────────────────── */
exports.declineBooking = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    if (req.user.role !== 'walker' && req.user.role !== 'admin')
      return res.status(403).json({ error: 'Only walkers can decline bookings' });

    if (booking.status !== 'pending')
      return res.status(400).json({ error: `Cannot decline a ${booking.status} booking` });

    booking.status = 'declined';
    booking.cancellationReason = req.body.reason || '';
    booking.cancelledBy = 'walker';
    await booking.save();

    const client = await User.findById(booking.client);
    if (client) notifications.sendBookingDeclined(client.email, booking).catch(() => {});

    res.json({ booking });
  } catch (err) {
    next(err);
  }
};

/* ── Cancel booking ───────────────────────────── */
exports.cancelBooking = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    if (!['pending', 'accepted'].includes(booking.status))
      return res.status(400).json({ error: `Cannot cancel a ${booking.status} booking` });

    const uid = req.user._id.toString();
    const isClient = booking.client.toString() === uid;
    const isWalker = booking.walker?.toString() === uid;
    const isAdmin  = req.user.role === 'admin';

    if (!isClient && !isWalker && !isAdmin)
      return res.status(403).json({ error: 'Access denied' });

    booking.status = 'cancelled';
    booking.cancelledAt = new Date();
    booking.cancelledBy = isAdmin ? 'admin' : (isClient ? 'client' : 'walker');
    booking.cancellationReason = req.body.reason || '';
    await booking.save();

    res.json({ booking });
  } catch (err) {
    next(err);
  }
};

/* ── Complete booking (walker) ────────────────── */
exports.completeBooking = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    if (req.user.role !== 'walker' && req.user.role !== 'admin')
      return res.status(403).json({ error: 'Only walkers can complete bookings' });

    if (booking.status !== 'accepted' && booking.status !== 'in_progress')
      return res.status(400).json({ error: `Cannot complete a ${booking.status} booking` });

    booking.status = 'completed';
    booking.completedAt = new Date();
    booking.paymentStatus = 'paid';
    booking.paidAt = new Date();
    await booking.save();

    // Update walker stats
    const walker = await User.findById(booking.walker);
    if (walker?.walkerProfile) {
      walker.walkerProfile.totalWalks += 1;
      walker.walkerProfile.totalEarnings += Math.round(booking.totalPrice * 0.8);
      await walker.save();
    }

    // Notify client
    const client = await User.findById(booking.client);
    if (client) notifications.sendBookingCompleted(client.email, booking).catch(() => {});

    const populated = await Booking.findById(booking._id)
      .populate('client', 'firstName lastName')
      .populate('walker', 'firstName lastName')
      .populate('dogs', 'name breed size');

    res.json({ booking: populated });
  } catch (err) {
    next(err);
  }
};

/* ── Tip walker ───────────────────────────────── */
exports.tipWalker = async (req, res, next) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0)
      return res.status(400).json({ error: 'Tip amount must be greater than 0' });

    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    if (booking.client.toString() !== req.user._id.toString())
      return res.status(403).json({ error: 'Only the client can tip' });

    if (booking.status !== 'completed')
      return res.status(400).json({ error: 'Can only tip for completed walks' });

    booking.tipAmount = amount;
    booking.tipPaidAt = new Date();
    await booking.save();

    // Update walker tip total
    const walker = await User.findById(booking.walker);
    if (walker?.walkerProfile) {
      walker.walkerProfile.totalTips += amount;
      await walker.save();
    }

    if (walker) notifications.sendTipReceived(walker.email, amount).catch(() => {});

    res.json({ booking, message: `Tip of $${(amount / 100).toFixed(2)} sent!` });
  } catch (err) {
    next(err);
  }
};

/* ── Review walker ────────────────────────────── */
exports.reviewWalker = async (req, res, next) => {
  try {
    const { rating, comment } = req.body;
    if (!rating || rating < 1 || rating > 5)
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });

    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    if (booking.client.toString() !== req.user._id.toString())
      return res.status(403).json({ error: 'Only the client can review' });

    if (booking.status !== 'completed')
      return res.status(400).json({ error: 'Can only review completed walks' });

    if (booking.review?.rating)
      return res.status(409).json({ error: 'Booking already reviewed' });

    booking.review = { rating, comment: comment || '', createdAt: new Date() };
    await booking.save();

    // Update walker average rating
    const walker = await User.findById(booking.walker);
    if (walker?.walkerProfile) {
      const wp = walker.walkerProfile;
      const newCount  = wp.ratingCount + 1;
      const newAvg    = ((wp.averageRating * wp.ratingCount) + rating) / newCount;
      wp.averageRating = Math.round(newAvg * 100) / 100;
      wp.ratingCount   = newCount;
      await walker.save();
    }

    res.json({ booking });
  } catch (err) {
    next(err);
  }
};
