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

// CMS routes
router.get('/site-content',                         ctrl.getSiteContent);
router.patch('/site-content',                        ctrl.updateSiteContent);
router.post('/site-content/gallery',                 ctrl.addGalleryImage);
router.delete('/site-content/gallery/:imageId',      ctrl.removeGalleryImage);
router.post('/site-content/testimonials',            ctrl.upsertTestimonial);
router.delete('/site-content/testimonials/:testimonialId', ctrl.removeTestimonial);

// Messaging routes
router.post('/messages/send',      ctrl.sendMessage);
router.post('/messages/bulk',      ctrl.sendBulkMessage);

module.exports = router;
