const mongoose = require('mongoose');
const Pharmacy = require('../models/Pharmacy');
const Medicine = require('../models/Medicine');
const CaisseTransaction = require('../models/CaisseTransaction');
const XLSX = require('xlsx');
const multer = require('multer');
const importService = require('../services/importService');
const upload = multer({ storage: multer.memoryStorage() });

const ensurePharmacyAccess = (req, pharmacyId) => {
  if (req.user?.role === 'admin') return true;
  if (!req.user?.pharmacyId) return true;
  return String(req.user.pharmacyId) === String(pharmacyId);
};

exports.runThresholdMigration = async () => {
  try {
    const Pharmacy = require('../models/Pharmacy');
    const result = await Pharmacy.updateMany({ lowStockThreshold: 20 }, { lowStockThreshold: 5 });
    if (result.modifiedCount > 0) {
      console.log(`✅ Migration: ${result.modifiedCount} pharmacies mises à jour avec un seuil de 5.`);
    }
  } catch (err) {
    console.error('Erreur migration seuil:', err);
  }
};

const buildMedicineFilter = (req, pharmacyId) => {
  const filter = { pharmacyId };
  const search = req.query.search?.trim();
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { code: { $regex: search, $options: 'i' } }
    ];
  }
  return filter;
};

const getMedicineSummary = async (pharmacyId) => {
  const results = await Medicine.aggregate([
    { $match: { pharmacyId: new mongoose.Types.ObjectId(pharmacyId) } },
    {
      $addFields: {
        outRevenue: {
          $sum: {
            $map: {
              input: {
                $filter: {
                  input: '$movements',
                  as: 'm',
                  cond: { $eq: ['$$m.type', 'out'] }
                }
              },
              as: 'm',
              in: { $multiply: ['$$m.quantity', '$price'] }
            }
          }
        }
      }
    },
    {
      $lookup: {
        from: 'pharmacies',
        localField: 'pharmacyId',
        foreignField: '_id',
        as: 'pharmacyData'
      }
    },
    { $unwind: '$pharmacyData' },
    {
      $addFields: {
        activeThreshold: {
          $cond: [
            { $not: ['$pharmacyData.lowStockThreshold'] },
            5,
            '$pharmacyData.lowStockThreshold'
          ]
        }
      }
    },
    {
      $group: {
        _id: null,
        totalInventoryValue: { $sum: { $multiply: ['$stock', '$price'] } },
        totalPurchaseValue: { 
          $sum: { 
            $multiply: [
              '$stock', 
              { $ifNull: [
                { $cond: [{ $gt: ['$purchasePrice', 0] }, '$purchasePrice', null] }, 
                { $multiply: ['$price', 0.7] } 
              ]}
            ] 
          } 
        },
        totalRevenue: { $sum: '$outRevenue' },
        lowStockCount: { $sum: { $cond: [{ $lte: ['$stock', '$activeThreshold'] }, 1, 0] } },
        totalMedicines: { $sum: 1 },
        totalUnits: { $sum: '$stock' }
      }
    }
  ]);
  const stats = results[0];

  return {
    totalInventoryValue: stats?.totalInventoryValue || 0,
    totalPurchaseValue: stats?.totalPurchaseValue || 0,
    totalRevenue: stats?.totalRevenue || 0,
    lowStockCount: stats?.lowStockCount || 0,
    totalMedicines: stats?.totalMedicines || 0,
    totalUnits: stats?.totalUnits || 0
  };
};

