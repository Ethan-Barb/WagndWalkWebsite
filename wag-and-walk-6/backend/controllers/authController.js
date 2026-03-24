const jwt  = require('jsonwebtoken');
const User = require('../models/User');

const signToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET || 'dev-secret', {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

/* ── Register ─────────────────────────────────── */
exports.register = async (req, res, next) => {
  try {
    const { firstName, lastName, email, password, role, phone, address, walkerProfile } = req.body;

    if (!firstName) return res.status(400).json({ error: 'First name is required' });
    if (!lastName)  return res.status(400).json({ error: 'Last name is required' });
    if (!email || !/^\S+@\S+\.\S+$/.test(email))
      return res.status(400).json({ error: 'Valid email is required' });
    if (!password || password.length < 8)
      return res.status(400).json({ error: 'Password must be at least 8 characters' });

    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) return res.status(409).json({ error: 'Email already registered' });

    const userData = { firstName, lastName, email, password, phone, address };
    if (role === 'walker' || role === 'client') userData.role = role;

    if (role === 'walker' && walkerProfile) {
      userData.walkerProfile = {
        age:         walkerProfile.age,
        bio:         walkerProfile.bio || '',
        experience:  walkerProfile.experience || '',
        isAvailable: walkerProfile.isAvailable !== undefined ? walkerProfile.isAvailable : true,
        availability: walkerProfile.availability || [],
      };
    }

    const user  = await User.create(userData);
    const token = signToken(user._id);

    res.status(201).json({ token, user: user.toSafeObject() });
  } catch (err) {
    next(err);
  }
};

/* ── Login ────────────────────────────────────── */
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email and password are required' });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    const match = await user.comparePassword(password);
    if (!match) return res.status(401).json({ error: 'Invalid email or password' });

    if (!user.isActive)
      return res.status(403).json({ error: 'Account is deactivated' });

    const token = signToken(user._id);
    res.json({ token, user: user.toSafeObject() });
  } catch (err) {
    next(err);
  }
};

/* ── Get current user ─────────────────────────── */
exports.getMe = async (req, res) => {
  res.json({ user: req.user.toSafeObject() });
};

/* ── Update profile ───────────────────────────── */
exports.updateProfile = async (req, res, next) => {
  try {
    const allowed = ['firstName', 'lastName', 'phone', 'address', 'profilePhoto'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    const user = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true, runValidators: true,
    }).select('-password');

    res.json({ user: user.toSafeObject() });
  } catch (err) {
    next(err);
  }
};

/* ── Change password ──────────────────────────── */
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
      return res.status(400).json({ error: 'Current and new passwords are required' });
    if (newPassword.length < 8)
      return res.status(400).json({ error: 'New password must be at least 8 characters' });

    const user = await User.findById(req.user._id);
    const match = await user.comparePassword(currentPassword);
    if (!match) return res.status(401).json({ error: 'Current password is incorrect' });

    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password updated' });
  } catch (err) {
    next(err);
  }
};
