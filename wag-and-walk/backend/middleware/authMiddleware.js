const jwt  = require('jsonwebtoken');
const User = require('../models/User');

module.exports = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer '))
      return res.status(401).json({ error: 'No token provided.' });

    const token   = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret');

    const user = await User.findById(decoded.id).select('-password');
    if (!user || !user.isActive)
      return res.status(401).json({ error: 'Invalid token or account deactivated.' });

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError')
      return res.status(401).json({ error: 'Token expired. Please log in again.' });
    return res.status(401).json({ error: 'Invalid token.' });
  }
};
