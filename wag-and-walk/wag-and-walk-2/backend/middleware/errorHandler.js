module.exports = (err, req, res, next) => {
  let status  = err.statusCode || 500;
  let message = err.message   || 'Internal Server Error';

  if (err.name === 'ValidationError') {
    status  = 400;
    message = Object.values(err.errors).map(e => e.message).join(', ');
  }
  if (err.code === 11000) {
    status  = 409;
    const field = Object.keys(err.keyValue)[0];
    message = `${field.charAt(0).toUpperCase() + field.slice(1)} already exists.`;
  }
  if (err.name === 'CastError') {
    status  = 400;
    message = `Invalid ${err.path}: ${err.value}`;
  }
  if (err.name === 'JsonWebTokenError') {
    status  = 401;
    message = 'Invalid token.';
  }

  if (process.env.NODE_ENV === 'development') {
    console.error('❌', err);
    return res.status(status).json({ error: message, stack: err.stack });
  }
  res.status(status).json({ error: message });
};
