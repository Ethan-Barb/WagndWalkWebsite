const Booking = require('../models/Booking');
const User    = require('../models/User');

const SLOT_START = 7;   // 7 AM
const SLOT_END   = 20;  // 8 PM

/** Returns true if a walker is free at the requested date/time */
exports.checkWalkerAvailability = async (walkerId, date, startTime, endTime) => {
  const walker = await User.findById(walkerId);
  if (!walker?.walkerProfile?.isAvailable) return false;

  const dayOfWeek   = new Date(date).getDay();
  const daySchedule = walker.walkerProfile.availability?.find(a => a.dayOfWeek === dayOfWeek);
  if (!daySchedule) return false;
  if (startTime < daySchedule.startTime || endTime > daySchedule.endTime) return false;

  const conflict = await Booking.findOne({
    walker: walkerId,
    scheduledDate: new Date(date),
    status: { $in: ['pending', 'accepted', 'in_progress'] },
    startTime: { $lt: endTime },
    endTime:   { $gt: startTime },
  });
  return !conflict;
};

/** Get hourly time slots for a date, optionally scoped to a walker */
exports.getAvailableSlots = async (dateStr, walkerId) => {
  const slots = [];
  for (let h = SLOT_START; h < SLOT_END; h++) {
    slots.push({
      startTime: `${String(h).padStart(2,'0')}:00`,
      endTime:   `${String(h+1).padStart(2,'0')}:00`,
      available: true,
    });
  }

  if (!walkerId) return slots;

  const walker = await User.findById(walkerId);
  if (!walker) return slots.map(s => ({ ...s, available: false }));

  const dayOfWeek   = new Date(dateStr).getDay();
  const daySchedule = walker.walkerProfile?.availability?.find(a => a.dayOfWeek === dayOfWeek);

  const booked = await Booking.find({
    walker: walkerId,
    scheduledDate: new Date(dateStr),
    status: { $in: ['pending', 'accepted', 'in_progress'] },
  }).select('startTime endTime');

  return slots.map(slot => {
    const inHours  = daySchedule && slot.startTime >= daySchedule.startTime && slot.endTime <= daySchedule.endTime;
    const conflict = booked.some(b => b.startTime <= slot.startTime && b.endTime > slot.startTime);
    return { ...slot, available: !!inHours && !conflict };
  });
};

/** Return walkers available for a given date + time range */
exports.getAvailableWalkers = async (date, startTime, endTime) => {
  const dayOfWeek = new Date(date).getDay();
  const walkers   = await User.find({
    role: 'walker', isActive: true,
    'walkerProfile.isAvailable': true,
    'walkerProfile.availability': {
      $elemMatch: { dayOfWeek, startTime: { $lte: startTime }, endTime: { $gte: endTime } },
    },
  }).select('firstName lastName profilePhoto walkerProfile');

  const ids       = walkers.map(w => w._id);
  const conflicts = await Booking.find({
    walker: { $in: ids },
    scheduledDate: new Date(date),
    status: { $in: ['pending', 'accepted', 'in_progress'] },
    startTime: { $lt: endTime },
    endTime:   { $gt: startTime },
  }).select('walker');

  const conflicted = new Set(conflicts.map(b => b.walker.toString()));
  return walkers.filter(w => !conflicted.has(w._id.toString()));
};
