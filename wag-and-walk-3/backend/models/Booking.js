const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  rating:  { type: Number, min: 1, max: 5, required: true },
  comment: { type: String, maxlength: 500 },
  createdAt: { type: Date, default: Date.now },
}, { _id: false });

const bookingSchema = new mongoose.Schema({
  client:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  walker:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  dogs:    [{ type: mongoose.Schema.Types.ObjectId, ref: 'Dog', required: true }],

  status: {
    type: String,
    enum: ['pending', 'accepted', 'in_progress', 'completed', 'cancelled', 'declined'],
    default: 'pending',
  },

  scheduledDate: { type: Date, required: true },
  startTime:     { type: String, required: true },  // "10:00"
  endTime:       { type: String, required: true },  // "11:00"
  durationMinutes: { type: Number, default: 60 },

  pickupAddress: {
    street: { type: String, required: true },
    city:   { type: String, default: 'Naperville' },
    state:  { type: String, default: 'IL' },
    zip:    String,
    coordinates: { lat: Number, lng: Number },
  },

  walkingRoute: [{ lat: Number, lng: Number, timestamp: Date }],
  specialInstructions: { type: String, maxlength: 500 },

  // Pricing (cents)
  basePrice:   { type: Number, required: true },
  addOnPrice:  { type: Number, default: 0 },
  totalPrice:  { type: Number, required: true },

  // Payment
  stripePaymentIntentId: String,
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'refunded', 'failed'],
    default: 'pending',
  },
  paidAt: Date,

  // Tip (cents)
  tipAmount:               { type: Number, default: 0 },
  tipPaidAt:               Date,
  stripeTipPaymentIntentId: String,

  // Review
  review: reviewSchema,

  // Admin
  adminNotes:          String,
  cancelledBy:         { type: String, enum: ['client', 'walker', 'admin'] },
  cancellationReason:  String,
  cancelledAt:         Date,
  completedAt:         Date,
  acceptedAt:          Date,
  startedAt:           Date,
}, { timestamps: true, toJSON: { virtuals: true } });

bookingSchema.virtual('totalPriceDollars').get(function () {
  return (this.totalPrice / 100).toFixed(2);
});
bookingSchema.virtual('tipAmountDollars').get(function () {
  return (this.tipAmount / 100).toFixed(2);
});

bookingSchema.index({ client: 1, status: 1 });
bookingSchema.index({ walker: 1, status: 1 });
bookingSchema.index({ scheduledDate: 1 });

module.exports = mongoose.model('Booking', bookingSchema);
