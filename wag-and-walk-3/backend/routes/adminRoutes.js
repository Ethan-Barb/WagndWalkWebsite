const express = require('express');
const r    = express.Router();
const c    = require('../controllers/adminController');
const auth = require('../middleware/authMiddleware');
const role = require('../middleware/roleMiddleware');

r.use(auth, role('admin'));

r.get('/dashboard',       c.getDashboard);
r.get('/analytics',       c.getAnalytics);
r.get('/users',           c.getUsers);
r.patch('/users/:id',     c.updateUser);
r.get('/bookings',        c.getBookings);
r.patch('/bookings/:id',  c.updateBooking);
r.delete('/bookings/:id', c.cancelBooking);

module.exports = r;
