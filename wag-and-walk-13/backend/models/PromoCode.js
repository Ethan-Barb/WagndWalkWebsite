const mongoose = require('mongoose');

const promoCodeSchema = new mongoose.Schema({
  code:        { type: String, required: true, unique: true, uppercase: true, trim: true },
  type:        { type: String, enum: ['fixed', 'percent'], default: 'fixed' },
  amount:      { type: Number, required: true }, // cents for fixed, percent for percent
  description: { type: String, default: '' },
  isActive:    { type: Boolean, default: true },
  maxUses:     { type: Number, default: 0 }, // 0 = unlimited
  usedCount:   { type: Number, default: 0 },
  usedBy:      [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  expiresAt:   { type: Date },
  createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

promoCodeSchema.index({ code: 1 }, { unique: true });

promoCodeSchema.methods.isValid = function (userId) {
  if (!this.isActive) return { valid: false, error: 'Code is inactive' };
  if (this.expiresAt && this.expiresAt < new Date()) return { valid: false, error: 'Code has expired' };
  if (this.maxUses > 0 && this.usedCount >= this.maxUses) return { valid: false, error: 'Code has been fully redeemed' };
  if (userId && this.usedBy.includes(userId)) return { valid: false, error: 'You have already used this code' };
  return { valid: true };
};

promoCodeSchema.methods.calculateDiscount = function (totalCents) {
  if (this.type === 'percent') return Math.round(totalCents * (this.amount / 100));
  return Math.min(this.amount, totalCents);
};

module.exports = mongoose.model('PromoCode', promoCodeSchema);
