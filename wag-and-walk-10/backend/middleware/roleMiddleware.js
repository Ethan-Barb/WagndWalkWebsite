/**
 * Role guard middleware factory.
 * Usage: requireRole('admin')  or  requireRole('client', 'admin')
 */
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied — insufficient role' });
    }
    next();
  };
};

module.exports = requireRole;