exports.list = async (req, res) => {
  try {
    const filter = req.user?.role === 'admin' ? {} : { pharmacyId: req.user?.pharmacyId };
    const pharmacies = await Pharmacy.find(filter).sort({ name: 1 }).lean();
    
    const pharmaciesWithMedicines = await Promise.all(pharmacies.map(async (pharmacy) => {
      const medicines = await Medicine.find({ pharmacyId: pharmacy._id }).lean();
      const threshold = pharmacy.lowStockThreshold || 5;
      return { ...pharmacy, lowStockThreshold: threshold, medicines };
    }));
    
    res.json(pharmaciesWithMedicines);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getById = async (req, res) => {
  try {
    const pharmacy = await Pharmacy.findById(req.params.id).lean();
    if (!pharmacy) return res.status(404).json({ message: 'Pharmacie introuvable' });
    if (!ensurePharmacyAccess(req, pharmacy._id)) return res.status(403).json({ message: 'Accès refusé' });
    const summary = await getMedicineSummary(pharmacy._id);
    const threshold = pharmacy.lowStockThreshold || 5;
    
    // Fetch and sum expenses
    const Expense = require('../models/Expense');
    const expenses = await Expense.find({ pharmacyId: pharmacy._id });
    const totalExpenses = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    res.json({ ...pharmacy, lowStockThreshold: threshold, ...summary, totalExpenses });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.create = async (req, res) => {
  try {
    let { name, code, address, manager, location } = req.body;
    if (!code) {
      code = await Pharmacy.generateCode();
    }
    const newPharmacy = new Pharmacy({
      name,
      code,
      address: address || location,
      manager
    });
    await newPharmacy.save();
    res.status(201).json(newPharmacy);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.update = async (req, res) => {
  try {
    const pharmacy = await Pharmacy.findById(req.params.id);
    if (!pharmacy) return res.status(404).json({ message: 'Pharmacie introuvable' });
    if (!ensurePharmacyAccess(req, pharmacy._id)) return res.status(403).json({ message: 'Accès refusé' });

    const { name, code, address, manager, location, margin, lowStockThreshold } = req.body;
    if (name !== undefined) pharmacy.name = name;
    if (code !== undefined) pharmacy.code = code;
    if (address !== undefined || location !== undefined) pharmacy.address = address || location;
    if (manager !== undefined) pharmacy.manager = manager;
    
    let marginChanged = false;
    if (margin !== undefined && Number(margin) !== pharmacy.margin) {
      pharmacy.margin = Number(margin);
      marginChanged = true;
    }
    if (lowStockThreshold !== undefined) pharmacy.lowStockThreshold = Number(lowStockThreshold);

    await pharmacy.save();

    // Si la marge a changé, on met à jour tous les médicaments pour la cohérence
    if (marginChanged) {
      const medicines = await Medicine.find({ pharmacyId: pharmacy._id });
      for (const med of medicines) {
        med.purchasePrice = Number(med.price) - (Number(med.price) * pharmacy.margin / 100);
        await med.save();
      }
    }

    res.json(pharmacy);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.delete = async (req, res) => {
  try {
    const pharmacy = await Pharmacy.findById(req.params.id);
    if (!pharmacy) return res.status(404).json({ message: 'Pharmacie introuvable' });
    if (!ensurePharmacyAccess(req, pharmacy._id)) return res.status(403).json({ message: 'Accès refusé' });

    await Pharmacy.findByIdAndDelete(req.params.id);
    res.json({ message: 'Pharmacie supprimée' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getMedicines = async (req, res) => {
  try {
    const pharmacy = await Pharmacy.findById(req.params.id);
    if (!pharmacy) return res.status(404).json({ message: 'Pharmacie introuvable' });
    if (!ensurePharmacyAccess(req, pharmacy._id)) return res.status(403).json({ message: 'Accès refusé' });

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(10000, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const filter = buildMedicineFilter(req, pharmacy._id);

    const [totalItems, medicines] = await Promise.all([
      Medicine.countDocuments(filter),
      Medicine.find(filter)
        .select('name code stock price purchasePrice expiryDate pharmacyId')
        .sort({ name: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
    ]);

    const totalPages = Math.max(1, Math.ceil(totalItems / limit));

    res.json({
      items: medicines,
      page,
      limit,
      totalPages,
      totalItems
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.addMedicine = async (req, res) => {
  try {
    const pharmacy = await Pharmacy.findById(req.params.id);
    if (!pharmacy) return res.status(404).json({ message: 'Pharmacie introuvable' });
    if (!ensurePharmacyAccess(req, pharmacy._id)) return res.status(403).json({ message: 'Accès refusé' });

    const { name, code: providedCode, stock, price, expiryDate } = req.body;
    
    let code = providedCode;
    if (!code) {
      code = await Medicine.generateCode(name, pharmacy._id);
    }

    const margin = pharmacy.margin || 30;
    const purchasePrice = Number(price) - (Number(price) * margin / 100);

    const medicine = new Medicine({
      name,
      code,
      stock: Number(stock) || 0,
      price: Number(price) || 0,
      purchasePrice,
      expiryDate: expiryDate ? new Date(expiryDate) : undefined,
      pharmacyId: pharmacy._id,
      movements: Number(stock) ? [{ type: 'in', quantity: Number(stock), note: 'Stock initial', expiryDate: expiryDate ? new Date(expiryDate) : undefined, remainingQuantity: Number(stock) }] : []
    });
    await medicine.save();
    try { if (req.broadcast) req.broadcast({ type: 'STOCK_UPDATE', pharmacyId: String(pharmacy._id) }); } catch (_) {}
    res.status(201).json(medicine);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateMedicine = async (req, res) => {
  try {
    const medicine = await Medicine.findOne({ _id: req.params.medicineId, pharmacyId: req.params.pharmacyId });
    if (!medicine) return res.status(404).json({ message: 'Médicament introuvable' });
    if (!ensurePharmacyAccess(req, medicine.pharmacyId)) return res.status(403).json({ message: 'Accès refusé' });

    const { name, code, stock, price, expiryDate } = req.body;
    if (name !== undefined) medicine.name = name;
    if (code !== undefined) medicine.code = code;
    if (stock !== undefined) medicine.stock = Number(stock);
    if (expiryDate !== undefined) medicine.expiryDate = new Date(expiryDate);
    if (price !== undefined) {
      medicine.price = Number(price);
      // Retrieve pharmacy to apply margin dynamically
      const pharmacy = await Pharmacy.findById(medicine.pharmacyId);
      const margin = pharmacy ? (pharmacy.margin || 30) : 30;
      medicine.purchasePrice = Number(price) - (Number(price) * margin / 100);
    }

    await medicine.save();
    try { if (req.broadcast) req.broadcast({ type: 'STOCK_UPDATE', pharmacyId: String(medicine.pharmacyId) }); } catch (_) {}
    res.json(medicine);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteMedicine = async (req, res) => {
  try {
    const medicine = await Medicine.findOneAndDelete({ _id: req.params.medicineId, pharmacyId: req.params.pharmacyId });
    if (!medicine) return res.status(404).json({ message: 'Médicament introuvable' });
    if (!ensurePharmacyAccess(req, medicine.pharmacyId)) return res.status(403).json({ message: 'Accès refusé' });
    try { if (req.broadcast) req.broadcast({ type: 'STOCK_UPDATE', pharmacyId: String(medicine.pharmacyId) }); } catch (_) {}
    res.json({ message: 'Médicament supprimé' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.importMedicines = [
  upload.single('file'),
  async (req, res) => {
    try {
      const pharmacy = await Pharmacy.findById(req.params.id);
      if (!pharmacy) return res.status(404).json({ message: 'Pharmacie introuvable' });
      if (!ensurePharmacyAccess(req, pharmacy._id)) return res.status(403).json({ message: 'Accès refusé' });

      if (!req.file) return res.status(400).json({ message: 'Fichier requis' });

      const progress = await importService.startImportSession(pharmacy._id, req.file.buffer);
      res.json({ message: 'Import démarré', sessionId: progress.id, progress });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }
];

exports.importAllMedicines = [
  upload.single('file'),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: 'Fichier requis' });
      
      const filter = req.user?.role === 'admin' ? {} : (req.user?.pharmacyId ? { _id: req.user.pharmacyId } : {});
      const pharmacies = await Pharmacy.find(filter);
      if (!pharmacies.length) return res.status(400).json({ message: 'Aucune pharmacie disponible pour cet utilisateur' });

      const sessions = await Promise.all(
        pharmacies.map(p => importService.startImportSession(p._id, req.file.buffer))
      );
      
      res.json({ message: 'Imports Multi-Pharmacies démarrés en parallèle', count: pharmacies.length, sessions });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
];

exports.getImportProgress = async (req, res) => {
  try {
    const progress = importService.getImportProgress(req.params.sessionId);
    res.json(progress);
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
};

exports.addStock = async (req, res) => {
  try {
    const { medicineId, quantity, note, expiryDate, date } = req.body;
    const medicine = await Medicine.findById(medicineId);
    if (!medicine) return res.status(404).json({ message: 'Médicament introuvable' });
    if (!ensurePharmacyAccess(req, medicine.pharmacyId)) return res.status(403).json({ message: 'Accès refusé' });

    medicine.addStockFIFO(quantity, note || 'Réapprovisionnement', expiryDate, date);
    await medicine.save();
    try { if (req.broadcast) req.broadcast({ type: 'STOCK_UPDATE', pharmacyId: String(medicine.pharmacyId) }); } catch (_) {}
    res.json(medicine);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.reduceStock = async (req, res) => {
  try {
    const { medicineId, quantity, note, date } = req.body;
    const medicine = await Medicine.findById(medicineId);
    if (!medicine) return res.status(404).json({ message: 'Médicament introuvable' });
    if (!ensurePharmacyAccess(req, medicine.pharmacyId)) return res.status(403).json({ message: 'Accès refusé' });

    if (medicine.stock < Number(quantity)) return res.status(400).json({ message: 'Stock insuffisant' });

    medicine.reduceStockFIFO(quantity, note || 'Ajustement de stock', date);
    await medicine.save();
    try { if (req.broadcast) req.broadcast({ type: 'STOCK_UPDATE', pharmacyId: String(medicine.pharmacyId) }); } catch (_) {}
    res.json(medicine);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.sellMedicine = async (req, res) => {
  try {
    const { medicineId, quantity, date } = req.body;
    const medicine = await Medicine.findById(medicineId);
    if (!medicine) return res.status(404).json({ message: 'Médicament introuvable' });
    if (!ensurePharmacyAccess(req, medicine.pharmacyId)) return res.status(403).json({ message: 'Accès refusé' });

    if (medicine.stock < Number(quantity)) return res.status(400).json({ message: 'Stock insuffisant' });

    medicine.reduceStockFIFO(quantity, 'Vente', date);
    await medicine.save();
    try { if (req.broadcast) req.broadcast({ type: 'STOCK_UPDATE', pharmacyId: String(medicine.pharmacyId) }); } catch (_) {}
    res.json({ message: 'Vente effectuée', medicine });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.closeMonth = async (req, res) => {
  try {
    const pharmacyId = req.params.id;
    const pharmacy = await Pharmacy.findById(pharmacyId);
    if (!pharmacy) return res.status(404).json({ message: 'Pharmacie introuvable' });
    if (!ensurePharmacyAccess(req, pharmacy._id)) return res.status(403).json({ message: 'Accès refusé' });

    await Medicine.updateMany({ pharmacyId: pharmacy._id }, { $set: { movements: [] } });

    const Expense = require('../models/Expense');
    await Expense.deleteMany({ pharmacyId: pharmacy._id });

    await CaisseTransaction.deleteMany({ pharmacyId: pharmacy._id });
    try { if (req.broadcast) req.broadcast({ type: 'STOCK_UPDATE', pharmacyId: String(pharmacy._id) }); } catch (_) {}
    res.json({ message: 'Mois clôturé avec succès.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getFinancials = async (req, res) => {
  try {
    const pharmacy = await Pharmacy.findById(req.params.id);
    if (!pharmacy) return res.status(404).json({ message: 'Pharmacie introuvable' });
    if (!ensurePharmacyAccess(req, pharmacy._id)) return res.status(403).json({ message: 'Accès refusé' });

    const medicines = await Medicine.find({ pharmacyId: pharmacy._id }).select('stock purchasePrice price movements').lean();
    const totalInventoryValue = medicines.reduce((sum, med) => sum + (med.stock * med.price), 0);
    const totalPurchaseValue = medicines.reduce((sum, med) => sum + (med.stock * (med.purchasePrice || (med.price * 0.7))), 0);
    const totalRevenue = medicines.reduce((sum, med) => sum + med.movements.filter((m) => m.type === 'out').reduce((s, move) => s + (move.quantity * med.price), 0), 0);

    res.json({ totalInventoryValue, totalPurchaseValue, totalRevenue });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getSales = async (req, res) => {
  try {
    const pharmacy = await Pharmacy.findById(req.params.id);
    if (!pharmacy) return res.status(404).json({ message: 'Pharmacie introuvable' });
    if (!ensurePharmacyAccess(req, pharmacy._id)) return res.status(403).json({ message: 'Accès refusé' });

    const medicines = await Medicine.find({ pharmacyId: pharmacy._id }).select('name price movements').lean();
    const sales = medicines.flatMap((med) => med.movements
      .filter((m) => m.type === 'out')
      .map((m) => ({
        date: m.date,
        quantity: m.quantity,
        note: m.note,
        medicine: med.name,
        unitPrice: med.price,
        total: med.price * m.quantity
      })));
    res.json(sales);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.performInventory = async (req, res) => {
  try {
    res.json({ message: 'Inventaire effectué' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getInventoryReports = async (req, res) => {
  try {
    res.json([]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getMovements = async (req, res) => {
  try {
    const pharmacy = await Pharmacy.findById(req.params.pharmacyId);
    if (!pharmacy) return res.status(404).json({ message: 'Pharmacie introuvable' });
    if (!ensurePharmacyAccess(req, pharmacy._id)) return res.status(403).json({ message: 'Accès refusé' });

    const medicines = await Medicine.find({ pharmacyId: pharmacy._id }).select('name code price purchasePrice movements').lean();
    let allMovements = [];
    medicines.forEach(med => {
      if (med.movements) {
        med.movements.forEach(m => {
          allMovements.push({ ...m, medicineName: med.name, medicineCode: med.code, medicineId: med._id, price: med.price, purchasePrice: med.purchasePrice });
        });
      }
    });
    // Sort by date descending
    allMovements.sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json(allMovements);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteMovement = async (req, res) => {
  try {
    const { pharmacyId, medicineId, movementId } = req.params;
    const medicine = await Medicine.findOne({ _id: medicineId, pharmacyId });
    if (!medicine) return res.status(404).json({ message: 'Médicament introuvable' });
    if (!ensurePharmacyAccess(req, pharmacyId)) return res.status(403).json({ message: 'Accès refusé' });

    const movement = medicine.movements.id(movementId);
    if (!movement) return res.status(404).json({ message: 'Mouvement introuvable' });

    // Reverse stock effect
    if (movement.type === 'in') {
      medicine.stock -= movement.quantity;
    } else {
      medicine.stock += movement.quantity;
    }
    
    // Remove movement
    medicine.movements.pull(movementId);
    await medicine.save();
    try { if (req.broadcast) req.broadcast({ type: 'STOCK_UPDATE', pharmacyId: String(medicine.pharmacyId) }); } catch (_) {}
    res.json({ message: 'Mouvement supprimé', medicine });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateMovement = async (req, res) => {
  try {
    const { pharmacyId, medicineId, movementId } = req.params;
    const { quantity, note } = req.body;
    
    const medicine = await Medicine.findOne({ _id: medicineId, pharmacyId });
    if (!medicine) return res.status(404).json({ message: 'Médicament introuvable' });
    if (!ensurePharmacyAccess(req, pharmacyId)) return res.status(403).json({ message: 'Accès refusé' });

    const movement = medicine.movements.id(movementId);
    if (!movement) return res.status(404).json({ message: 'Mouvement introuvable' });

    // Reverse old stock effect
    if (movement.type === 'in') {
      medicine.stock -= movement.quantity;
    } else {
      medicine.stock += movement.quantity;
    }

    // Apply new stock effect
    if (quantity !== undefined) movement.quantity = Number(quantity);
    if (note !== undefined) movement.note = note;

    if (movement.type === 'in') {
      medicine.stock += movement.quantity;
    } else {
      medicine.stock -= movement.quantity;
    }

    await medicine.save();
    try { if (req.broadcast) req.broadcast({ type: 'STOCK_UPDATE', pharmacyId: String(medicine.pharmacyId) }); } catch (_) {}
    res.json({ message: 'Mouvement mis à jour', medicine });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.generateMedicineCode = async (req, res) => {
  try {
    const { pharmacyId } = req.params;
    const { name } = req.query;
    if (!name) return res.status(400).json({ message: 'Nom du médicament requis' });
    
    if (!ensurePharmacyAccess(req, pharmacyId)) return res.status(403).json({ message: 'Accès refusé' });

    const code = await Medicine.generateCode(name, pharmacyId);
    res.json({ code });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getCaisseTransactions = async (req, res) => {
  try {
    const { pharmacyId } = req.params;
    if (!ensurePharmacyAccess(req, pharmacyId)) return res.status(403).json({ message: 'Accès refusé' });
    const transactions = await CaisseTransaction.find({ pharmacyId }).sort({ date: -1 });
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createCaisseTransaction = async (req, res) => {
  try {
    const { pharmacyId } = req.params;
    const { type, amount, reason, date } = req.body;
    if (!ensurePharmacyAccess(req, pharmacyId)) return res.status(403).json({ message: 'Accès refusé' });

    if (!type || !amount || !reason || !date) {
      return res.status(400).json({ message: 'Tous les champs sont requis (type, amount, reason, date)' });
    }

    const tx = await CaisseTransaction.create({
      pharmacyId,
      type,
      amount: Number(amount),
      reason,
      date: new Date(date)
    });

    try { if (req.broadcast) req.broadcast({ type: 'STOCK_UPDATE', pharmacyId: String(pharmacyId) }); } catch (_) {}
    res.status(201).json(tx);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteCaisseTransaction = async (req, res) => {
  try {
    const { pharmacyId, transactionId } = req.params;
    if (!ensurePharmacyAccess(req, pharmacyId)) return res.status(403).json({ message: 'Accès refusé' });

    const tx = await CaisseTransaction.findOneAndDelete({ _id: transactionId, pharmacyId });
    if (!tx) return res.status(404).json({ message: 'Transaction introuvable' });

    try { if (req.broadcast) req.broadcast({ type: 'STOCK_UPDATE', pharmacyId: String(pharmacyId) }); } catch (_) {}
    res.json({ message: 'Transaction supprimée avec succès' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

