const express = require('express');
const r    = express.Router();
const c    = require('../controllers/clientController');
const auth = require('../middleware/authMiddleware');
const role = require('../middleware/roleMiddleware');

r.use(auth, role('client', 'admin'));

r.get('/dashboard',        c.getDashboard);
r.get('/dogs',             c.getDogs);
r.post('/dogs',            c.createDog);
r.patch('/dogs/:id',       c.updateDog);
r.delete('/dogs/:id',      c.deleteDog);
r.get('/payment-history',  c.getPaymentHistory);
r.post('/setup-payment',   c.setupPayment);

module.exports = r;
