const router      = require('express').Router();
const auth        = require('../middleware/authMiddleware');
const requireRole = require('../middleware/roleMiddleware');
const ctrl        = require('../controllers/paymentController');

router.post('/create-intent',   auth, ctrl.createIntent);
router.get('/history',          auth, ctrl.getHistory);
router.post('/stripe-connect',  auth, requireRole('walker'), ctrl.stripeConnect);
router.post('/webhook',         ctrl.webhook); // no auth — verified by Stripe signature

module.exports = router;
