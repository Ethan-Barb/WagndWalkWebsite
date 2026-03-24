const router      = require('express').Router();
const auth        = require('../middleware/authMiddleware');
const requireRole = require('../middleware/roleMiddleware');
const ctrl        = require('../controllers/clientController');

router.get('/dashboard',       auth, requireRole('client'), ctrl.getDashboard);
router.get('/dogs',            auth, requireRole('client'), ctrl.getDogs);
router.post('/dogs',           auth, requireRole('client'), ctrl.addDog);
router.patch('/dogs/:id',      auth, requireRole('client'), ctrl.updateDog);
router.delete('/dogs/:id',     auth, requireRole('client'), ctrl.deleteDog);
router.get('/payment-history', auth, requireRole('client'), ctrl.getPaymentHistory);

module.exports = router;
