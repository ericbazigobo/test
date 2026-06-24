const mongoose = require('mongoose');

const ExpenseSchema = new mongoose.Schema({
  reason: { type: String, required: true },
  amount: { type: Number, required: true },
  category: { type: String, enum: ['salaires', 'charges', 'pertes', 'autres'], default: 'autres' },
  pharmacyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pharmacy', required: true },
  date: { type: Date, default: Date.now },
  note: { type: String }
}, { timestamps: true });

ExpenseSchema.index({ pharmacyId: 1, date: -1 });

module.exports = mongoose.model('Expense', ExpenseSchema);
