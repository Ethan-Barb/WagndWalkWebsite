const User    = require('../models/User');
const Dog     = require('../models/Dog');
const Booking = require('../models/Booking');
const paymentSvc = require('../services/paymentService');

// GET /api/clients/dashboard
exports.getDashboard = async (req, res, next) => {
  try {
    const [dogs, upcoming, recent, favWalkers] = await Promise.all([
      Dog.find({ owner: req.user._id, isActive: true }),
      Booking.find({ client: req.user._id, status: { $in: ['pending', 'accepted'] }, scheduledDate: { $gte: new Date() } })
        .populate('walker', 'firstName lastName profilePhoto walkerProfile')
        .populate('dogs').sort({ scheduledDate: 1 }).limit(5),
      Booking.find({ client: req.user._id, status: { $in: ['completed', 'cancelled'] } })
        .populate('walker', 'firstName lastName profilePhoto')
        .populate('dogs', 'name').sort({ scheduledDate: -1 }).limit(5),
      Booking.aggregate([
        { $match: { client: req.user._id, status: 'completed' } },
        { $group: { _id: '$walker', count: { $sum: 1 } } },
        { $sort: { count: -1 } }, { $limit: 3 },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'walker' } },
        { $unwind: '$walker' },
        { $project: { 'walker.firstName': 1, 'walker.lastName': 1, 'walker.profilePhoto': 1, 'walker.walkerProfile.averageRating': 1, count: 1 } },
      ]),
    ]);
    res.json({ dogs, upcomingBookings: upcoming, recentBookings: recent, favoriteWalkers: favWalkers });
  } catch (err) { next(err); }
};

// GET  /api/clients/dogs
exports.getDogs = async (req, res, next) => {
  try {
    const dogs = await Dog.find({ owner: req.user._id, isActive: true });
    res.json({ dogs });
  } catch (err) { next(err); }
};

// POST /api/clients/dogs
exports.createDog = async (req, res, next) => {
  try {
    const dog = await Dog.create({ ...req.body, owner: req.user._id });
    res.status(201).json({ dog });
  } catch (err) { next(err); }
};

// PATCH /api/clients/dogs/:id
exports.updateDog = async (req, res, next) => {
  try {
    const dog = await Dog.findOneAndUpdate(
      { _id: req.params.id, owner: req.user._id },
      req.body, { new: true, runValidators: true }
    );
    if (!dog) return res.status(404).json({ error: 'Dog not found.' });
    res.json({ dog });
  } catch (err) { next(err); }
};

// DELETE /api/clients/dogs/:id
exports.deleteDog = async (req, res, next) => {
  try {
    const dog = await Dog.findOneAndUpdate(
      { _id: req.params.id, owner: req.user._id },
      { isActive: false }, { new: true }
    );
    if (!dog) return res.status(404).json({ error: 'Dog not found.' });
    res.json({ message: 'Dog removed.' });
  } catch (err) { next(err); }
};

// GET /api/clients/payment-history
exports.getPaymentHistory = async (req, res, next) => {
  try {
    const bookings = await Booking.find({ client: req.user._id, paymentStatus: { $in: ['paid', 'refunded'] } })
      .select('scheduledDate totalPrice tipAmount paymentStatus status walker dogs')
      .populate('walker', 'firstName lastName')
      .populate('dogs', 'name')
      .sort({ createdAt: -1 });
    res.json({ bookings });
  } catch (err) { next(err); }
};

// POST /api/clients/setup-payment
exports.setupPayment = async (req, res, next) => {
  try {
    const { paymentMethodId } = req.body;
    let customerId = req.user.stripeCustomerId;
    if (!customerId) {
      const customer = await paymentSvc.createStripeCustomer(req.user, paymentMethodId);
      customerId = customer.id;
      await User.findByIdAndUpdate(req.user._id, { stripeCustomerId: customerId });
    } else {
      await paymentSvc.attachPaymentMethod(customerId, paymentMethodId);
    }
    const intent = await paymentSvc.createSetupIntent(customerId);
    res.json({ clientSecret: intent.client_secret });
  } catch (err) { next(err); }
};
