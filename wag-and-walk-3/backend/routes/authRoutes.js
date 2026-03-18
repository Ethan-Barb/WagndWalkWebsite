// authRoutes.js
const express = require('express');
const r       = express.Router();
const c       = require('../controllers/authController');
const auth    = require('../middleware/authMiddleware');

r.post('/register',           c.register);
r.post('/login',              c.login);
r.get('/verify-email/:token', c.verifyEmail);
r.get('/me',                  auth, c.getMe);
r.patch('/update-profile',    auth, c.updateProfile);
r.post('/change-password',    auth, c.changePassword);

module.exports = r;
