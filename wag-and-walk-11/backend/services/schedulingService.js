const Booking = require('../models/Booking');
const User    = require('../models/User');

/**
 * Check if a walker is available for a given date/time.
 */
exports.isWalkerAvailable = async (walkerId, scheduledDate, startTime, endTime) => {
  const walker = await User.findById(walkerId);
  if (!walker || walker.role !== 'walker') return false;
  if (!walker.walkerProfile?.isAvailable) return false;

  // Check day-of-week availability
  const date = new Date(scheduledDate);
  const dayOfWeek = date.getDay(); // 0=Sun
  const avail = walker.walkerProfile.availability || [];

  const hasSlot = avail.some(a =>
    a.dayOfWeek === dayOfWeek &&
    a.startTime <= startTime &&
    a.endTime >= endTime
  );
  if (!hasSlot && avail.length > 0) return false;

  // Check for conflicting bookings
  const startOfDay = new Date(date); startOfDay.setHours(0, 0, 0, 0);
  const endOfDay   = new Date(date); endOfDay.setHours(23, 59, 59, 999);

  const conflicts = await Booking.find({
    walker: walkerId,
    scheduledDate: { $gte: startOfDay, $lte: endOfDay },
    status: { $in: ['pending', 'accepted', 'in_progress'] },
    $or: [
      { startTime: { $lt: endTime }, endTime: { $gt: startTime } },
    ],
  });

  return conflicts.length === 0;
};

/**
 * Get available time slots for a specific date, optionally for a specific walker.
 */
exports.getAvailableSlots = async (date, walkerId) => {
  const dayOfWeek = new Date(date).getDay();
  const allSlots = [
    { startTime: '07:00', endTime: '08:00' },
    { startTime: '08:00', endTime: '09:00' },
    { startTime: '09:00', endTime: '10:00' },
    { startTime: '10:00', endTime: '11:00' },
    { startTime: '11:00', endTime: '12:00' },
    { startTime: '12:00', endTime: '13:00' },
    { startTime: '13:00', endTime: '14:00' },
    { startTime: '14:00', endTime: '15:00' },
    { startTime: '15:00', endTime: '16:00' },
    { startTime: '16:00', endTime: '17:00' },
    { startTime: '17:00', endTime: '18:00' },
    { startTime: '18:00', endTime: '19:00' },
    { startTime: '19:00', endTime: '20:00' },
  ];

  const startOfDay = new Date(date); startOfDay.setHours(0, 0, 0, 0);
  const endOfDay   = new Date(date); endOfDay.setHours(23, 59, 59, 999);

  const query = {
    scheduledDate: { $gte: startOfDay, $lte: endOfDay },
    status: { $in: ['pending', 'accepted', 'in_progress'] },
  };
  if (walkerId) query.walker = walkerId;

  const existingBookings = await Booking.find(query);

  // If specific walker, filter by their availability window
  let walkerAvail = null;
  if (walkerId) {
    const walker = await User.findById(walkerId);
    if (walker?.walkerProfile?.availability?.length) {
      walkerAvail = walker.walkerProfile.availability.filter(a => a.dayOfWeek === dayOfWeek);
    }
  }

  return allSlots.map(slot => {
    let available = true;

    // Check walker availability window
    if (walkerAvail && walkerAvail.length > 0) {
      const inWindow = walkerAvail.some(a =>
        a.startTime <= slot.startTime && a.endTime >= slot.endTime
      );
      if (!inWindow) available = false;
    }

    // Check existing bookings for conflicts
    if (available) {
      const conflict = existingBookings.some(b =>
        b.startTime < slot.endTime && b.endTime > slot.startTime
      );
      if (conflict) available = false;
    }

    return { ...slot, available };
  });
};

/**
 * Calculate booking price (in cents).
 * Base: $20 for 60 min. Each extra dog: +$5.
 */
exports.calculatePrice = (durationMinutes, dogCount) => {
  let basePrice;
  if (durationMinutes <= 20)      basePrice = 1000;
  else if (durationMinutes <= 30) basePrice = 2000;
  else                            basePrice = 4000;

  // Default to $20 for standard 60 min
  if (durationMinutes === 60) basePrice = 2000;

  const addOnPrice = Math.max(0, dogCount - 1) * 500;
  return { basePrice, addOnPrice, totalPrice: basePrice + addOnPrice };
};
