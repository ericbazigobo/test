const mongoose = require('mongoose');

const AppointmentSchema = new mongoose.Schema({
  patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  staff: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff', required: true },
  date: { type: Date, required: true },
  status: { type: String, enum: ['scheduled', 'completed', 'cancelled'], default: 'scheduled' },
  notes: String,
  pharmacyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pharmacy', required: false }
}, { timestamps: true });

// Indexes for fast queries
AppointmentSchema.index({ pharmacyId: 1 });
AppointmentSchema.index({ pharmacyId: 1, date: 1 });
AppointmentSchema.index({ patient: 1, pharmacyId: 1 });

module.exports = mongoose.model('Appointment', AppointmentSchema);
