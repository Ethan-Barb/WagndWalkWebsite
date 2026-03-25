require('dotenv').config();
const mongoose = require('mongoose');
const User    = require('../backend/models/User');
const Dog     = require('../backend/models/Dog');
const Booking = require('../backend/models/Booking');

const seed = async () => {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/wag-and-walk');
  console.log('✅ Connected');

  await Promise.all([User.deleteMany(), Dog.deleteMany(), Booking.deleteMany()]);
  console.log('🗑  Cleared existing data');

  // ── Admin ───────────────────────────────────
  const admin = await User.create({
    firstName: 'Admin', lastName: 'User',
    email:    process.env.ADMIN_EMAIL    || 'admin@wagandwalk.com',
    password: process.env.ADMIN_PASSWORD || 'Admin123!',
    role: 'admin', isEmailVerified: true,
    address: { city: 'Naperville', state: 'IL', zip: '60540' },
  });

  // ── Walkers ─────────────────────────────────
  const [emma, marcus, sophia] = await User.create([
    {
      firstName: 'Emma', lastName: 'Johnson',
      email: 'emma@example.com', password: 'Walker123!',
      phone: '630-555-0101', role: 'walker', isEmailVerified: true,
      address: { street: '123 Main St', city: 'Naperville', state: 'IL', zip: '60540',
                 coordinates: { lat: 41.7508, lng: -88.1535 } },
      walkerProfile: {
        age: 19,
        bio: 'Lifelong dog lover with 3 dogs of my own and 5 years of walking experience.',
        experience: 'All breeds welcome. Pet CPR certified.',
        isAvailable: true, averageRating: 4.9, ratingCount: 42, totalWalks: 42,
        totalEarnings: 84000, totalTips: 8500,
        availability: [
          { dayOfWeek: 1, startTime: '15:00', endTime: '20:00' },
          { dayOfWeek: 2, startTime: '15:00', endTime: '20:00' },
          { dayOfWeek: 3, startTime: '15:00', endTime: '20:00' },
          { dayOfWeek: 6, startTime: '08:00', endTime: '18:00' },
          { dayOfWeek: 0, startTime: '08:00', endTime: '18:00' },
        ],
      },
    },
    {
      firstName: 'Marcus', lastName: 'Rivera',
      email: 'marcus@example.com', password: 'Walker123!',
      phone: '630-555-0102', role: 'walker', isEmailVerified: true,
      address: { street: '456 Oak Ave', city: 'Naperville', state: 'IL', zip: '60563',
                 coordinates: { lat: 41.7650, lng: -88.1470 } },
      walkerProfile: {
        age: 17,
        bio: 'High school junior, great with high-energy and large breeds!',
        experience: 'Grew up with German Shepherds. Basic pet first aid trained.',
        isAvailable: true, averageRating: 4.7, ratingCount: 18, totalWalks: 18,
        totalEarnings: 32400, totalTips: 2200,
        availability: [
          { dayOfWeek: 1, startTime: '16:00', endTime: '20:00' },
          { dayOfWeek: 3, startTime: '16:00', endTime: '20:00' },
          { dayOfWeek: 5, startTime: '16:00', endTime: '20:00' },
          { dayOfWeek: 6, startTime: '09:00', endTime: '17:00' },
        ],
      },
    },
    {
      firstName: 'Sophia', lastName: 'Chen',
      email: 'sophia@example.com', password: 'Walker123!',
      phone: '630-555-0103', role: 'walker', isEmailVerified: true,
      address: { street: '789 Elm St', city: 'Naperville', state: 'IL', zip: '60565',
                 coordinates: { lat: 41.7420, lng: -88.1610 } },
      walkerProfile: {
        age: 20,
        bio: 'Pre-vet student at North Central College. Specializing in small dogs and seniors.',
        experience: '2 years volunteering at DuPage County Animal Shelter. Special needs dog experience.',
        isAvailable: true, averageRating: 5.0, ratingCount: 11, totalWalks: 11,
        totalEarnings: 17600, totalTips: 3100,
        availability: [
          { dayOfWeek: 2, startTime: '14:00', endTime: '18:00' },
          { dayOfWeek: 4, startTime: '14:00', endTime: '18:00' },
          { dayOfWeek: 0, startTime: '09:00', endTime: '15:00' },
        ],
      },
    },
  ]);

  // ── Clients ─────────────────────────────────
  const [sarah, david] = await User.create([
    {
      firstName: 'Sarah', lastName: 'Mitchell',
      email: 'sarah@example.com', password: 'Client123!',
      phone: '630-555-0201', role: 'client', isEmailVerified: true,
      address: { street: '321 Willow Ln', city: 'Naperville', state: 'IL', zip: '60540',
                 coordinates: { lat: 41.7520, lng: -88.1550 } },
    },
    {
      firstName: 'David', lastName: 'Thompson',
      email: 'david@example.com', password: 'Client123!',
      phone: '630-555-0202', role: 'client', isEmailVerified: true,
      address: { street: '654 Maple Dr', city: 'Naperville', state: 'IL', zip: '60563',
                 coordinates: { lat: 41.7600, lng: -88.1480 } },
    },
  ]);

  // ── Dogs ────────────────────────────────────
  const [biscuit, lily, rex] = await Dog.create([
    {
      owner: sarah._id, name: 'Biscuit', breed: 'Golden Retriever',
      size: 'large', age: 3, weight: 65, gender: 'male', color: 'Golden',
      isNeutered: true, isVaccinated: true,
      specialInstructions: 'Loves fetch. Excited around other dogs. Keep on leash.',
      veterinarian: { name: 'Dr. Smith', clinic: 'Naperville Animal Hospital', phone: '630-555-9900' },
    },
    {
      owner: sarah._id, name: 'Lily', breed: 'Shih Tzu',
      size: 'small', age: 5, weight: 12, gender: 'female', color: 'White & Brown',
      isNeutered: true, isVaccinated: true,
      specialInstructions: 'Shy at first. Allergic to chicken treats.',
      medicalConditions: 'Mild anxiety.',
    },
    {
      owner: david._id, name: 'Rex', breed: 'German Shepherd',
      size: 'large', age: 4, weight: 80, gender: 'male', color: 'Black & Tan',
      isNeutered: true, isVaccinated: true,
      specialInstructions: 'Well trained. Knows sit/stay/heel. Needs firm, gentle handler.',
      feedingInstructions: 'Half cup kibble if walk ends after 5pm.',
    },
  ]);

  // ── Bookings ─────────────────────────────────
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 2); tomorrow.setHours(0,0,0,0);
  const nextWeek = new Date(); nextWeek.setDate(nextWeek.getDate() + 6);  nextWeek.setHours(0,0,0,0);
  const lastWeek = new Date(); lastWeek.setDate(lastWeek.getDate() - 5);  lastWeek.setHours(0,0,0,0);

  await Booking.create([
    // Upcoming accepted
    {
      client: sarah._id, walker: emma._id, dogs: [biscuit._id],
      status: 'accepted', scheduledDate: tomorrow,
      startTime: '15:00', endTime: '16:00', durationMinutes: 60,
      pickupAddress: { street: '321 Willow Ln', city: 'Naperville', state: 'IL', zip: '60540' },
      basePrice: 2000, addOnPrice: 0, totalPrice: 2000,
      paymentStatus: 'paid', stripePaymentIntentId: 'pi_seed_001',
      acceptedAt: new Date(), paidAt: new Date(),
    },
    // Pending request
    {
      client: david._id, walker: marcus._id, dogs: [rex._id],
      status: 'pending', scheduledDate: nextWeek,
      startTime: '16:00', endTime: '17:00', durationMinutes: 60,
      pickupAddress: { street: '654 Maple Dr', city: 'Naperville', state: 'IL', zip: '60563' },
      basePrice: 2000, addOnPrice: 0, totalPrice: 2000,
      paymentStatus: 'pending', stripePaymentIntentId: 'pi_seed_002',
    },
    // Completed with tip + review
    {
      client: sarah._id, walker: emma._id, dogs: [biscuit._id, lily._id],
      status: 'completed', scheduledDate: lastWeek,
      startTime: '10:00', endTime: '11:00', durationMinutes: 60,
      pickupAddress: { street: '321 Willow Ln', city: 'Naperville', state: 'IL', zip: '60540' },
      basePrice: 2000, addOnPrice: 500, totalPrice: 2500,
      paymentStatus: 'paid', stripePaymentIntentId: 'pi_seed_003',
      paidAt: lastWeek, acceptedAt: lastWeek, completedAt: lastWeek,
      tipAmount: 500, tipPaidAt: lastWeek,
      review: { rating: 5, comment: 'Emma is absolutely wonderful! Biscuit and Lily adore her.' },
    },
  ]);

  console.log('\n✅ Seed complete!');
  console.log('──────────────────────────────────');
  console.log('Admin    :', admin.email);
  console.log('Walkers  :', [emma, marcus, sophia].map(w => w.email).join(', '));
  console.log('Clients  :', [sarah, david].map(c => c.email).join(', '));
  console.log('Dogs     :', [biscuit, lily, rex].map(d => d.name).join(', '));
  console.log('──────────────────────────────────');

  await mongoose.disconnect();
};

seed().catch(err => { console.error('Seed failed:', err); process.exit(1); });
