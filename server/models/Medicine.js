const mongoose = require('mongoose');

const MovementSchema = new mongoose.Schema({
  type: { type: String, enum: ['in', 'out'], required: true },
  quantity: { type: Number, required: true },
  date: { type: Date, default: Date.now },
  expiryDate: { type: Date },
  note: String,
  remainingQuantity: { type: Number }
});

const MedicineSchema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { type: String, required: true },
  stock: { type: Number, required: true, default: 0 },
  price: { type: Number, required: true },
  purchasePrice: { type: Number, default: 0 },
  expiryDate: { type: Date },
  movements: [MovementSchema],
  pharmacyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pharmacy', required: true }
}, { timestamps: true });

// Index for fast search
MedicineSchema.index({ name: 1, pharmacyId: 1 });
MedicineSchema.index({ code: 1, pharmacyId: 1 });

MedicineSchema.statics.generateCode = async function(name, pharmacyId) {
  const words = name.trim().split(/\s+/);
  const prefix = words[0].substring(0, 4).toUpperCase() || 'MED';
  const suffix = words.length > 1 ? words[words.length - 1].substring(0, 2).toLowerCase() : 'xx';
  
  const patternStr = `^${prefix}-${suffix}-\\d{3}$`;
  const pattern = new RegExp(patternStr);
  
  const allInFamily = await this.find({ 
    pharmacyId, 
    code: pattern 
  }).select('code').lean();
  
  let maxSequence = 0;
  allInFamily.forEach(med => {
    const parts = med.code.split('-');
    if (parts.length >= 3) {
      const seq = parseInt(parts[2], 10);
      if (!isNaN(seq) && seq > maxSequence) {
        maxSequence = seq;
      }
    }
  });

  let nextSequence = maxSequence + 1;
  let code = `${prefix}-${suffix}-${String(nextSequence).padStart(3, '0')}`;
  
  // Final existence check
  let exists = await this.findOne({ code, pharmacyId });
  while (exists) {
    nextSequence++;
    code = `${prefix}-${suffix}-${String(nextSequence).padStart(3, '0')}`;
    exists = await this.findOne({ code, pharmacyId });
  }
  
  return code;
};

MedicineSchema.methods.addStockFIFO = function(quantity, note = '', expiryDate = null, date = new Date()) {
  const qtyToAdd = Number(quantity);
  this.stock += qtyToAdd;
  
  this.movements.push({
    type: 'in',
    quantity: qtyToAdd,
    note,
    expiryDate: expiryDate ? new Date(expiryDate) : undefined,
    date,
    remainingQuantity: qtyToAdd
  });

  // Update global expiryDate to the earliest expiryDate among all remaining batches that have a valid expiryDate
  const remainingBatchesWithExpiry = this.movements
    .filter(m => m.type === 'in' && (m.remainingQuantity === undefined ? m.quantity : m.remainingQuantity) > 0 && m.expiryDate)
    .sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));

  if (remainingBatchesWithExpiry.length > 0) {
    this.expiryDate = remainingBatchesWithExpiry[0].expiryDate;
  } else if (expiryDate) {
    this.expiryDate = new Date(expiryDate);
  }
};

MedicineSchema.methods.reduceStockFIFO = function(quantity, note = '', date = new Date()) {
  let qtyToReduce = Number(quantity);
  if (qtyToReduce <= 0) return;

  // Initialize remainingQuantity for all 'in' movements if not already set
  this.movements.forEach(m => {
    if (m.type === 'in' && m.remainingQuantity === undefined) {
      m.remainingQuantity = m.quantity;
    }
  });

  // Get all 'in' movements with remainingQuantity > 0, sorted by date ascending (FIFO)
  const inMovements = this.movements
    .filter(m => m.type === 'in' && m.remainingQuantity > 0)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  for (const m of inMovements) {
    if (qtyToReduce <= 0) break;
    const deduct = Math.min(m.remainingQuantity, qtyToReduce);
    m.remainingQuantity -= deduct;
    qtyToReduce -= deduct;
  }

  // Deduct from overall stock
  this.stock -= Number(quantity);

  // Add the 'out' movement
  this.movements.push({
    type: 'out',
    quantity: Number(quantity),
    note,
    date
  });

  // Update global expiryDate to the earliest expiryDate among all remaining batches that have a valid expiryDate
  const remainingBatchesWithExpiry = this.movements
    .filter(m => m.type === 'in' && (m.remainingQuantity === undefined ? m.quantity : m.remainingQuantity) > 0 && m.expiryDate)
    .sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));

  if (remainingBatchesWithExpiry.length > 0) {
    this.expiryDate = remainingBatchesWithExpiry[0].expiryDate;
  } else {
    this.expiryDate = undefined;
  }
};

module.exports = mongoose.model('Medicine', MedicineSchema);
