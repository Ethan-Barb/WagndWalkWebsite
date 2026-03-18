const express = require('express');
const r    = express.Router();
const c    = require('../controllers/walkerController');
const auth = require('../middleware/authMiddleware');
const role = require('../middleware/roleMiddleware');

r.get('/',                              c.getWalkers);
r.get('/dashboard', auth, role('walker'), c.getDashboard);
r.get('/earnings',  auth, role('walker'), c.getEarnings);
r.patch('/profile', auth, role('walker'), c.updateWalkerProfile);
r.post('/stripe-connect', auth, role('walker'), c.setupStripeConnect);
r.get('/:id',                           c.getWalkerProfile);

module.exports = r;
