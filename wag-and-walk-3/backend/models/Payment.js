const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  booking:  { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
  client:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  walker:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  type:     { type: String, enum: ['walk_payment', 'tip'], required: true },
  amount:   { type: Number, required: true },   // cents
  currency: { type: String, default: 'usd' },
  stripePaymentIntentId: { type: String, required: true },
  stripeTransferId:      String,
  status: {
    type: String,
    enum: ['pending', 'processing', 'succeeded', 'failed', 'refunded'],
    default: 'pending',
  },
  platformFeeAmount:  Number,
  walkerPayoutAmount: Number,
  refundedAt:   Date,
  refundReason: String,
  stripeRefundId: String,
  processedAt:  Date,
}, { timestamps: true });

paymentSchema.index({ booking: 1 });
paymentSchema.index({ walker: 1 });

module.exports = mongoose.model('Payment', paymentSchema);
