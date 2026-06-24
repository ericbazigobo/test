const mongoose = require('mongoose');

const supplierSchema = new mongoose.Schema({
  pharmacyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pharmacy', required: true },
  name: { type: String, required: true },
  contactPerson: { type: String },
  phone: { type: String },
  email: { type: String },
  address: { type: String },
  status: { type: String, enum: ['Actif', 'Inactif'], default: 'Actif' }
}, { timestamps: true });

module.exports = mongoose.model('Supplier', supplierSchema);
