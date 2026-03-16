const User    = require('../models/User');
const Booking = require('../models/Booking');
const paymentSvc = require('../services/paymentService');

// GET /api/walkers
exports.getWalkers = async (req, res, next) => {
  try {
    const { available, page = 1, limit = 12 } = req.query;
    const q = { role: 'walker', isActive: true };
    if (available === 'true') q['walkerProfile.isAvailable'] = true;

    const [walkers, total] = await Promise.all([
      User.find(q)
        .select('firstName lastName profilePhoto walkerProfile address createdAt')
        .limit(+limit).skip((+page - 1) * +limit),
      User.countDocuments(q),
    ]);
    res.json({ walkers, total, page: +page, pages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
};

// GET /api/walkers/dashboard
exports.getDashboard = async (req, res, next) => {
  try {
    const walker = await User.findById(req.user._id);
    const [upcoming, recent] = await Promise.all([
      Booking.find({ walker: req.user._id, status: { $in: ['pending', 'accepted'] }, scheduledDate: { $gte: new Date() } })
        .populate('client', 'firstName lastName phone').populate('dogs')
        .sort({ scheduledDate: 1 }).limit(10),
      Booking.find({ walker: req.user._id, status: 'completed' })
        .populate('client', 'firstName lastName').populate('dogs', 'name')
        .sort({ completedAt: -1 }).limit(5),
    ]);
    res.json({ walker: walker.toSafeObject(), upcomingWalks: upcoming, recentWalks: recent });
  } catch (err) { next(err); }
};

// GET /api/walkers/earnings
exports.getEarnings = async (req, res, next) => {
  try {
    const { month, year } = req.query;
    const y  = +(year  || new Date().getFullYear());
    const m  = +(month || new Date().getMonth() + 1) - 1;
    const start = new Date(y, m, 1);
    const end   = new Date(y, m + 1, 0, 23, 59, 59);

    const earnings = await Booking.find({
      walker: req.user._id, status: 'completed',
      completedAt: { $gte: start, $lte: end },
    }).select('totalPrice tipAmount completedAt scheduledDate client dogs')
      .populate('client', 'firstName lastName')
      .populate('dogs', 'name');

    const totals = earnings.reduce(
      (a, b) => ({ earnings: a.earnings + b.totalPrice * 0.8, tips: a.tips + b.tipAmount, walks: a.walks + 1 }),
      { earnings: 0, tips: 0, walks: 0 }
    );

    res.json({ earnings, totals, period: { month: m + 1, year: y } });
  } catch (err) { next(err); }
};

// GET /api/walkers/:id
exports.getWalkerProfile = async (req, res, next) => {
  try {
    const walker = await User.findOne({ _id: req.params.id, role: 'walker', isActive: true })
      .select('firstName lastName profilePhoto walkerProfile address createdAt');
    if (!walker) return res.status(404).json({ error: 'Walker not found.' });

    const reviews = await Booking.find({ walker: walker._id, 'review.rating': { $exists: true } })
      .select('review scheduledDate').populate('client', 'firstName')
      .sort({ scheduledDate: -1 }).limit(5);

    res.json({ walker, reviews });
  } catch (err) { next(err); }
};

// PATCH /api/walkers/profile
exports.updateWalkerProfile = async (req, res, next) => {
  try {
    const { bio, experience, availability, isAvailable, serviceRadius, age } = req.body;
    const upd = {};
    if (bio          !== undefined) upd['walkerProfile.bio']           = bio;
    if (experience   !== undefined) upd['walkerProfile.experience']    = experience;
    if (availability !== undefined) upd['walkerProfile.availability']  = availability;
    if (isAvailable  !== undefined) upd['walkerProfile.isAvailable']   = isAvailable;
    if (serviceRadius!== undefined) upd['walkerProfile.serviceRadius'] = serviceRadius;
    if (age          !== undefined) upd['walkerProfile.age']           = age;

    const user = await User.findByIdAndUpdate(req.user._id, upd, { new: true, runValidators: true });
    res.json({ user: user.toSafeObject() });
  } catch (err) { next(err); }
};

// POST /api/walkers/stripe-connect
exports.setupStripeConnect = async (req, res, next) => {
  try {
    const link = await paymentSvc.createStripeConnectAccount(req.user);
    res.json({ url: link.url });
  } catch (err) { next(err); }
};
