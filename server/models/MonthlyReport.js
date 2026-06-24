const mongoose = require('mongoose');

const MonthlyReportSchema = new mongoose.Schema({
  month: { type: Number, required: true },
  year: { type: Number, required: true },
  totalPharmacyRevenue: { type: Number, default: 0 },
  roomRevenues: { type: Number, default: 0 },
  expenses: { type: Number, default: 0 },
  profit: { type: Number, default: 0 },
  patientCount: { type: Number, default: 0 },
  admissionCount: { type: Number, default: 0 },
  pharmacyRevenues: {
    type: Map,
    of: new mongoose.Schema({
      name: String,
      revenue: Number,
      startingCapital: { type: Number, default: 0 },
      endingCapital: { type: Number, default: 0 }
    })
  },
  date: { type: Date, default: Date.now }
}, { timestamps: true });

// Ensure one report per month/year
MonthlyReportSchema.index({ month: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('MonthlyReport', MonthlyReportSchema);
