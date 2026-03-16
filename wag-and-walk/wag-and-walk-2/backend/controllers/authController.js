const jwt  = require('jsonwebtoken');
const { v4: uuid } = require('uuid');
const User = require('../models/User');
const notif = require('../services/notificationService');

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET || 'dev_secret', {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

// POST /api/auth/register
exports.register = async (req, res, next) => {
  try {
    const { firstName, lastName, email, password, phone, role, address, walkerProfile } = req.body;

    if (role && !['client', 'walker'].includes(role))
      return res.status(400).json({ error: 'Invalid role.' });

    if (await User.findOne({ email }))
      return res.status(409).json({ error: 'Email already registered.' });

    const verificationToken = uuid();
    const userData = { firstName, lastName, email, password, phone, role: role || 'client', address, emailVerificationToken: verificationToken };
    if (role === 'walker' && walkerProfile) userData.walkerProfile = walkerProfile;

    const user = await User.create(userData);

    // Fire-and-forget welcome email
    notif.sendWelcomeEmail(user, verificationToken).catch(console.error);

    res.status(201).json({
      message: 'Account created! Check your email to verify.',
      token: signToken(user._id),
      user: user.toSafeObject(),
    });
  } catch (err) { next(err); }
};

// POST /api/auth/login
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email and password required.' });

    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password)))
      return res.status(401).json({ error: 'Invalid email or password.' });

    if (!user.isActive)
      return res.status(403).json({ error: 'Account deactivated. Contact support.' });

    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    res.json({ token: signToken(user._id), user: user.toSafeObject() });
  } catch (err) { next(err); }
};

// GET /api/auth/me
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    res.json({ user: user.toSafeObject() });
  } catch (err) { next(err); }
};

// PATCH /api/auth/update-profile
exports.updateProfile = async (req, res, next) => {
  try {
    const allowed = ['firstName', 'lastName', 'phone', 'address', 'notificationPrefs', 'profilePhoto'];
    const updates = {};
    allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true, runValidators: true });
    res.json({ user: user.toSafeObject() });
  } catch (err) { next(err); }
};

// POST /api/auth/change-password
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id).select('+password');
    if (!(await user.comparePassword(currentPassword)))
      return res.status(401).json({ error: 'Current password incorrect.' });
    user.password = newPassword;
    await user.save();
    res.json({ message: 'Password updated.' });
  } catch (err) { next(err); }
};

// GET /api/auth/verify-email/:token
exports.verifyEmail = async (req, res, next) => {
  try {
    const user = await User.findOne({ emailVerificationToken: req.params.token });
    if (!user) return res.status(400).json({ error: 'Invalid or expired token.' });
    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    await user.save({ validateBeforeSave: false });
    res.json({ message: 'Email verified!' });
  } catch (err) { next(err); }
};
