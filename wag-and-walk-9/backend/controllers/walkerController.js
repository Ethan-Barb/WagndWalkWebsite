const User    = require('../models/User');
const Booking = require('../models/Booking');

/* ── Public: list available walkers ───────────── */
exports.listWalkers = async (req, res, next) => {
  try {
    const filter = { role: 'walker', isActive: true };
    if (req.query.available === 'true') filter['walkerProfile.isAvailable'] = true;

    let query = User.find(filter)
      .select('firstName lastName profilePhoto address walkerProfile')
      .sort({ 'walkerProfile.averageRating': -1 });

    if (req.query.rating) {
      filter['walkerProfile.averageRating'] = { $gte: parseFloat(req.query.rating) };
    }

    const walkers = await query;
    res.json({ walkers: walkers.map(w => w.toSafeObject()) });
  } catch (err) {
    next(err);
  }
};

/* ── Public: single walker profile ────────────── */
exports.getWalker = async (req, res, next) => {
  try {
    const walker = await User.findOne({ _id: req.params.id, role: 'walker', isActive: true })
      .select('firstName lastName profilePhoto address walkerProfile');
    if (!walker) return res.status(404).json({ error: 'Walker not found' });

    // Get recent reviews
    const reviews = await Booking.find({
      walker: walker._id,
      status: 'completed',
      'review.rating': { $exists: true },
    })
      .select('review client scheduledDate')
      .populate('client', 'firstName lastName')
      .sort({ 'review.createdAt': -1 })
      .limit(10);

    res.json({ walker: walker.toSafeObject(), reviews });
  } catch (err) {
    next(err);
  }
};

/* ── Walker dashboard ─────────────────────────── */
exports.getDashboard = async (req, res, next) => {
  try {
    const now = new Date();
    const walkerId = req.user._id;

    const [upcomingWalks, pendingWalks, recentWalks] = await Promise.all([
      Booking.find({
        walker: walkerId,
        status: 'accepted',
        scheduledDate: { $gte: now },
      })
        .populate('client', 'firstName lastName phone')
        .populate('dogs', 'name breed size specialInstructions')
        .sort({ scheduledDate: 1 })
        .limit(10),

      Booking.find({ walker: walkerId, status: 'pending' })
        .populate('client', 'firstName lastName phone')
        .populate('dogs', 'name breed size specialInstructions')
        .sort({ scheduledDate: 1 }),

      Booking.find({ walker: walkerId, status: 'completed' })
        .populate('client', 'firstName lastName')
        .sort({ completedAt: -1 })
        .limit(5),
    ]);

    res.json({
      walker: req.user.toSafeObject(),
      upcomingWalks,
      pendingWalks,
      recentWalks,
    });
  } catch (err) {
    next(err);
  }
};

/* ── Walker earnings ──────────────────────────── */
exports.getEarnings = async (req, res, next) => {
  try {
    const walkerId = req.user._id;
    const month = parseInt(req.query.month) || new Date().getMonth() + 1;
    const year  = parseInt(req.query.year)  || new Date().getFullYear();

    const startDate = new Date(year, month - 1, 1);
    const endDate   = new Date(year, month, 0, 23, 59, 59, 999);

    const bookings = await Booking.find({
      walker: walkerId,
      status: 'completed',
      completedAt: { $gte: startDate, $lte: endDate },
    }).sort({ completedAt: -1 });

    const totals = bookings.reduce((acc, b) => {
      acc.walks++;
      acc.earnings += b.totalPrice;
      acc.tips     += b.tipAmount || 0;
      return acc;
    }, { walks: 0, earnings: 0, tips: 0 });

    // Walker keeps 80%
    totals.walkerEarnings = Math.round(totals.earnings * 0.8);
    totals.totalIncome    = totals.walkerEarnings + totals.tips;

    res.json({ earnings: bookings, totals, month, year });
  } catch (err) {
    next(err);
  }
};

/* ── Update walker profile ────────────────────── */
exports.updateProfile = async (req, res, next) => {
  try {
    const allowed = ['bio', 'experience', 'availability', 'isAvailable', 'serviceRadius'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        updates[`walkerProfile.${key}`] = req.body[key];
      }
    }

    const user = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true, runValidators: true,
    }).select('-password');

    res.json({ walker: user.toSafeObject() });
  } catch (err) {
    next(err);
  }
};
