const mongoose = require('mongoose');

const RoomSchema = new mongoose.Schema({
  number: { type: String, required: true },
  type: { type: String, enum: ['standard', 'deluxe', 'icu'], default: 'standard' },
  status: { type: String, enum: ['vacant', 'occupied', 'cleaning'], default: 'vacant' },
  price: { type: Number, default: 15000 },
  assignedPatient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', default: null },
  pharmacyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pharmacy' }
}, { timestamps: true });

// Unique number
RoomSchema.index({ number: 1 }, { unique: true });
// Additional indexes for queries
RoomSchema.index({ pharmacyId: 1 });
RoomSchema.index({ status: 1 });

module.exports = mongoose.model('Room', RoomSchema);
