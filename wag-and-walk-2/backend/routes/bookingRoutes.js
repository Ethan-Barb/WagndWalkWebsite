const express = require('express');
const r    = express.Router();
const c    = require('../controllers/bookingController');
const auth = require('../middleware/authMiddleware');

r.use(auth);

r.get('/available-slots', c.getAvailableSlots);
r.get('/',                c.getMyBookings);
r.post('/',               c.createBooking);
r.get('/:id',             c.getBooking);
r.patch('/:id/accept',    c.acceptBooking);
r.patch('/:id/decline',   c.declineBooking);
r.patch('/:id/cancel',    c.cancelBooking);
r.patch('/:id/complete',  c.completeBooking);
r.post('/:id/tip',        c.tipWalker);
r.post('/:id/review',     c.reviewWalker);

module.exports = r;
