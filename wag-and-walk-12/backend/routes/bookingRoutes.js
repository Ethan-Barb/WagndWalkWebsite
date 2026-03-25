const router      = require('express').Router();
const auth        = require('../middleware/authMiddleware');
const requireRole = require('../middleware/roleMiddleware');
const ctrl        = require('../controllers/bookingController');

router.post('/',                  auth, requireRole('client'),          ctrl.createBooking);
router.get('/',                   auth,                                 ctrl.getBookings);
router.get('/available-slots',    auth,                                 ctrl.getAvailableSlots);
router.get('/:id',                auth,                                 ctrl.getBooking);
router.patch('/:id/accept',      auth, requireRole('walker', 'admin'), ctrl.acceptBooking);
router.patch('/:id/decline',     auth, requireRole('walker', 'admin'), ctrl.declineBooking);
router.patch('/:id/cancel',      auth,                                 ctrl.cancelBooking);
router.patch('/:id/complete',    auth, requireRole('walker', 'admin'), ctrl.completeBooking);
router.post('/:id/tip',          auth, requireRole('client'),          ctrl.tipWalker);
router.post('/:id/review',       auth, requireRole('client'),          ctrl.reviewWalker);

module.exports = router;
