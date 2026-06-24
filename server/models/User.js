const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, default: 'admin', enum: ['admin', 'doctor', 'nurse', 'staff', 'pharmacist', 'cashier', 'lab'] },
  pharmacyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pharmacy', required: false }
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
