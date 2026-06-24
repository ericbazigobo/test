const mongoose = require('mongoose');

const ItemSchema = new mongoose.Schema({
  description: { type: String, required: true },
  quantity: { type: Number, default: 1 },
  unitPrice: { type: Number, required: true },
  medicineId: { type: mongoose.Schema.Types.ObjectId, ref: 'Medicine' }
});

const InvoiceSchema = new mongoose.Schema({
  patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: false },
  // denormalized patient fields for faster access and to keep invoice snapshot
  patientName: { type: String },
  patientCode: { type: String },
  // subscriber (abonné) reference when applicable
  subscriber: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscriber' },
  // reference to prescription if invoice was generated from one
  prescriptionRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Prescription' },
  items: [ItemSchema],
  total: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'paid'], default: 'pending' },
  createdAt: { type: Date, default: Date.now },
  pharmacyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pharmacy', required: true },
  agent: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  invoiceNumber: { type: String, unique: true }
});

InvoiceSchema.pre('save', async function(next) {
  if (this.isNew) {
    const today = new Date();
    const prefix = `INV-${today.getFullYear().toString().slice(-2)}${(today.getMonth() + 1).toString().padStart(2, '0')}`;
    
    try {
      const allPrefixInc = await mongoose.model('Invoice').find({ 
        invoiceNumber: new RegExp(`^${prefix}`) 
      }).select('invoiceNumber');
      
      let maxNum = 0;
      allPrefixInc.forEach(inv => {
        if (inv.invoiceNumber) {
          const parts = inv.invoiceNumber.split('-');
          if (parts.length >= 3) {
            const num = parseInt(parts[2], 10);
            if (!isNaN(num) && num > maxNum) maxNum = num;
          }
        }
      });
      
      this.invoiceNumber = `${prefix}-${String(maxNum + 1).padStart(3, '0')}`;
    } catch (err) {
      return next(err);
    }
  }
  next();
});

// Indexes for fast queries
InvoiceSchema.index({ pharmacyId: 1 });
InvoiceSchema.index({ pharmacyId: 1, createdAt: -1 });
InvoiceSchema.index({ status: 1, pharmacyId: 1 });

module.exports = mongoose.model('Invoice', InvoiceSchema);
