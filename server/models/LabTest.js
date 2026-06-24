const mongoose = require('mongoose');

const labTestSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  labTechId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  testName: { type: String, required: true },
  category: { type: String, enum: ['Hématologie', 'Biochimie', 'Microbiologie', 'Immunologie', 'Imagerie', 'Autre'], default: 'Autre' },
  dateRequested: { type: Date, default: Date.now },
  dateCompleted: { type: Date },
  results: { type: String },
  status: { type: String, enum: ['Demandé', 'En cours', 'Terminé'], default: 'Demandé' },
  notes: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('LabTest', labTestSchema);
