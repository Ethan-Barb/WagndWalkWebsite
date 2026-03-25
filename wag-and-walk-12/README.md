# 🐾 Wag & Walk — Naperville Dog Walking Platform

A full-stack web application connecting dog owners with trusted local walkers in Naperville, IL.

## Features

- **Three user roles**: Client (dog owner), Walker, Admin
- **Appointment scheduling** with calendar-based booking
- **Stripe payment processing** with escrow-style hold until walk completion
- **Tipping system** — tips go directly to walkers
- **Email notifications** for bookings, confirmations, tips
- **Admin dashboard** with full platform control
- **Responsive design** for mobile and desktop

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML, CSS, JavaScript (Vanilla) |
| Backend | Node.js + Express |
| Database | MongoDB (Mongoose ODM) |
| Payments | Stripe (Connect for walker payouts) |
| Auth | JWT + bcrypt |
| Email | Nodemailer |

## Quick Start

### 1. Clone & Install
```bash
git clone https://github.com/your-org/wag-and-walk.git
cd wag-and-walk
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env with your MongoDB URI, Stripe keys, and email credentials
```

### 3. Seed the Database
```bash
npm run db:seed
```

### 4. Start the Server
```bash
npm run dev       # Development (nodemon)
npm start         # Production
```

Visit `http://localhost:3000`

## Demo Accounts (after seeding)

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@wagandwalk.com | Admin123! |
| Walker | emma@example.com | Walker123! |
| Walker | marcus@example.com | Walker123! |
| Client | sarah@example.com | Client123! |
| Client | david@example.com | Client123! |

## API Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register | Register new user |
| POST | /api/auth/login | Login |
| GET | /api/walkers | List available walkers |
| POST | /api/bookings | Create booking |
| PATCH | /api/bookings/:id/accept | Walker accepts |
| PATCH | /api/bookings/:id/complete | Mark completed |
| POST | /api/bookings/:id/tip | Send tip |
| GET | /api/admin/dashboard | Admin overview |

See `docs/api-documentation.md` for the full API reference.

## Pricing

- 60-minute walk: **$20.00**
- Additional dog: **+$5.00**
- Platform fee: **20%** (walkers keep 80%)
- Tips: **100%** to walker

## Project Structure

```
wag-and-walk/
├── backend/          # Express server, routes, controllers, models
├── frontend/         # HTML/CSS/JS pages
├── database/         # Seed data
├── docs/             # Documentation
├── tests/            # Jest test suites
└── deployment/       # Docker, nginx, deploy guide
```

## Security

- Passwords hashed with bcrypt (12 rounds)
- JWT authentication with expiration
- Role-based access control middleware
- Stripe webhook signature verification
- Rate limiting on all API endpoints
- Helmet.js security headers

## Deployment

See `deployment/deploy-guide.md` for full instructions including Docker setup and nginx configuration.
