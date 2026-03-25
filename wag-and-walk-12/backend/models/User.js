const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const availabilitySchema = new mongoose.Schema({
  dayOfWeek:  { type: Number, min: 0, max: 6, required: true }, // 0=Sun
  startTime:  { type: String, required: true }, // "HH:MM"
  endTime:    { type: String, required: true },
}, { _id: false });

const walkerProfileSchema = new mongoose.Schema({
  age:              Number,
  bio:              { type: String, default: '' },
  experience:       { type: String, default: '' },
  serviceRadius:    { type: Number, default: 5 },
  isAvailable:      { type: Boolean, default: true },
  isVerified:       { type: Boolean, default: false },
  stripeAccountId:  String,
  averageRating:    { type: Number, default: 0, min: 0, max: 5 },
  ratingCount:      { type: Number, default: 0 },
  totalWalks:       { type: Number, default: 0 },
  totalEarnings:    { type: Number, default: 0 },   // cents
  totalTips:        { type: Number, default: 0 },   // cents
  availability:     [availabilitySchema],
}, { _id: false });

const userSchema = new mongoose.Schema({
  firstName:    { type: String, required: [true, 'First name is required'], trim: true },
  lastName:     { type: String, required: [true, 'Last name is required'], trim: true },
  email:        { type: String, required: [true, 'Email is required'], unique: true, lowercase: true, trim: true,
                  match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'] },
  password:     { type: String, required: [true, 'Password is required'], minlength: [8, 'Password must be at least 8 characters'] },
  role:         { type: String, enum: ['client', 'walker', 'admin'], default: 'client' },
  phone:        { type: String, default: '' },
  profilePhoto: { type: String, default: '' },
  isActive:     { type: Boolean, default: true },
  isEmailVerified: { type: Boolean, default: false },
  emailVerificationToken: String,
  passwordResetToken:     String,
  passwordResetExpiry:    Date,
  stripeCustomerId:       String,
  address: {
    street:      { type: String, default: '' },
    city:        { type: String, default: '' },
    state:       { type: String, default: '' },
    zip:         { type: String, default: '' },
    coordinates: {
      lat: Number,
      lng: Number,
    },
  },
  walkerProfile: walkerProfileSchema,
  favoriteWalkers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
}, { timestamps: true });

// Indexes
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });

// Hash password before save
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password
userSchema.methods.comparePassword = async function (plain) {
  return bcrypt.compare(plain, this.password);
};

// Strip password from JSON
userSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.emailVerificationToken;
  delete obj.passwordResetToken;
  delete obj.passwordResetExpiry;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
