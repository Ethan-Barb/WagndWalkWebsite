require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const rateLimit = require('express-rate-limit');
const path    = require('path');

const connectDB    = require('./config/database');
const errorHandler = require('./middleware/errorHandler');

const authRoutes    = require('./routes/authRoutes');
const walkerRoutes  = require('./routes/walkerRoutes');
const clientRoutes  = require('./routes/clientRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const adminRoutes   = require('./routes/adminRoutes');

const app = express();

connectDB();

// ── Security ──────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:3000', credentials: true }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// Stripe webhook needs raw body BEFORE json parser
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));

// ── Static frontend ───────────────────────────
const fe = path.join(__dirname, '../frontend');
app.use(express.static(fe));

// ── API Routes ────────────────────────────────
app.use('/api/auth',     authRoutes);
app.use('/api/walkers',  walkerRoutes);
app.use('/api/clients',  clientRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/admin',    adminRoutes);

app.get('/api/health', (_req, res) =>
  res.json({ status: 'ok', env: process.env.NODE_ENV, ts: new Date().toISOString() })
);

// ── Page routes ───────────────────────────────
app.get('/login',      (_req, res) => res.sendFile(path.join(fe, 'login.html')));
app.get('/register',   (_req, res) => res.sendFile(path.join(fe, 'register.html')));
app.get('/walkers',    (_req, res) => res.sendFile(path.join(fe, 'walkers/browse.html')));
app.get('/dashboard/client', (_req, res) => res.sendFile(path.join(fe, 'clients/client-dashboard.html')));
app.get('/dashboard/walker', (_req, res) => res.sendFile(path.join(fe, 'walkers/walker-dashboard.html')));
app.get('/dashboard/admin',  (_req, res) => res.sendFile(path.join(fe, 'admin/admin-dashboard.html')));

// Catch-all → homepage
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  res.sendFile(path.join(fe, 'index.html'));
});

app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`🐾 Wag & Walk running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`)
);

module.exports = app;
