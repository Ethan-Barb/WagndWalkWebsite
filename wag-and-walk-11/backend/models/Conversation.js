const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content:   { type: String, required: true, maxlength: 2000 },
  readBy:    [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  imageUrl:  { type: String, default: '' },
}, { timestamps: true });

const conversationSchema = new mongoose.Schema({
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
  booking:      { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
  lastMessage:  { type: String, default: '' },
  lastMessageAt:{ type: Date, default: Date.now },
  messages:     [messageSchema],
}, { timestamps: true });

conversationSchema.index({ participants: 1 });
conversationSchema.index({ lastMessageAt: -1 });

module.exports = mongoose.model('Conversation', conversationSchema);
