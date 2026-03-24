const router      = require('express').Router();
const auth        = require('../middleware/authMiddleware');
const requireRole = require('../middleware/roleMiddleware');
const ctrl        = require('../controllers/adminController');

router.use(auth, requireRole('admin'));

router.get('/dashboard',       ctrl.getDashboard);
router.get('/analytics',       ctrl.getAnalytics);
router.get('/users',           ctrl.getUsers);
router.patch('/users/:id',     ctrl.updateUser);
router.get('/bookings',        ctrl.getBookings);
router.patch('/bookings/:id',  ctrl.updateBooking);
router.delete('/bookings/:id', ctrl.deleteBooking);

module.exports = router;
