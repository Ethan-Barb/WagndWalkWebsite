const Dog     = require('../models/Dog');
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');

/* ── Client dashboard ─────────────────────────── */
exports.getDashboard = async (req, res, next) => {
  try {
    const clientId = req.user._id;
    const now = new Date();

    const [dogs, upcomingBookings, recentBookings] = await Promise.all([
      Dog.find({ owner: clientId }),

      Booking.find({
        client: clientId,
        status: { $in: ['pending', 'accepted'] },
        scheduledDate: { $gte: now },
      })
        .populate('walker', 'firstName lastName walkerProfile.averageRating profilePhoto')
        .populate('dogs', 'name breed size')
        .sort({ scheduledDate: 1 })
        .limit(10),

      Booking.find({
        client: clientId,
        status: 'completed',
      })
        .populate('walker', 'firstName lastName walkerProfile.averageRating')
        .populate('dogs', 'name breed size')
        .sort({ completedAt: -1 })
        .limit(5),
    ]);

    res.json({ dogs, upcomingBookings, recentBookings });
  } catch (err) {
    next(err);
  }
};

/* ── List dogs ────────────────────────────────── */
exports.getDogs = async (req, res, next) => {
  try {
    const dogs = await Dog.find({ owner: req.user._id });
    res.json({ dogs });
  } catch (err) {
    next(err);
  }
};

/* ── Add dog ──────────────────────────────────── */
exports.addDog = async (req, res, next) => {
  try {
    const { name, breed, size, age, weight, gender, color,
            isNeutered, isVaccinated, specialInstructions,
            medicalConditions, feedingInstructions, emergencyContact, veterinarian } = req.body;

    if (!name) return res.status(400).json({ error: 'Dog name is required' });
    if (!size) return res.status(400).json({ error: 'Dog size is required' });

    const dog = await Dog.create({
      owner: req.user._id,
      name, breed, size, age, weight, gender, color,
      isNeutered, isVaccinated, specialInstructions,
      medicalConditions, feedingInstructions, emergencyContact, veterinarian,
    });

    res.status(201).json({ dog });
  } catch (err) {
    next(err);
  }
};

/* ── Update dog ───────────────────────────────── */
exports.updateDog = async (req, res, next) => {
  try {
    const dog = await Dog.findOne({ _id: req.params.id, owner: req.user._id });
    if (!dog) return res.status(404).json({ error: 'Dog not found' });

    const allowed = ['name', 'breed', 'size', 'age', 'weight', 'gender', 'color',
      'isNeutered', 'isVaccinated', 'specialInstructions', 'medicalConditions',
      'feedingInstructions', 'emergencyContact', 'veterinarian', 'profilePhoto'];

    for (const key of allowed) {
      if (req.body[key] !== undefined) dog[key] = req.body[key];
    }

    await dog.save();
    res.json({ dog });
  } catch (err) {
    next(err);
  }
};

/* ── Delete dog ───────────────────────────────── */
exports.deleteDog = async (req, res, next) => {
  try {
    const dog = await Dog.findOneAndDelete({ _id: req.params.id, owner: req.user._id });
    if (!dog) return res.status(404).json({ error: 'Dog not found' });
    res.json({ message: 'Dog removed' });
  } catch (err) {
    next(err);
  }
};

/* ── Payment history ──────────────────────────── */
exports.getPaymentHistory = async (req, res, next) => {
  try {
    const payments = await Payment.find({ client: req.user._id })
      .populate('booking', 'scheduledDate startTime status')
      .populate('walker', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ payments });
  } catch (err) {
    next(err);
  }
};
