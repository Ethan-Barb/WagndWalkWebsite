const router = require('express').Router();
const auth   = require('../middleware/authMiddleware');
const ctrl   = require('../controllers/authController');

router.post('/register',        ctrl.register);
router.post('/login',           ctrl.login);
router.get('/me',               auth, ctrl.getMe);
router.patch('/update-profile', auth, ctrl.updateProfile);
router.post('/change-password', auth, ctrl.changePassword);

module.exports = router;
