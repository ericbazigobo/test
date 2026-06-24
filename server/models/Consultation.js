const mongoose = require('mongoose');

const consultationSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, default: Date.now },
  vitals: {
    bloodPressure: { type: String }, // ex: "120/80"
    temperature: { type: Number },
    weight: { type: Number },
    height: { type: Number }
  },
  clinicalNotes: {
    symptoms: { type: String },
    diagnosis: { type: String },
    plan: { type: String }
  },
  status: { type: String, enum: ['En cours', 'Terminée'], default: 'Terminée' }
}, { timestamps: true });

module.exports = mongoose.model('Consultation', consultationSchema);
