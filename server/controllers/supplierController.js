const Supplier = require('../models/Supplier');
const PurchaseOrder = require('../models/PurchaseOrder');

exports.getSuppliers = async (req, res) => {
  try {
    const suppliers = await Supplier.find({ pharmacyId: req.params.pharmacyId }).sort({ name: 1 });
    res.json(suppliers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createSupplier = async (req, res) => {
  try {
    const supplier = new Supplier({
      ...req.body,
      pharmacyId: req.params.pharmacyId
    });
    const saved = await supplier.save();
    res.status(201).json(saved);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.updateSupplier = async (req, res) => {
  try {
    const updated = await Supplier.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.getPurchaseOrders = async (req, res) => {
  try {
    const orders = await PurchaseOrder.find({ pharmacyId: req.params.pharmacyId })
      .populate('supplierId', 'name')
      .sort({ orderDate: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createPurchaseOrder = async (req, res) => {
  try {
    const totalAmount = req.body.items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
    const order = new PurchaseOrder({
      ...req.body,
      pharmacyId: req.params.pharmacyId,
      totalAmount
    });
    const saved = await order.save();
    res.status(201).json(saved);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.updatePurchaseOrder = async (req, res) => {
  try {
    const updated = await PurchaseOrder.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
