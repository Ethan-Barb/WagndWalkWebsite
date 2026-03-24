const User    = require('../models/User');
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');

/* ── Admin dashboard overview ─────────────────── */
exports.getDashboard = async (req, res, next) => {
  try {
    const [
      totalClients, totalWalkers, totalBookings,
      pendingBookings, completedBookings,
      recentBookings, recentUsers,
    ] = await Promise.all([
      User.countDocuments({ role: 'client', isActive: true }),
      User.countDocuments({ role: 'walker', isActive: true }),
      Booking.countDocuments(),
      Booking.countDocuments({ status: 'pending' }),
      Booking.countDocuments({ status: 'completed' }),

      Booking.find()
        .populate('client', 'firstName lastName')
        .populate('walker', 'firstName lastName')
        .sort({ createdAt: -1 })
        .limit(10),

      User.find()
        .select('firstName lastName email role createdAt isActive')
        .sort({ createdAt: -1 })
        .limit(10),
    ]);

    // Revenue
    const revenueAgg = await Booking.aggregate([
      { $match: { status: 'completed' } },
      { $group: {
        _id: null,
        totalRevenue: { $sum: '$totalPrice' },
        totalTips:    { $sum: '$tipAmount' },
        count:        { $sum: 1 },
      }},
    ]);
    const rev = revenueAgg[0] || { totalRevenue: 0, totalTips: 0, count: 0 };

    res.json({
      userStats:    { totalClients, totalWalkers },
      bookingStats: { totalBookings, pendingBookings, completedBookings },
      revenueStats: {
        totalRevenue:    rev.totalRevenue,
        platformRevenue: Math.round(rev.totalRevenue * 0.2),
        totalTips:       rev.totalTips,
      },
      recentBookings,
      recentUsers,
    });
  } catch (err) {
    next(err);
  }
};

/* ── Analytics ────────────────────────────────── */
exports.getAnalytics = async (req, res, next) => {
  try {
    // Daily bookings (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const dailyBookings = await Booking.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      { $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        count: { $sum: 1 },
        revenue: { $sum: '$totalPrice' },
      }},
      { $sort: { _id: 1 } },
    ]);

    // Top walkers
    const topWalkers = await User.find({ role: 'walker' })
      .select('firstName lastName walkerProfile.averageRating walkerProfile.totalWalks walkerProfile.totalEarnings')
      .sort({ 'walkerProfile.totalWalks': -1 })
      .limit(10);

    // Revenue by month
    const revenueByMonth = await Booking.aggregate([
      { $match: { status: 'completed' } },
      { $group: {
        _id: { $dateToString: { format: '%Y-%m', date: '$completedAt' } },
        revenue: { $sum: '$totalPrice' },
        tips:    { $sum: '$tipAmount' },
        walks:   { $sum: 1 },
      }},
      { $sort: { _id: -1 } },
      { $limit: 12 },
    ]);

    res.json({ dailyBookings, topWalkers, revenueByMonth });
  } catch (err) {
    next(err);
  }
};

/* ── List users ───────────────────────────────── */
exports.getUsers = async (req, res, next) => {
  try {
    const { role, search, isActive, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (role) filter.role = role;
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName:  { $regex: search, $options: 'i' } },
        { email:     { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [users, total] = await Promise.all([
      User.find(filter)
        .select('-password')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      User.countDocuments(filter),
    ]);

    res.json({ users, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    next(err);
  }
};

/* ── Update user (admin) ──────────────────────── */
exports.updateUser = async (req, res, next) => {
  try {
    const { isActive, role } = req.body;
    const updates = {};
    if (isActive !== undefined) updates.isActive = isActive;
    if (role) updates.role = role;

    const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true }).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({ user });
  } catch (err) {
    next(err);
  }
};

/* ── List all bookings (admin) ────────────────── */
exports.getBookings = async (req, res, next) => {
  try {
    const { status, date, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (date) {
      const d = new Date(date);
      const start = new Date(d); start.setHours(0, 0, 0, 0);
      const end   = new Date(d); end.setHours(23, 59, 59, 999);
      filter.scheduledDate = { $gte: start, $lte: end };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [bookings, total] = await Promise.all([
      Booking.find(filter)
        .populate('client', 'firstName lastName email')
        .populate('walker', 'firstName lastName email')
        .populate('dogs', 'name breed size')
        .sort({ scheduledDate: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Booking.countDocuments(filter),
    ]);

    res.json({ bookings, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    next(err);
  }
};

/* ── Update booking (admin) ───────────────────── */
exports.updateBooking = async (req, res, next) => {
  try {
    const { status, adminNotes, scheduledDate, startTime, endTime, walker } = req.body;
    const updates = {};
    if (status)        updates.status = status;
    if (adminNotes)    updates.adminNotes = adminNotes;
    if (scheduledDate) updates.scheduledDate = scheduledDate;
    if (startTime)     updates.startTime = startTime;
    if (endTime)       updates.endTime = endTime;
    if (walker)        updates.walker = walker;

    if (status === 'accepted')  updates.acceptedAt  = new Date();
    if (status === 'completed') updates.completedAt = new Date();
    if (status === 'cancelled') {
      updates.cancelledAt = new Date();
      updates.cancelledBy = 'admin';
      updates.cancellationReason = req.body.reason || 'Admin cancelled';
    }

    const booking = await Booking.findByIdAndUpdate(req.params.id, updates, { new: true })
      .populate('client', 'firstName lastName')
      .populate('walker', 'firstName lastName')
      .populate('dogs', 'name breed size');

    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    res.json({ booking });
  } catch (err) {
    next(err);
  }
};

/* ── Delete/cancel booking (admin) ────────────── */
exports.deleteBooking = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    booking.status = 'cancelled';
    booking.cancelledAt = new Date();
    booking.cancelledBy = 'admin';
    booking.cancellationReason = req.body.reason || 'Cancelled by admin';
    await booking.save();

    res.json({ message: 'Booking cancelled', booking });
  } catch (err) {
    next(err);
  }
};
