const router      = require('express').Router();
const auth        = require('../middleware/authMiddleware');
const requireRole = require('../middleware/roleMiddleware');
const ctrl        = require('../controllers/walkerController');

router.get('/',           ctrl.listWalkers);         // public
router.get('/dashboard',  auth, requireRole('walker'), ctrl.getDashboard);
router.get('/earnings',   auth, requireRole('walker'), ctrl.getEarnings);
router.patch('/profile',  auth, requireRole('walker'), ctrl.updateProfile);
router.get('/:id',        ctrl.getWalker);            // public

module.exports = router;
