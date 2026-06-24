const mongoose = require('mongoose');

const PatientSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  dob: { type: Date },
  gender: { type: String, enum: ['male', 'female', 'other'], default: 'other' },
  phone: { type: String },
  email: { type: String },
  address: { type: String },
  code: { type: String, unique: true, sparse: true },
  subscriberId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscriber' },
  history: [{ date: Date, note: String }],
  pharmacyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pharmacy' }
}, { timestamps: true });

PatientSchema.index({ firstName: 1, lastName: 1 });
PatientSchema.index({ pharmacyId: 1 });
PatientSchema.index({ code: 1 });

PatientSchema.statics.generateCode = async function() {
  const count = await this.countDocuments();
  let n = count + 1;
  let code;
  let exists = true;
  while (exists) {
    code = 'PAT' + String(n).padStart(5, '0');
    exists = await this.findOne({ code });
    if (exists) n++;
  }
  return code;
};

module.exports = mongoose.model('Patient', PatientSchema);
