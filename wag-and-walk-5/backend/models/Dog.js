const mongoose = require('mongoose');

const dogSchema = new mongoose.Schema({
  owner:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name:   { type: String, required: true, trim: true, maxlength: 50 },
  breed:  { type: String, trim: true, maxlength: 100 },
  size:   { type: String, enum: ['small', 'medium', 'large', 'xlarge'], required: true },
  age:    { type: Number, min: 0, max: 30 },
  weight: Number,
  gender: { type: String, enum: ['male', 'female'] },
  color:  String,
  photo:  String,
  isNeutered:   Boolean,
  isVaccinated: Boolean,
  veterinarian: { name: String, phone: String, clinic: String },
  specialInstructions: { type: String, maxlength: 1000 },
  medicalConditions:   { type: String, maxlength: 500 },
  feedingInstructions: { type: String, maxlength: 500 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Dog', dogSchema);
