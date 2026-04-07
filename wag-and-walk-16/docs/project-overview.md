# Wag & Walk — Project Overview

## What is it?

Wag & Walk is a full-stack web application connecting Naperville, Illinois dog owners with trusted local walkers — primarily high school students and community members. It handles the complete booking lifecycle: discovery, scheduling, secure payment (via Stripe), real-time status updates, tipping, and reviews.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Browser                        │
│   HTML/CSS/Vanilla JS  ·  login  ·  dashboards  ·  booking  │
└────────────────────────────┬────────────────────────────────┘
                             │ HTTPS (REST/JSON)
┌────────────────────────────▼────────────────────────────────┐
│                    Node.js / Express                         │
│   authController  ·  bookingController  ·  walkerController │
│   clientController  ·  paymentController  ·  adminController │
│                                                              │
│   Services: paymentService  ·  schedulingService            │
│             notificationService                             │
│                                                              │
│   Middleware: JWT auth  ·  role guard  ·  error handler     │
└──────────────┬──────────────────────────┬───────────────────┘
               │                          │
┌──────────────▼──────┐       ┌───────────▼────────────┐
│   MongoDB Atlas      │       │   Stripe API           │
│   mongoose ODM       │       │   - PaymentIntents     │
│                      │       │   - Connect (payouts)  │
│   Users  Dogs        │       │   - Webhooks           │
│   Bookings  Payments │       └────────────────────────┘
│   Tips               │
└──────────────────────┘
```

---

## User Roles

| Role   | Capabilities |
|--------|-------------|
| **Client** | Register, add dogs, browse walkers, book walks, pay, tip, review |
| **Walker** | Set availability, accept/decline requests, complete walks, earn money, connect Stripe |
| **Admin** | View all users/bookings/payments, edit/cancel bookings, see analytics |

---

## Core Flows

### Booking Flow
1. Client selects dogs, picks a date on the calendar, chooses a time slot
2. Client optionally picks a specific walker (or "any available")
3. System checks walker availability (no conflicts, within availability window)
4. `POST /api/bookings` — creates booking in `pending` state, creates Stripe PaymentIntent with `capture_method: manual` (hold funds)
5. Walker sees request in dashboard → accepts or declines
6. On acceptance: PaymentIntent is captured; client gets email confirmation
7. Walker walks the dog, marks complete via dashboard
8. On completion: payment transferred to walker's Stripe Connect account (80%); platform retains 20%
9. Client receives email with tip prompt
10. Client can leave tip (100% to walker) and star rating + comment

### Payment Architecture
- **Hold → Capture**: Stripe PaymentIntent created with `capture_method: manual`. Funds are authorized (held) at booking creation, captured only when walker accepts. Cancelled bookings trigger `cancelPaymentIntent` for automatic refund.
- **Stripe Connect**: Each walker completes Stripe Express onboarding to receive payouts. After walk completion, the server calls `stripe.transfers.create()` to move 80% of the booking fee to their connected account.
- **Tips**: Separate PaymentIntent for 100% immediate transfer to walker.

---

## Directory Structure

```
wag-and-walk/
├── backend/
│   ├── server.js              # Express app entry point
│   ├── config/
│   │   ├── database.js        # MongoDB connection
│   │   └── stripe.js          # Stripe instance
│   ├── models/                # Mongoose schemas
│   │   ├── User.js
│   │   ├── Dog.js
│   │   ├── Booking.js
│   │   ├── Payment.js
│   │   └── Tip.js
│   ├── controllers/           # Route handlers
│   │   ├── authController.js
│   │   ├── bookingController.js
│   │   ├── walkerController.js
│   │   ├── clientController.js
│   │   ├── paymentController.js
│   │   └── adminController.js
│   ├── routes/                # Express routers
│   │   ├── authRoutes.js
│   │   ├── bookingRoutes.js
│   │   ├── walkerRoutes.js
│   │   ├── clientRoutes.js
│   │   ├── paymentRoutes.js
│   │   └── adminRoutes.js
│   ├── middleware/
│   │   ├── authMiddleware.js  # JWT verification
│   │   ├── roleMiddleware.js  # Role-based access
│   │   └── errorHandler.js   # Centralized errors
│   └── services/
│       ├── paymentService.js      # Stripe logic
│       ├── schedulingService.js   # Availability / slot logic
│       └── notificationService.js # Nodemailer emails
├── frontend/
│   ├── index.html             # Landing page
│   ├── login.html
│   ├── register.html
│   ├── css/
│   │   └── styles.css         # Full design system
│   ├── js/
│   │   ├── auth.js            # Shared auth helpers + api()
│   │   ├── booking.js         # Calendar + booking flow
│   │   ├── tips.js            # Tip modal
│   │   └── payments.js        # Stripe.js helper
│   ├── clients/
│   │   └── client-dashboard.html
│   ├── walkers/
│   │   ├── walker-dashboard.html
│   │   └── browse.html        # Public walker directory
│   └── admin/
│       └── admin-dashboard.html
├── database/
│   └── seed-data.js           # Demo data seeder
├── tests/
│   ├── auth.test.js
│   ├── booking.test.js
│   └── payment.test.js
├── docs/
│   ├── project-overview.md   ← this file
│   ├── api-documentation.md
│   └── database-schema.md
├── deployment/
│   ├── dockerfile
│   ├── nginx.conf
│   └── deploy-guide.md
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

---

## Design System

| Token | Value | Usage |
|-------|-------|-------|
| `--bark` | `#2D1B0E` | Primary text, dark surfaces |
| `--amber` | `#D4883E` | Brand accent, CTAs |
| `--sage` | `#7A9E7E` | Secondary accent, avatars |
| `--cream` | `#FDF6ED` | Page background |
| `--linen` | `#EDE0CF` | Borders, dividers |

Fonts: **Playfair Display** (headings) + **DM Sans** (body). Loaded from Google Fonts.

---

## Local Development

```bash
# 1. Install
npm install

# 2. Configure
cp .env.example .env
# Fill in MONGODB_URI, JWT_SECRET, STRIPE_SECRET_KEY

# 3. Seed
node database/seed-data.js

# 4. Start
npm run dev   # uses nodemon

# 5. Visit
open http://localhost:3000
```

Demo logins: `admin@wagandwalk.com / Admin123!` · `emma@example.com / Walker123!` · `sarah@example.com / Client123!`
