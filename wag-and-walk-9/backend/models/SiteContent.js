const mongoose = require('mongoose');

const testimonialSchema = new mongoose.Schema({
  clientName:  { type: String, required: true },
  dogName:     { type: String, default: '' },
  text:        { type: String, required: true },
  rating:      { type: Number, min: 1, max: 5, default: 5 },
  photoUrl:    { type: String, default: '' },
  isVisible:   { type: Boolean, default: true },
  order:       { type: Number, default: 0 },
}, { _id: true, timestamps: true });

const pricingTierSchema = new mongoose.Schema({
  name:        { type: String, required: true },
  duration:    { type: Number, required: true }, // minutes
  price:       { type: Number, required: true }, // cents
  description: { type: String, default: '' },
  isPopular:   { type: Boolean, default: false },
  isVisible:   { type: Boolean, default: true },
  order:       { type: Number, default: 0 },
}, { _id: true });

const galleryImageSchema = new mongoose.Schema({
  url:         { type: String, required: true },
  caption:     { type: String, default: '' },
  altText:     { type: String, default: '' },
  order:       { type: Number, default: 0 },
  isVisible:   { type: Boolean, default: true },
}, { _id: true });

const siteContentSchema = new mongoose.Schema({
  key: { type: String, default: 'main', unique: true },

  // Hero section
  hero: {
    headline:    { type: String, default: 'Your dog deserves the best walk in the neighborhood.' },
    subheadline: { type: String, default: 'Connect with trusted local walkers in Naperville who love dogs as much as you do.' },
    imageUrl:    { type: String, default: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=1400&q=80' },
    ctaPrimary:  { type: String, default: 'Book a Walk' },
    ctaSecondary:{ type: String, default: 'Become a Walker' },
  },

  // Announcement banner
  announcement: {
    text:      { type: String, default: '' },
    linkUrl:   { type: String, default: '' },
    linkText:  { type: String, default: '' },
    isVisible: { type: Boolean, default: false },
    bgColor:   { type: String, default: '#2D1B0E' },
  },

  // Testimonials
  testimonials: [testimonialSchema],

  // Pricing
  pricing: {
    heading:     { type: String, default: 'Simple, transparent pricing' },
    subheading:  { type: String, default: 'No hidden fees. Pay per walk.' },
    addOnPrice:  { type: Number, default: 500 }, // cents per extra dog
    tiers:       [pricingTierSchema],
  },

  // Featured walkers (IDs of walkers to highlight)
  featuredWalkers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],

  // Photo gallery
  gallery: [galleryImageSchema],

  // Stats (manually editable)
  stats: {
    activeWalkers:   { type: Number, default: 50 },
    walksCompleted:  { type: Number, default: 500 },
    averageRating:   { type: String, default: '4.9' },
  },

}, { timestamps: true });

// Ensure only one document exists
siteContentSchema.statics.getContent = async function () {
  let content = await this.findOne({ key: 'main' }).populate('featuredWalkers', 'firstName lastName profilePhoto walkerProfile');
  if (!content) {
    content = await this.create({
      key: 'main',
      pricing: {
        tiers: [
          { name: '20-Minute Walk', duration: 20, price: 1000, description: 'Quick potty break for busy days.', order: 0 },
          { name: '30-Minute Walk', duration: 30, price: 2000, description: 'A solid neighborhood stroll.', isPopular: true, order: 1 },
          { name: '60-Minute Walk', duration: 60, price: 4000, description: 'Full exploration for high-energy dogs.', order: 2 },
        ],
      },
      testimonials: [
        { clientName: 'Sarah M.', dogName: 'Biscuit', text: 'Emma is absolutely wonderful. Biscuit adores her and I have complete peace of mind.', rating: 5, order: 0 },
        { clientName: 'David T.', dogName: 'Rex', text: 'Marcus is great with large breeds. Rex comes home tired and happy every time.', rating: 5, order: 1 },
      ],
    });
  }
  return content;
};

module.exports = mongoose.model('SiteContent', siteContentSchema);
