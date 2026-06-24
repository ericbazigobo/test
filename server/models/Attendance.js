const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff', required: true },
  date: { type: Date, default: Date.now },
  clockIn: { type: Date },
  clockOut: { type: Date },
  status: { type: String, enum: ['Présent', 'Absent', 'Congé', 'Maladie', 'Retard'], default: 'Présent' },
  notes: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
