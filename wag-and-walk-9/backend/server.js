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

// Trust Railway's proxy so rate limiting and IP detection work correctly
app.set('trust proxy', 1);

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

app.use(express.json({ limit: '3mb' }));
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

// ── Public CMS content (no auth) ──────────────
const SiteContent = require('./models/SiteContent');
app.get('/api/site-content', async (_req, res) => {
  try {
    const content = await SiteContent.getContent();
    res.json({ content });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load site content' });
  }
});

// ── Notifications API (authenticated) ─────────
const Notification = require('./models/Notification');
const authMW = require('./middleware/authMiddleware');

app.get('/api/notifications', authMW, async (req, res) => {
  try {
    const notifications = await Notification.find({ recipient: req.user._id })
      .sort({ createdAt: -1 }).limit(30);
    const unreadCount = await Notification.countDocuments({ recipient: req.user._id, isRead: false });
    res.json({ notifications, unreadCount });
  } catch (err) { res.status(500).json({ error: 'Failed to load notifications' }); }
});

app.patch('/api/notifications/:id/read', authMW, async (req, res) => {
  try {
    await Notification.findOneAndUpdate({ _id: req.params.id, recipient: req.user._id }, { isRead: true });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

app.patch('/api/notifications/read-all', authMW, async (req, res) => {
  try {
    await Notification.updateMany({ recipient: req.user._id, isRead: false }, { isRead: true });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

// ── Stripe Checkout Session ───────────────────
const stripe = require('./config/stripe');
const Booking = require('./models/Booking');

app.post('/api/checkout/create-session', authMW, async (req, res) => {
  try {
    const { bookingId } = req.body;
    const booking = await Booking.findById(bookingId).populate('dogs', 'name');
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.client.toString() !== req.user._id.toString())
      return res.status(403).json({ error: 'Not your booking' });

    const dogNames = (booking.dogs || []).map(d => d.name).join(', ') || 'Dog walk';
    const baseUrl = process.env.CLIENT_URL || `http://localhost:${PORT}`;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Dog Walk — ${dogNames}`,
            description: `${booking.durationMinutes || 60} min walk on ${new Date(booking.scheduledDate).toLocaleDateString()}`,
          },
          unit_amount: booking.totalPrice,
        },
        quantity: 1,
      }],
      metadata: { bookingId: booking._id.toString() },
      success_url: `${baseUrl}/dashboard/client?payment=success&booking=${booking._id}`,
      cancel_url:  `${baseUrl}/dashboard/client?payment=cancelled&booking=${booking._id}`,
    });

    // Store session ID on booking
    booking.stripePaymentIntentId = session.id;
    booking.paymentStatus = 'pending';
    await booking.save();

    res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error('Checkout session error:', err.message);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

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
