const mongoose = require('mongoose');

const dogSchema = new mongoose.Schema({
  owner:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name:         { type: String, required: [true, 'Dog name is required'], trim: true },
  breed:        { type: String, default: '' },
  size:         { type: String, enum: ['small', 'medium', 'large', 'xlarge'], required: true },
  age:          Number,
  weight:       Number,
  gender:       { type: String, enum: ['male', 'female', ''] },
  color:        { type: String, default: '' },
  isNeutered:   { type: Boolean, default: false },
  isVaccinated: { type: Boolean, default: false },
  profilePhoto: { type: String, default: '' },
  specialInstructions: { type: String, default: '' },
  medicalConditions:   { type: String, default: '' },
  feedingInstructions: { type: String, default: '' },
  emergencyContact: {
    name:     String,
    phone:    String,
    relation: String,
  },
  veterinarian: {
    name:    String,
    clinic:  String,
    phone:   String,
    address: String,
  },
}, { timestamps: true });

dogSchema.index({ owner: 1 });

module.exports = mongoose.model('Dog', dogSchema);
