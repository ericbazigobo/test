const Pharmacy = require('../models/Pharmacy');
const Medicine = require('../models/Medicine');
const Patient = require('../models/Patient');
const Room = require('../models/Room');
const Invoice = require('../models/Invoice');
const Expense = require('../models/Expense');
const Admission = require('../models/Admission');
const MonthlyReport = require('../models/MonthlyReport');

const toCurrency = (value) => Number(value || 0);

// Helper to calculate medicine cost price based on pharmacy margin if purchasePrice is missing
const getPurchasePrice = (medicine, pharmacy) => {
  if (medicine.purchasePrice && medicine.purchasePrice > 0) return medicine.purchasePrice;
  const margin = pharmacy.margin || 30;
  return medicine.price * (1 - margin / 100);
};

exports.stats = async (req, res) => {
  try {
    const pharmacyId = req.user?.pharmacyId;
    const filter = pharmacyId ? { pharmacyId } : {};
    
    // Date range for current month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [patientCount, roomCount, occupiedRooms, revenue, pharmacies, totalInvoices, totalExpenses] = await Promise.all([
      Patient.countDocuments(filter),
      Room.countDocuments(filter),
      Room.find({ ...filter, status: 'occupied' }),
      Invoice.find({ ...filter, status: 'paid', createdAt: { $gte: startOfMonth } }).then(invs => invs.reduce((sum, inv) => sum + toCurrency(inv.total), 0)),
      pharmacyId ? Pharmacy.find({ _id: pharmacyId }) : Pharmacy.find(),
      Invoice.find({ ...filter, status: 'paid' }).then(invs => invs.reduce((sum, inv) => sum + toCurrency(inv.total), 0)),
      Expense.find(filter).then(exps => exps.reduce((sum, exp) => sum + toCurrency(exp.amount), 0))
    ]);

    const pharmacyStats = await Promise.all(pharmacies.map(async (pharmacy) => {
      const meds = await Medicine.find({ pharmacyId: pharmacy._id });
      const threshold = pharmacy.lowStockThreshold || 20;
      
      const [pharmExpenses] = await Promise.all([
        Expense.find({ pharmacyId: pharmacy._id })
      ]);

      // Calculate revenue from ALL 'out' movements for this pharmacy
      const rev = meds.reduce((totalMedRev, med) => {
        const outMovements = (med.movements || []).filter(m => m.type === 'out');
        const medRev = outMovements.reduce((sum, m) => sum + (m.quantity * (med.price || 0)), 0);
        return totalMedRev + medRev;
      }, 0);

      const exp = pharmExpenses.reduce((sum, e) => sum + toCurrency(e.amount), 0);
      
      const lowStockCount = meds.filter(med => med.stock <= threshold).length;
      const totalUnits = meds.reduce((sum, med) => sum + med.stock, 0);
      // Valuation at purchase price (Capital)
      const inventoryValue = meds.reduce((sum, med) => sum + (med.stock * getPurchasePrice(med, pharmacy)), 0);

      return {
        id: pharmacy._id,
        name: pharmacy.name,
        totalRevenue: rev,
        totalExpenses: exp,
        profit: rev - exp,
        inventoryValue,
        lowStockCount,
        totalUnits,
        lowStockThreshold: threshold
      };
    }));

    const globalRevenue = pharmacyStats.reduce((sum, ps) => sum + ps.totalRevenue, 0);

    const globalLowStockCount = pharmacyStats.reduce((sum, ps) => sum + ps.lowStockCount, 0);

    res.json({
      patientCount,
      roomCount,
      occupiedRooms: occupiedRooms.length,
      lowStockCount: globalLowStockCount,
      revenue: globalRevenue, 
      pharmacyStats,
      hospitalFinancials: {
        totalRevenue: globalRevenue,
        monthlyRevenue: globalRevenue, // Simplifying as globalRevenue for now unless we filter movements by date
        totalExpenses: totalExpenses,
        totalProfit: globalRevenue - totalExpenses,
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.generateMonthlyReport = async (req, res) => {
  try {
    const now = new Date();
    const month = now.getMonth() + 1; // 1-12
    const year = now.getFullYear();
    const startOfMonth = new Date(year, now.getMonth(), 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59);

    // Calculate metrics for the month
    const [monthlyInvoices, monthlyExpenses, patients, admissions, pharmacies] = await Promise.all([
      Invoice.find({ status: 'paid', createdAt: { $gte: startOfMonth, $lte: endOfMonth } }),
      Expense.find({ date: { $gte: startOfMonth, $lte: endOfMonth } }),
      Patient.countDocuments({ createdAt: { $lte: endOfMonth } }),
      Admission.countDocuments({ admittedAt: { $gte: startOfMonth, $lte: endOfMonth } }),
      Pharmacy.find()
    ]);

    const totalPharmacyRevenue = monthlyInvoices.reduce((sum, inv) => sum + toCurrency(inv.total), 0);
    const totalExpenses = monthlyExpenses.reduce((sum, exp) => sum + toCurrency(exp.amount), 0);
    
    // Estimating room revenues based on admissions
    const roomRevenues = admissions * 25000;

    // Breakdown by pharmacy with capital estimation
    const pharmacyRevenues = new Map();
    for (const pharm of pharmacies) {
      const revenue = monthlyInvoices
        .filter(inv => inv.pharmacyId.toString() === pharm._id.toString())
        .reduce((sum, inv) => sum + toCurrency(inv.total), 0);
      
      // Capital estimation
      const medicines = await Medicine.find({ pharmacyId: pharm._id });
      let endingCapital = 0;
      let startingCapital = 0;

      for (const med of medicines) {
        const pPrice = getPurchasePrice(med, pharm);
        
        // Sum movements for this month
        const monthlyMovements = (med.movements || []).filter(m => {
          const mDate = new Date(m.date);
          return mDate >= startOfMonth && mDate <= endOfMonth;
        });

        const totalIn = monthlyMovements.filter(m => m.type === 'in').reduce((sum, m) => sum + m.quantity, 0);
        const totalOut = monthlyMovements.filter(m => m.type === 'out').reduce((sum, m) => sum + m.quantity, 0);

        const endingStock = med.stock;
        const startingStock = endingStock - totalIn + totalOut;

        endingCapital += endingStock * pPrice;
        startingCapital += startingStock * pPrice;
      }

      pharmacyRevenues.set(pharm._id.toString(), { 
        name: pharm.name, 
        revenue,
        startingCapital,
        endingCapital
      });
    }

    // Save or update report
    const report = await MonthlyReport.findOneAndUpdate(
      { month, year },
      {
        totalPharmacyRevenue,
        roomRevenues,
        expenses: totalExpenses,
        profit: (totalPharmacyRevenue + roomRevenues) - totalExpenses,
        patientCount: patients,
        admissionCount: admissions,
        pharmacyRevenues,
        date: now
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json({ message: 'Rapport mensuel généré avec succès', report });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getMonthlyReports = async (req, res) => {
  try {
    const reports = await MonthlyReport.find().sort({ year: -1, month: -1 });
    res.json(reports);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getHospitalFinancials = async (req, res) => {
  try {
    const [invoices, expenses] = await Promise.all([
      Invoice.find({ status: 'paid' }),
      Expense.find()
    ]);

    const totalRevenue = invoices.reduce((sum, inv) => sum + toCurrency(inv.total), 0);
    const totalExpenses = expenses.reduce((sum, exp) => sum + toCurrency(exp.amount), 0);

    // Current month revenue
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthlyRevenue = invoices
      .filter(inv => new Date(inv.createdAt) >= startOfMonth)
      .reduce((sum, inv) => sum + toCurrency(inv.total), 0);

    // Pharmacy contributions
    const pharmacies = await Pharmacy.find();
    const pharmacyContributions = {};
    pharmacies.forEach(p => {
      const rev = invoices
        .filter(inv => inv.pharmacyId.toString() === p._id.toString())
        .reduce((sum, inv) => sum + toCurrency(inv.total), 0);
      const count = invoices.filter(inv => inv.pharmacyId.toString() === p._id.toString()).length;
      pharmacyContributions[p._id] = { name: p.name, revenue: rev, salesCount: count };
    });

    res.json({
      totalRevenue,
      totalExpenses,
      totalProfit: totalRevenue - totalExpenses,
      monthlyRevenue,
      pharmacyContributions,
      lastReportDate: now
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.resetMonthlyData = async (req, res) => {
  try {
    await MonthlyReport.deleteMany({});
    res.json({ message: 'Données mensuelles réinitialisées' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
