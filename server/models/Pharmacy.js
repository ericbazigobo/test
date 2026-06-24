const mongoose = require('mongoose');

const PharmacySchema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { type: String, required: true, unique: true },
  address: { type: String, required: true },
  manager: { type: String, required: true },
  margin: { type: Number, default: 30 },
  lowStockThreshold: { type: Number, default: 5 },
  lastClosedDate: { type: Date }
}, { timestamps: true });

PharmacySchema.statics.generateCode = async function() {
  const allPharmacies = await this.find({ code: /^PHARM-/ }).select('code').lean();
  let maxNum = 0;
  
  allPharmacies.forEach(p => {
    const match = p.code.match(/PHARM-(\d+)/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  });
  
  let nextNum = maxNum + 1;
  let code = `PHARM-${String(nextNum).padStart(3, '0')}`;
  
  // Extra safety check in case maxNum logic missed something
  let exists = await this.findOne({ code });
  while (exists) {
    nextNum++;
    code = `PHARM-${String(nextNum).padStart(3, '0')}`;
    exists = await this.findOne({ code });
  }
  
  return code;
};

module.exports = mongoose.model('Pharmacy', PharmacySchema);