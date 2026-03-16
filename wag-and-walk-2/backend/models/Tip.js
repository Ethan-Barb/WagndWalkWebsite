const mongoose = require('mongoose');

const tipSchema = new mongoose.Schema({
  booking:  { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
  client:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  walker:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount:   { type: Number, required: true },   // cents
  stripePaymentIntentId: String,
  status:   { type: String, enum: ['pending', 'succeeded', 'failed'], default: 'pending' },
  message:  { type: String, maxlength: 200 },
}, { timestamps: true });

module.exports = mongoose.model('Tip', tipSchema);
