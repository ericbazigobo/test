const mongoose = require('mongoose');

const AdmissionSchema = new mongoose.Schema({
  patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
  status: { type: String, enum: ['admitted', 'discharged', 'pending'], default: 'admitted' },
  admittedAt: { type: Date, default: Date.now },
  dischargedAt: { type: Date },
  treatment: { type: String },
  notes: { type: String },
  pharmacyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pharmacy' }
}, { timestamps: true });

// Indexes for fast queries
AdmissionSchema.index({ pharmacyId: 1 });
AdmissionSchema.index({ admittedAt: -1 });
AdmissionSchema.index({ patient: 1 });
AdmissionSchema.index({ status: 1 });

module.exports = mongoose.model('Admission', AdmissionSchema);
