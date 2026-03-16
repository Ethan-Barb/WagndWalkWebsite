const express = require('express');
const r    = express.Router();
const c    = require('../controllers/paymentController');
const auth = require('../middleware/authMiddleware');

// Webhook must arrive before auth / JSON body parser
r.post('/webhook',        c.handleWebhook);

r.use(auth);
r.post('/create-intent',  c.createPaymentIntent);
r.get('/history',         c.getPaymentHistory);
r.post('/stripe-connect', c.setupStripeConnect);

module.exports = r;
