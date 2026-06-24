const mongoose = require('mongoose');

const CaisseTransactionSchema = new mongoose.Schema({
  pharmacyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pharmacy', required: true },
  type: { type: String, enum: ['recette', 'sortie'], required: true },
  amount: { type: Number, required: true },
  reason: { type: String, required: true },
  date: { type: Date, required: true }
}, { timestamps: true });

CaisseTransactionSchema.index({ pharmacyId: 1, date: -1 });

module.exports = mongoose.model('CaisseTransaction', CaisseTransactionSchema);
