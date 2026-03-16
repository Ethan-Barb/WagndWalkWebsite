const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const availabilitySlotSchema = new mongoose.Schema({
  dayOfWeek: { type: Number, min: 0, max: 6 },  // 0=Sun … 6=Sat
  startTime:  String,   // "09:00"
  endTime:    String,   // "17:00"
}, { _id: false });

const walkerProfileSchema = new mongoose.Schema({
  age:             { type: Number, min: 14, max: 99 },
  bio:             { type: String, maxlength: 500 },
  experience:      { type: String, maxlength: 1000 },
  availability:    [availabilitySlotSchema],
  stripeAccountId: String,
  totalEarnings:   { type: Number, default: 0 },   // cents
  totalTips:       { type: Number, default: 0 },    // cents
  totalWalks:      { type: Number, default: 0 },
  averageRating:   { type: Number, default: 0 },
  ratingCount:     { type: Number, default: 0 },
  isAvailable:     { type: Boolean, default: true },
  serviceRadius:   { type: Number, default: 5 },    // miles
}, { _id: false });

const userSchema = new mongoose.Schema({
  firstName: { type: String, required: true, trim: true, maxlength: 50 },
  lastName:  { type: String, required: true, trim: true, maxlength: 50 },
  email:     { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:  { type: String, required: true, minlength: 8, select: false },
  phone:     { type: String, trim: true },
  role:      { type: String, enum: ['client', 'walker', 'admin'], default: 'client' },
  address: {
    street: String,
    city:   { type: String, default: 'Naperville' },
    state:  { type: String, default: 'IL' },
    zip:    String,
    coordinates: { lat: Number, lng: Number },
  },
  profilePhoto:     String,
  walkerProfile:    walkerProfileSchema,
  stripeCustomerId: String,
  notificationPrefs: {
    email: { type: Boolean, default: true },
    sms:   { type: Boolean, default: false },
  },
  isActive:              { type: Boolean, default: true },
  isEmailVerified:       { type: Boolean, default: false },
  emailVerificationToken: String,
  passwordResetToken:    String,
  passwordResetExpires:  Date,
  lastLogin:             Date,
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

userSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.emailVerificationToken;
  delete obj.passwordResetToken;
  delete obj.passwordResetExpires;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
