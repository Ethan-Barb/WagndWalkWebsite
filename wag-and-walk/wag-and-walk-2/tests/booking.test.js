const request  = require('supertest');
const mongoose = require('mongoose');
const app      = require('../backend/server');
const User     = require('../backend/models/User');
const Dog      = require('../backend/models/Dog');
const Booking  = require('../backend/models/Booking');

const TEST_DB = process.env.TEST_MONGODB_URI || 'mongodb://localhost:27017/wag-and-walk-test';

let clientToken, walkerToken, adminToken;
let clientId, walkerId, dogId;

beforeAll(async () => {
  await mongoose.connect(TEST_DB);
  await Promise.all([User.deleteMany(), Dog.deleteMany(), Booking.deleteMany()]);

  // Create test users
  const [cRes, wRes] = await Promise.all([
    request(app).post('/api/auth/register').send({
      firstName: 'Client', lastName: 'Test',
      email: 'client@test.com', password: 'Password123!',
      role: 'client',
      address: { city: 'Naperville', state: 'IL', zip: '60540' },
    }),
    request(app).post('/api/auth/register').send({
      firstName: 'Walker', lastName: 'Test',
      email: 'walker@test.com', password: 'Password123!',
      role: 'walker',
      address: { city: 'Naperville', state: 'IL', zip: '60540' },
      walkerProfile: {
        age: 19, bio: 'Test walker',
        availability: [
          { dayOfWeek: 6, startTime: '09:00', endTime: '17:00' },
          { dayOfWeek: 0, startTime: '09:00', endTime: '17:00' },
        ],
        isAvailable: true,
      },
    }),
  ]);

  clientToken = cRes.body.token;
  walkerToken = wRes.body.token;
  clientId    = cRes.body.user._id;
  walkerId    = wRes.body.user._id;

  // Create a dog
  const dogRes = await request(app).post('/api/clients/dogs')
    .set('Authorization', `Bearer ${clientToken}`)
    .send({ name: 'Buddy', breed: 'Lab', size: 'large' });
  dogId = dogRes.body.dog._id;
});

afterAll(async () => {
  await Promise.all([User.deleteMany(), Dog.deleteMany(), Booking.deleteMany()]);
  await mongoose.disconnect();
});

const futureDate = () => {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().split('T')[0];
};

/* ── Create Booking ───────────────────────────── */
describe('POST /api/bookings', () => {
  afterEach(async () => { await Booking.deleteMany(); });

  it('client can create a booking', async () => {
    const res = await request(app).post('/api/bookings')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        walkerId,
        dogIds:      [dogId],
        scheduledDate: futureDate(),
        startTime:   '10:00',
        endTime:     '11:00',
        durationMinutes: 60,
        pickupAddress: { street: '123 Main', city: 'Naperville', state: 'IL', zip: '60540' },
      });
    expect(res.statusCode).toBe(201);
    expect(res.body.booking.status).toBe('pending');
    expect(res.body.booking.totalPrice).toBe(2000);
  });

  it('extra dog adds $5', async () => {
    const dog2 = await Dog.create({ owner: clientId, name: 'Max', size: 'small' });
    const res  = await request(app).post('/api/bookings')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        walkerId,
        dogIds: [dogId, dog2._id.toString()],
        scheduledDate: futureDate(),
        startTime: '14:00', endTime: '15:00', durationMinutes: 60,
        pickupAddress: { street: '123 Main', city: 'Naperville', state: 'IL', zip: '60540' },
      });
    expect(res.statusCode).toBe(201);
    expect(res.body.booking.totalPrice).toBe(2500);
  });

  it('requires at least one dog', async () => {
    const res = await request(app).post('/api/bookings')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        walkerId, dogIds: [],
        scheduledDate: futureDate(),
        startTime: '10:00', endTime: '11:00', durationMinutes: 60,
        pickupAddress: { street: '123 Main', city: 'Naperville', state: 'IL', zip: '60540' },
      });
    expect(res.statusCode).toBe(400);
  });

  it('walker cannot create a booking', async () => {
    const res = await request(app).post('/api/bookings')
      .set('Authorization', `Bearer ${walkerToken}`)
      .send({
        walkerId, dogIds: [dogId],
        scheduledDate: futureDate(),
        startTime: '10:00', endTime: '11:00', durationMinutes: 60,
        pickupAddress: { street: '123 Main', city: 'Naperville', state: 'IL', zip: '60540' },
      });
    expect(res.statusCode).toBe(403);
  });
});

/* ── Get Bookings ─────────────────────────────── */
describe('GET /api/bookings', () => {
  let bookingId;

  beforeEach(async () => {
    const res = await request(app).post('/api/bookings')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        walkerId, dogIds: [dogId],
        scheduledDate: futureDate(),
        startTime: '10:00', endTime: '11:00', durationMinutes: 60,
        pickupAddress: { street: '123 Main', city: 'Naperville', state: 'IL', zip: '60540' },
      });
    bookingId = res.body.booking._id;
  });

  afterEach(async () => { await Booking.deleteMany(); });

  it('client sees their bookings', async () => {
    const res = await request(app).get('/api/bookings')
      .set('Authorization', `Bearer ${clientToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.bookings.length).toBeGreaterThan(0);
  });

  it('walker sees their bookings', async () => {
    const res = await request(app).get('/api/bookings')
      .set('Authorization', `Bearer ${walkerToken}`);
    expect(res.statusCode).toBe(200);
  });

  it('unauthenticated request is rejected', async () => {
    const res = await request(app).get('/api/bookings');
    expect(res.statusCode).toBe(401);
  });
});

/* ── Accept / Decline ─────────────────────────── */
describe('Booking acceptance flow', () => {
  let bookingId;

  beforeEach(async () => {
    const res = await request(app).post('/api/bookings')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        walkerId, dogIds: [dogId],
        scheduledDate: futureDate(),
        startTime: '10:00', endTime: '11:00', durationMinutes: 60,
        pickupAddress: { street: '123 Main', city: 'Naperville', state: 'IL', zip: '60540' },
      });
    bookingId = res.body.booking._id;
  });

  afterEach(async () => { await Booking.deleteMany(); });

  it('walker can accept a pending booking', async () => {
    const res = await request(app)
      .patch(`/api/bookings/${bookingId}/accept`)
      .set('Authorization', `Bearer ${walkerToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.booking.status).toBe('accepted');
  });

  it('client cannot accept a booking', async () => {
    const res = await request(app)
      .patch(`/api/bookings/${bookingId}/accept`)
      .set('Authorization', `Bearer ${clientToken}`);
    expect(res.statusCode).toBe(403);
  });

  it('walker can decline with reason', async () => {
    const res = await request(app)
      .patch(`/api/bookings/${bookingId}/decline`)
      .set('Authorization', `Bearer ${walkerToken}`)
      .send({ reason: 'Schedule conflict' });
    expect(res.statusCode).toBe(200);
    expect(res.body.booking.status).toBe('declined');
  });

  it('client can cancel a pending booking', async () => {
    const res = await request(app)
      .patch(`/api/bookings/${bookingId}/cancel`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ reason: 'Plans changed' });
    expect(res.statusCode).toBe(200);
    expect(res.body.booking.status).toBe('cancelled');
  });
});
