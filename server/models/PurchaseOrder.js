const mongoose = require('mongoose');

const purchaseOrderSchema = new mongoose.Schema({
  pharmacyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pharmacy', required: true },
  supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },
  orderDate: { type: Date, default: Date.now },
  expectedDeliveryDate: { type: Date },
  status: { type: String, enum: ['Brouillon', 'Envoyée', 'Livrée', 'Annulée'], default: 'Brouillon' },
  items: [{
    medicineName: { type: String, required: true },
    medicineCode: { type: String },
    quantityOrdered: { type: Number, required: true },
    unitPrice: { type: Number },
    totalPrice: { type: Number }
  }],
  totalAmount: { type: Number, default: 0 },
  notes: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('PurchaseOrder', purchaseOrderSchema);
