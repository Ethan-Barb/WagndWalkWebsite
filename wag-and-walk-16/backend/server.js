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

// ── Messaging API ─────────────────────────────
const Conversation = require('./models/Conversation');

// Get conversations for current user
app.get('/api/messages', authMW, async (req, res) => {
  try {
    const convos = await Conversation.find({ participants: req.user._id })
      .populate('participants', 'firstName lastName role profilePhoto walkerProfile.isVerified')
      .sort({ lastMessageAt: -1 });
    res.json({ conversations: convos });
  } catch (err) { res.status(500).json({ error: 'Failed to load messages' }); }
});

// Get or create conversation with another user
app.post('/api/messages/conversation', authMW, async (req, res) => {
  try {
    const { userId, bookingId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId is required' });
    let convo = await Conversation.findOne({
      participants: { $all: [req.user._id, userId] },
    }).populate('participants', 'firstName lastName role profilePhoto');
    if (!convo) {
      convo = await Conversation.create({
        participants: [req.user._id, userId],
        booking: bookingId || undefined,
        messages: [],
      });
      convo = await convo.populate('participants', 'firstName lastName role profilePhoto');
    }
    res.json({ conversation: convo });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

// Send message
app.post('/api/messages/:convoId/send', authMW, async (req, res) => {
  try {
    const { content, imageUrl } = req.body;
    if (!content && !imageUrl) return res.status(400).json({ error: 'Message content required' });
    const convo = await Conversation.findById(req.params.convoId);
    if (!convo) return res.status(404).json({ error: 'Conversation not found' });

    const isParticipant = convo.participants.some(p => p.toString() === req.user._id.toString());
    const isAdmin = req.user.role === 'admin';

    if (!isParticipant && !isAdmin)
      return res.status(403).json({ error: 'Not a participant' });

    // Add admin as participant if not already (so their messages show up)
    if (isAdmin && !isParticipant) {
      convo.participants.push(req.user._id);
    }

    convo.messages.push({ sender: req.user._id, content: content || '', imageUrl: imageUrl || '', readBy: [req.user._id] });
    convo.lastMessage = (content || 'Sent a photo').substring(0, 100);
    convo.lastMessageAt = new Date();
    await convo.save();

    // Create notification for all other participants
    for (const p of convo.participants) {
      if (p.toString() !== req.user._id.toString()) {
        await Notification.create({ recipient: p, sender: req.user._id, type: 'admin_message',
          title: isAdmin ? 'Message from Wag & Walk Admin' : 'New message from ' + req.user.firstName,
          message: (content || 'Sent a photo').substring(0, 80) });
      }
    }
    res.json({ conversation: convo });
  } catch (err) { res.status(500).json({ error: 'Failed to send' }); }
});

// Admin: view all conversations
app.get('/api/admin/messages', authMW, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  try {
    const convos = await Conversation.find()
      .populate('participants', 'firstName lastName role profilePhoto')
      .sort({ lastMessageAt: -1 }).limit(100);
    res.json({ conversations: convos });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

// ── Favorites API ─────────────────────────────
const User = require('./models/User');

app.post('/api/favorites/:walkerId', authMW, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user.favoriteWalkers.includes(req.params.walkerId)) {
      user.favoriteWalkers.push(req.params.walkerId);
      await user.save();
    }
    res.json({ favorites: user.favoriteWalkers });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

app.delete('/api/favorites/:walkerId', authMW, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    user.favoriteWalkers = user.favoriteWalkers.filter(id => id.toString() !== req.params.walkerId);
    await user.save();
    res.json({ favorites: user.favoriteWalkers });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

app.get('/api/favorites', authMW, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('favoriteWalkers', 'firstName lastName profilePhoto walkerProfile');
    res.json({ favorites: user.favoriteWalkers || [] });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

// ── Appointment Status API ────────────────────
const smsService = require('./services/smsService');

app.patch('/api/appointments/:id/status', authMW, async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: 'status is required' });
    const validStatuses = ['pending', 'accepted', 'walker_assigned', 'on_the_way', 'in_progress', 'completed', 'cancelled', 'declined'];
    if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status: ' + status });

    const updated = await smsService.updateAppointmentStatus(req.params.id, status);
    res.json({ booking: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/appointments/:id', authMW, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('client', 'firstName lastName phone email')
      .populate('walker', 'firstName lastName phone email')
      .populate('dogs', 'name breed size');
    if (!booking) return res.status(404).json({ error: 'Not found' });
    res.json({ booking });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Walk Photos API ───────────────────────────
app.post('/api/bookings/:id/photos', authMW, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.walker?.toString() !== req.user._id.toString() && req.user.role !== 'admin')
      return res.status(403).json({ error: 'Only the walker can add photos' });
    const { url, caption } = req.body;
    if (!url) return res.status(400).json({ error: 'Photo URL required' });
    booking.walkPhotos.push({ url, caption: caption || '' });
    await booking.save();
    res.json({ photos: booking.walkPhotos });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

// ── Promo Codes API ───────────────────────────
const PromoCode = require('./models/PromoCode');

app.post('/api/promo/validate', authMW, async (req, res) => {
  try {
    const { code } = req.body;
    const promo = await PromoCode.findOne({ code: code.toUpperCase() });
    if (!promo) return res.status(404).json({ error: 'Invalid promo code' });
    const check = promo.isValid(req.user._id);
    if (!check.valid) return res.status(400).json({ error: check.error });
    res.json({ promo: { code: promo.code, type: promo.type, amount: promo.amount, description: promo.description } });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

// Email capture (public)
app.post('/api/email-capture', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });
    const content = await SiteContent.getContent();
    const exists = content.emailList.some(e => e.email === email.toLowerCase());
    if (!exists) {
      content.emailList.push({ email: email.toLowerCase() });
      await content.save();
    }
    // Return a promo code if configured
    let promoCode = null;
    if (content.emailCapture?.promoCodeId) {
      const promo = await PromoCode.findById(content.emailCapture.promoCodeId);
      if (promo) promoCode = promo.code;
    }
    res.json({ success: true, promoCode });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

// Admin: manage promo codes
app.get('/api/admin/promo-codes', authMW, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  try {
    const codes = await PromoCode.find().sort({ createdAt: -1 });
    res.json({ codes });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

app.post('/api/admin/promo-codes', authMW, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  try {
    const { code, type, amount, description, maxUses, expiresAt } = req.body;
    const promo = await PromoCode.create({
      code: code.toUpperCase(), type: type || 'fixed', amount, description,
      maxUses: maxUses || 0, expiresAt: expiresAt || undefined, createdBy: req.user._id,
    });
    res.status(201).json({ promo });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// About Us page (public)
app.get('/api/about', async (_req, res) => {
  try {
    const content = await SiteContent.getContent();
    res.json({ aboutUs: content.aboutUs || {} });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

// ── Page routes ───────────────────────────────
app.get('/login',      (_req, res) => res.sendFile(path.join(fe, 'login.html')));
app.get('/register',   (_req, res) => res.sendFile(path.join(fe, 'register.html')));
app.get('/walkers',    (_req, res) => res.sendFile(path.join(fe, 'walkers/browse.html')));
app.get('/about',      (_req, res) => res.sendFile(path.join(fe, 'about.html')));
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
