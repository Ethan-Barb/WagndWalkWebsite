const User    = require('../models/User');
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');

// GET /api/admin/dashboard
exports.getDashboard = async (req, res, next) => {
  try {
    const [userStats, bookingStats, revenueStats, recentBookings, recentUsers] = await Promise.all([
      User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
      Booking.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Booking.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: null, totalRevenue: { $sum: '$totalPrice' }, totalTips: { $sum: '$tipAmount' }, count: { $sum: 1 } } },
      ]),
      Booking.find().sort({ createdAt: -1 }).limit(10)
        .populate('client', 'firstName lastName')
        .populate('walker', 'firstName lastName'),
      User.find().sort({ createdAt: -1 }).limit(10)
        .select('firstName lastName email role createdAt isActive'),
    ]);

    res.json({ userStats, bookingStats, revenueStats: revenueStats[0] || {}, recentBookings, recentUsers });
  } catch (err) { next(err); }
};

// GET /api/admin/users
exports.getUsers = async (req, res, next) => {
  try {
    const { role, search, page = 1, limit = 20, isActive } = req.query;
    const q = {};
    if (role) q.role = role;
    if (isActive !== undefined) q.isActive = isActive === 'true';
    if (search) {
      q.$or = [
        { firstName: new RegExp(search, 'i') },
        { lastName:  new RegExp(search, 'i') },
        { email:     new RegExp(search, 'i') },
      ];
    }

    const [users, total] = await Promise.all([
      User.find(q).select('-password -emailVerificationToken -passwordResetToken')
        .sort({ createdAt: -1 }).limit(+limit).skip((+page - 1) * +limit),
      User.countDocuments(q),
    ]);

    res.json({ users, total, page: +page, pages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
};

// PATCH /api/admin/users/:id
exports.updateUser = async (req, res, next) => {
  try {
    const { isActive, role } = req.body;
    const upd = {};
    if (isActive !== undefined) upd.isActive = isActive;
    if (role)                   upd.role      = role;

    const user = await User.findByIdAndUpdate(req.params.id, upd, { new: true }).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found.' });
    res.json({ user });
  } catch (err) { next(err); }
};

// GET /api/admin/bookings
exports.getBookings = async (req, res, next) => {
  try {
    const { status, date, page = 1, limit = 20 } = req.query;
    const q = {};
    if (status) q.status = status;
    if (date) {
      const d = new Date(date);
      q.scheduledDate = { $gte: d, $lt: new Date(d.getTime() + 86400000) };
    }

    const [bookings, total] = await Promise.all([
      Booking.find(q)
        .populate('client', 'firstName lastName email phone')
        .populate('walker', 'firstName lastName email phone')
        .populate('dogs', 'name breed')
        .sort({ scheduledDate: -1 }).limit(+limit).skip((+page - 1) * +limit),
      Booking.countDocuments(q),
    ]);

    res.json({ bookings, total, page: +page, pages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
};

// PATCH /api/admin/bookings/:id
exports.updateBooking = async (req, res, next) => {
  try {
    const { status, walkerId, adminNotes, scheduledDate, startTime, endTime } = req.body;
    const upd = {};
    if (status)        upd.status        = status;
    if (walkerId)      upd.walker        = walkerId;
    if (adminNotes)    upd.adminNotes    = adminNotes;
    if (scheduledDate) upd.scheduledDate = scheduledDate;
    if (startTime)     upd.startTime     = startTime;
    if (endTime)       upd.endTime       = endTime;

    const booking = await Booking.findByIdAndUpdate(req.params.id, upd, { new: true })
      .populate('client walker dogs');
    if (!booking) return res.status(404).json({ error: 'Booking not found.' });
    res.json({ booking });
  } catch (err) { next(err); }
};

// DELETE /api/admin/bookings/:id  (cancel)
exports.cancelBooking = async (req, res, next) => {
  try {
    const booking = await Booking.findByIdAndUpdate(req.params.id, {
      status:             'cancelled',
      cancelledBy:        'admin',
      cancellationReason: req.body.reason || 'Cancelled by admin',
      cancelledAt:        new Date(),
    }, { new: true });
    if (!booking) return res.status(404).json({ error: 'Booking not found.' });
    res.json({ booking });
  } catch (err) { next(err); }
};

// GET /api/admin/analytics
exports.getAnalytics = async (req, res, next) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [dailyBookings, topWalkers, revenueByMonth] = await Promise.all([
      Booking.aggregate([
        { $match: { createdAt: { $gte: thirtyDaysAgo } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 }, revenue: { $sum: '$totalPrice' } } },
        { $sort: { _id: 1 } },
      ]),
      Booking.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: '$walker', totalWalks: { $sum: 1 }, totalRevenue: { $sum: '$totalPrice' }, avgRating: { $avg: '$review.rating' } } },
        { $sort: { totalWalks: -1 } }, { $limit: 10 },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'walker' } },
        { $unwind: '$walker' },
      ]),
      Booking.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$completedAt' } }, revenue: { $sum: '$totalPrice' }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
    ]);

    res.json({ dailyBookings, topWalkers, revenueByMonth });
  } catch (err) { next(err); }
};
