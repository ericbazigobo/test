const mongoose = require('mongoose');

const StaffSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  code: { type: String, unique: true },
  role: { type: String, enum: ['doctor', 'nurse', 'reception', 'admin'], required: true },
  specialty: { type: String },
  phone: { type: String },
  email: { type: String },
  baseSalary: { type: Number, default: 0 },
  commission: { type: Number, default: 0 },
  pharmacyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pharmacy' }
}, { timestamps: true });

// Indexes for fast queries
StaffSchema.index({ lastName: 1, firstName: 1 });
StaffSchema.index({ role: 1 });
StaffSchema.index({ pharmacyId: 1 });

// Auto-generate unique staff codes (AG00001) and family member suffixes
StaffSchema.pre('save', async function(next) {
  if (!this.isNew || this.code) return next();
  try {
    const Model = mongoose.model('Staff');
    const prefix = 'AG';
    const count = await Model.countDocuments({});
    this.code = `${prefix}${String(count + 1).padStart(5, '0')}`;
  } catch (err) {
    return next(err);
  }
  next();
});

module.exports = mongoose.model('Staff', StaffSchema);
