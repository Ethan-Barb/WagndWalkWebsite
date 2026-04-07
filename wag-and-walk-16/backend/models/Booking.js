const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  client:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  walker:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  dogs:     [{ type: mongoose.Schema.Types.ObjectId, ref: 'Dog', required: true }],

  status: {
    type: String,
    enum: ['pending', 'accepted', 'walker_assigned', 'on_the_way', 'in_progress', 'completed', 'cancelled', 'declined'],
    default: 'pending',
  },

  scheduledDate:   { type: Date, required: true },
  startTime:       { type: String, required: true },
  endTime:         { type: String, required: true },
  durationMinutes: { type: Number, default: 60 },

  pickupAddress: {
    street: String,
    city:   String,
    state:  String,
    zip:    String,
    coordinates: { lat: Number, lng: Number },
  },
  specialInstructions: { type: String, default: '' },

  basePrice:  { type: Number, default: 2000 }, // cents
  addOnPrice: { type: Number, default: 0 },
  totalPrice: { type: Number, required: true },

  paymentStatus:         { type: String, enum: ['pending', 'paid', 'refunded', 'failed'], default: 'pending' },
  stripePaymentIntentId: String,
  stripeCustomerId:      String,

  tipAmount:        { type: Number, default: 0 },
  stripeTipIntentId: String,
  tipPaidAt:         Date,

  gpsRoute: [{ lat: Number, lng: Number, timestamp: Date }],
  walkPhotos: [{ url: String, caption: String, uploadedAt: { type: Date, default: Date.now } }],

  cancelledBy:        { type: String, enum: ['client', 'walker', 'admin'] },
  cancellationReason: String,
  cancelledAt:        Date,
  adminNotes:         String,

  acceptedAt:  Date,
  startedAt:   Date,
  completedAt: Date,
  paidAt:      Date,

  review: {
    rating:    { type: Number, min: 1, max: 5 },
    comment:   String,
    createdAt: Date,
  },
}, { timestamps: true });

bookingSchema.index({ client: 1 });
bookingSchema.index({ walker: 1 });
bookingSchema.index({ status: 1 });
bookingSchema.index({ scheduledDate: 1 });

module.exports = mongoose.model('Booking', bookingSchema);
