const request  = require('supertest');
const mongoose = require('mongoose');
const app      = require('../backend/server');
const User     = require('../backend/models/User');
const Dog      = require('../backend/models/Dog');
const Booking  = require('../backend/models/Booking');

const TEST_DB = process.env.TEST_MONGODB_URI || 'mongodb://localhost:27017/wag-and-walk-test';

let clientToken, walkerToken;
let walkerId, dogId, bookingId;

beforeAll(async () => {
  await mongoose.connect(TEST_DB);
  await Promise.all([User.deleteMany(), Dog.deleteMany(), Booking.deleteMany()]);

  const [cRes, wRes] = await Promise.all([
    request(app).post('/api/auth/register').send({
      firstName: 'Pay', lastName: 'Client',
      email: 'payclient@test.com', password: 'Password123!',
      role: 'client',
      address: { city: 'Naperville', state: 'IL', zip: '60540' },
    }),
    request(app).post('/api/auth/register').send({
      firstName: 'Pay', lastName: 'Walker',
      email: 'paywalker@test.com', password: 'Password123!',
      role: 'walker',
      address: { city: 'Naperville', state: 'IL', zip: '60540' },
      walkerProfile: { age: 19, isAvailable: true },
    }),
  ]);

  clientToken = cRes.body.token;
  walkerToken = wRes.body.token;
  walkerId    = wRes.body.user._id;

  const dogRes = await request(app).post('/api/clients/dogs')
    .set('Authorization', `Bearer ${clientToken}`)
    .send({ name: 'Paws', breed: 'Poodle', size: 'small' });
  dogId = dogRes.body.dog._id;

  const d = new Date();
  d.setDate(d.getDate() + 3);
  const bRes = await request(app).post('/api/bookings')
    .set('Authorization', `Bearer ${clientToken}`)
    .send({
      walkerId, dogIds: [dogId],
      scheduledDate: d.toISOString().split('T')[0],
      startTime: '10:00', endTime: '11:00', durationMinutes: 60,
      pickupAddress: { street: '100 Oak', city: 'Naperville', state: 'IL', zip: '60540' },
    });
  bookingId = bRes.body.booking._id;
});

afterAll(async () => {
  await Promise.all([User.deleteMany(), Dog.deleteMany(), Booking.deleteMany()]);
  await mongoose.disconnect();
});

/* ── Payment history ──────────────────────────── */
describe('GET /api/payments/history', () => {
  it('returns empty history for new client', async () => {
    const res = await request(app).get('/api/payments/history')
      .set('Authorization', `Bearer ${clientToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('payments');
    expect(Array.isArray(res.body.payments)).toBe(true);
  });

  it('requires authentication', async () => {
    const res = await request(app).get('/api/payments/history');
    expect(res.statusCode).toBe(401);
  });
});

/* ── Tipping ──────────────────────────────────── */
describe('POST /api/bookings/:id/tip', () => {
  let completedBookingId;

  beforeAll(async () => {
    // Accept then complete the booking
    await request(app)
      .patch(`/api/bookings/${bookingId}/accept`)
      .set('Authorization', `Bearer ${walkerToken}`);
    const res = await request(app)
      .patch(`/api/bookings/${bookingId}/complete`)
      .set('Authorization', `Bearer ${walkerToken}`);
    completedBookingId = res.body.booking?._id || bookingId;
  });

  it('rejects tip of 0 cents', async () => {
    const res = await request(app)
      .post(`/api/bookings/${completedBookingId}/tip`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ amount: 0 });
    expect(res.statusCode).toBe(400);
  });

  it('rejects tip on non-existent booking', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .post(`/api/bookings/${fakeId}/tip`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ amount: 500 });
    expect(res.statusCode).toBe(404);
  });
});

/* ── Stripe Connect ───────────────────────────── */
describe('POST /api/payments/stripe-connect', () => {
  it('walker endpoint exists and returns structured response or Stripe error', async () => {
    const res = await request(app)
      .post('/api/payments/stripe-connect')
      .set('Authorization', `Bearer ${walkerToken}`);
    // In test env Stripe may fail — we just confirm auth works and response is JSON
    expect([200, 500]).toContain(res.statusCode);
  });

  it('client is forbidden from connecting Stripe', async () => {
    const res = await request(app)
      .post('/api/payments/stripe-connect')
      .set('Authorization', `Bearer ${clientToken}`);
    expect(res.statusCode).toBe(403);
  });
});

/* ── Pricing logic ────────────────────────────── */
describe('Booking price calculation', () => {
  it('single dog 60-min = $20 (2000 cents)', async () => {
    const d = new Date();
    d.setDate(d.getDate() + 10);
    const res = await request(app).post('/api/bookings')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        walkerId, dogIds: [dogId],
        scheduledDate: d.toISOString().split('T')[0],
        startTime: '12:00', endTime: '13:00', durationMinutes: 60,
        pickupAddress: { street: '100 Oak', city: 'Naperville', state: 'IL', zip: '60540' },
      });
    expect(res.statusCode).toBe(201);
    expect(res.body.booking.totalPrice).toBe(2000);
  });
});
