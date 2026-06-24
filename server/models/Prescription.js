const mongoose = require('mongoose');

const prescriptionSchema = new mongoose.Schema({
  consultationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Consultation' },
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, default: Date.now },
  medications: [{
    medicineId: { type: mongoose.Schema.Types.ObjectId, ref: 'Medicine' },
    medicineName: { type: String, required: true }, // In case the medicine is not in internal pharmacy stock
    dosage: { type: String, required: true },
    duration: { type: String, required: true },
    quantity: { type: Number },
    observations: { type: String }
  }],
  status: { type: String, enum: ['En attente', 'Servie', 'Partiellement servie'], default: 'En attente' },
  notes: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Prescription', prescriptionSchema);
