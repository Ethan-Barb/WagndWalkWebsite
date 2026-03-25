const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  booking:  { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
  client:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  walker:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  type:     { type: String, enum: ['walk_payment', 'tip'], required: true },
  amount:   { type: Number, required: true }, // cents
  status:   { type: String, enum: ['pending', 'succeeded', 'failed', 'refunded'], default: 'pending' },
  stripePaymentIntentId: String,
  stripeTransferId:      String,
  platformFeeAmount:     { type: Number, default: 0 },
  walkerPayoutAmount:    { type: Number, default: 0 },
  processedAt:           Date,
}, { timestamps: true });

paymentSchema.index({ booking: 1 });
paymentSchema.index({ client: 1 });
paymentSchema.index({ walker: 1 });

module.exports = mongoose.model('Payment', paymentSchema);
