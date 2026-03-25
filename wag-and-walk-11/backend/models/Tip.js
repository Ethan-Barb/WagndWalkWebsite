const mongoose = require('mongoose');

const tipSchema = new mongoose.Schema({
  booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
  client:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  walker:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  amount:  { type: Number, required: true }, // cents
  stripePaymentIntentId: String,
  status:  { type: String, enum: ['pending', 'succeeded', 'failed'], default: 'pending' },
}, { timestamps: true });

tipSchema.index({ booking: 1 });
tipSchema.index({ walker: 1 });

module.exports = mongoose.model('Tip', tipSchema);
