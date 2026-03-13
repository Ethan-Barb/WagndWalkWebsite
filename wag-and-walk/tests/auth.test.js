const request = require('supertest');
const mongoose = require('mongoose');
const app      = require('../backend/server');
const User     = require('../backend/models/User');

const TEST_DB = process.env.TEST_MONGODB_URI || 'mongodb://localhost:27017/wag-and-walk-test';

beforeAll(async () => {
  await mongoose.connect(TEST_DB);
});

afterEach(async () => {
  await User.deleteMany();
});

afterAll(async () => {
  await mongoose.disconnect();
});

const testUser = {
  firstName: 'Test',
  lastName:  'Client',
  email:     'test@example.com',
  password:  'Password123!',
  role:      'client',
  address:   { street: '123 Main St', city: 'Naperville', state: 'IL', zip: '60540' },
};

const testWalker = {
  firstName: 'Test',
  lastName:  'Walker',
  email:     'walker@example.com',
  password:  'Password123!',
  role:      'walker',
  address:   { city: 'Naperville', state: 'IL', zip: '60540' },
  walkerProfile: { age: 19, bio: 'I love dogs!' },
};

/* ── Registration ─────────────────────────────── */
describe('POST /api/auth/register', () => {
  it('should register a new client', async () => {
    const res = await request(app).post('/api/auth/register').send(testUser);
    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.email).toBe(testUser.email);
    expect(res.body.user).not.toHaveProperty('password');
  });

  it('should register a new walker with walkerProfile', async () => {
    const res = await request(app).post('/api/auth/register').send(testWalker);
    expect(res.statusCode).toBe(201);
    expect(res.body.user.role).toBe('walker');
    expect(res.body.user.walkerProfile).toBeDefined();
  });

  it('should reject duplicate email', async () => {
    await request(app).post('/api/auth/register').send(testUser);
    const res = await request(app).post('/api/auth/register').send(testUser);
    expect(res.statusCode).toBe(409);
  });

  it('should require firstName', async () => {
    const { firstName, ...noFirst } = testUser;
    const res = await request(app).post('/api/auth/register').send(noFirst);
    expect(res.statusCode).toBe(400);
  });

  it('should require valid email', async () => {
    const res = await request(app).post('/api/auth/register')
      .send({ ...testUser, email: 'not-an-email' });
    expect(res.statusCode).toBe(400);
  });

  it('should reject password shorter than 8 chars', async () => {
    const res = await request(app).post('/api/auth/register')
      .send({ ...testUser, password: 'short' });
    expect(res.statusCode).toBe(400);
  });
});

/* ── Login ────────────────────────────────────── */
describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await request(app).post('/api/auth/register').send(testUser);
  });

  it('should login with valid credentials', async () => {
    const res = await request(app).post('/api/auth/login')
      .send({ email: testUser.email, password: testUser.password });
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.email).toBe(testUser.email);
  });

  it('should reject wrong password', async () => {
    const res = await request(app).post('/api/auth/login')
      .send({ email: testUser.email, password: 'wrongpassword' });
    expect(res.statusCode).toBe(401);
  });

  it('should reject unknown email', async () => {
    const res = await request(app).post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'Password123!' });
    expect(res.statusCode).toBe(401);
  });

  it('should reject missing fields', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: testUser.email });
    expect(res.statusCode).toBe(400);
  });
});

/* ── Get Me ───────────────────────────────────── */
describe('GET /api/auth/me', () => {
  let token;

  beforeEach(async () => {
    const res = await request(app).post('/api/auth/register').send(testUser);
    token = res.body.token;
  });

  it('should return current user with valid token', async () => {
    const res = await request(app).get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.user.email).toBe(testUser.email);
  });

  it('should reject missing token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.statusCode).toBe(401);
  });

  it('should reject malformed token', async () => {
    const res = await request(app).get('/api/auth/me')
      .set('Authorization', 'Bearer invalidtoken');
    expect(res.statusCode).toBe(401);
  });
});

/* ── Update Profile ───────────────────────────── */
describe('PATCH /api/auth/update-profile', () => {
  let token;

  beforeEach(async () => {
    const res = await request(app).post('/api/auth/register').send(testUser);
    token = res.body.token;
  });

  it('should update firstName and lastName', async () => {
    const res = await request(app).patch('/api/auth/update-profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ firstName: 'Jane', lastName: 'Doe' });
    expect(res.statusCode).toBe(200);
    expect(res.body.user.firstName).toBe('Jane');
  });

  it('should not allow password update via update-profile', async () => {
    const res = await request(app).patch('/api/auth/update-profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ password: 'NewPass123!' });
    expect(res.statusCode).toBe(200);
    // Should ignore password field — verify old password still works
    const loginRes = await request(app).post('/api/auth/login')
      .send({ email: testUser.email, password: testUser.password });
    expect(loginRes.statusCode).toBe(200);
  });
});
