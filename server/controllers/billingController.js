const Invoice = require('../models/Invoice');
const Patient = require('../models/Patient');
const Medicine = require('../models/Medicine');
const Prescription = require('../models/Prescription');
const Subscriber = require('../models/Subscriber');
const SubscriberRestriction = require('../models/SubscriberRestriction');
const User = require('../models/User');
const { jsPDF } = require('jspdf');
require('jspdf-autotable');

exports.list = async (req, res) => {
  try {
    const filter = req.user?.pharmacyId ? { pharmacyId: req.user.pharmacyId } : {};
    const invoices = await Invoice.find(filter).populate('patient').populate('subscriber').sort({ createdAt: -1 });
    res.json(invoices);
  } catch (error) {
    console.error('Billing create error:', error.stack || error);
    res.status(500).json({ message: error.message });
  }
};

exports.create = async (req, res) => {
  try {
    console.log('Billing.create called, body=', JSON.stringify(req.body).slice(0,1000));
    const pharmacyId = req.user?.pharmacyId || req.body.pharmacyId;
    if (!pharmacyId) return res.status(400).json({ message: 'PharmacyId requis' });

    const { patient: patientId, items: bodyItems, subscriber: subscriberId, prescriptionId } = req.body;

    let patient = null;
    if (patientId) {
      patient = await Patient.findById(patientId);
      if (!patient) return res.status(400).json({ message: 'Patient invalide' });
    }

    // If subscriber is provided, patient must be registered
    let subscriber = null;
    if (subscriberId) {
      subscriber = await Subscriber.findById(subscriberId);
      if (!subscriber) return res.status(400).json({ message: 'Abonné invalide' });
      if (!patient) return res.status(400).json({ message: 'Aucune vente abonnée pour patient non enregistré' });
    }

    // Build items either from prescription or body
    let items = [];
    if (prescriptionId) {
      const pres = await Prescription.findById(prescriptionId).populate('medications.medicineId');
      if (!pres) return res.status(400).json({ message: 'Ordonnance introuvable' });
      if (patient && String(pres.patientId) !== String(patient._id)) {
        return res.status(400).json({ message: 'Ordonnance et patient ne correspondent pas' });
      }

      // Map medications to invoice items
      for (const med of pres.medications) {
        let medRecord = null;
        if (med.medicineId) medRecord = await Medicine.findOne({ _id: med.medicineId, pharmacyId });
        // fallback: try to match by name
        if (!medRecord && med.medicineName) medRecord = await Medicine.findOne({ name: med.medicineName, pharmacyId });

        const unitPrice = medRecord ? medRecord.price : (med.price || 0);
        items.push({ description: med.medicineName || (medRecord && medRecord.name) || 'Médicament', quantity: med.quantity || 1, unitPrice, medicineId: medRecord ? medRecord._id : undefined });
      }

      // Allow overrides of quantities/prices via bodyItems
      if (Array.isArray(bodyItems) && bodyItems.length) {
        // merge by medicineId or description
        for (const override of bodyItems) {
          const found = items.find(i => (override.medicineId && String(i.medicineId) === String(override.medicineId)) || (override.description && i.description === override.description));
          if (found) {
            if (override.quantity !== undefined) found.quantity = Number(override.quantity);
            if (override.unitPrice !== undefined) found.unitPrice = Number(override.unitPrice);
          }
        }
      }

    } else {
      if (!Array.isArray(bodyItems) || !bodyItems.length) return res.status(400).json({ message: 'Articles requis' });
      items = bodyItems.map(it => ({ description: it.description, quantity: Number(it.quantity || 1), unitPrice: Number(it.unitPrice || 0), medicineId: it.medicineId }));
    }

    // If subscriber present, verify restrictions
    if (subscriber) {
      const forbidden = [];
      for (const it of items) {
        if (it.medicineId) {
          const restr = await SubscriberRestriction.findOne({ subscriber: subscriber._id, medicine: it.medicineId });
          if (restr && restr.allowed === false) {
            const med = await Medicine.findById(it.medicineId);
            forbidden.push(med ? med.name : it.description);
          }
        }
      }
      if (forbidden.length) return res.status(400).json({ message: `Médicaments interdits pour cet abonné: ${forbidden.join(', ')}` });
    }

    // Check & reduce stock
    for (const item of items) {
      if (item.medicineId) {
        const medicine = await Medicine.findOne({ _id: item.medicineId, pharmacyId });
        if (!medicine) throw new Error(`Médicament introuvable: ${item.description}`);
        if (medicine.stock < item.quantity) {
          throw new Error(`Stock insuffisant pour ${medicine.name} (Disponible: ${medicine.stock})`);
        }
        medicine.reduceStockFIFO(item.quantity, `Facture Patient: ${patient ? (patient.firstName + ' ' + patient.lastName) : 'Anonyme'}`);
        await medicine.save();
      }
    }

    const total = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const invoice = new Invoice({
      patient: patient ? patient._id : undefined,
      patientName: patient ? `${patient.firstName} ${patient.lastName}` : "CLIENT PASSANT",
      patientCode: patient ? patient.code : "PASSANT",
      subscriber: subscriber ? subscriber._id : undefined,
      prescriptionRef: prescriptionId || undefined,
      items,
      total,
      status: 'pending',
      pharmacyId,
      agent: req.user ? req.user.id : undefined
    });
    await invoice.save();
    // Reload via model to safely use .populate on a Query result
    const loaded = await Invoice.findById(invoice._id).populate('patient').populate('subscriber');
    // Broadcast real-time update to all WebSocket clients
    try { if (req.broadcast) req.broadcast({ type: 'INVOICE_CREATED', pharmacyId: String(pharmacyId) }); } catch (_) {}
    res.status(201).json(loaded);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.pay = async (req, res) => {
  try {
    const pharmacyId = req.user?.pharmacyId;
    const invoice = await Invoice.findOneAndUpdate(
      { _id: req.params.id, ...(pharmacyId ? { pharmacyId } : {}) },
      { status: 'paid', paidDate: new Date() },
      { new: true }
    ).populate('patient');
    if (!invoice) return res.status(404).json({ message: 'Facture introuvable' });
    res.json(invoice);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Aggregation: billing by agent for a given month
exports.agentBilling = async (req, res) => {
  try {
    const { month } = req.query; // format YYYY-MM
    let match = {};
    if (month) {
      const [y, m] = month.split('-');
      const start = new Date(Number(y), Number(m) - 1, 1);
      const end = new Date(Number(y), Number(m), 0, 23, 59, 59, 999);
      match.createdAt = { $gte: start, $lte: end };
    }
    const pipeline = [
      { $match: match },
      { $group: { _id: '$agent', total: { $sum: '$total' }, count: { $sum: 1 }, invoices: { $push: '$_id' } } },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'agentInfo' } },
      { $unwind: { path: '$agentInfo', preserveNullAndEmptyArrays: true } }
    ];
    const result = await Invoice.aggregate(pipeline);
    res.json(result.map(r => ({ agent: r.agentInfo || null, total: r.total, count: r.count, invoices: r.invoices })));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Aggregation: billing by subscriber/company for a given month
exports.companyBilling = async (req, res) => {
  try {
    const { month } = req.query;
    let match = {};
    if (month) {
      const [y, m] = month.split('-');
      const start = new Date(Number(y), Number(m) - 1, 1);
      const end = new Date(Number(y), Number(m), 0, 23, 59, 59, 999);
      match.createdAt = { $gte: start, $lte: end };
    }
    const pipeline = [
      { $match: match },
      { $group: { _id: '$subscriber', total: { $sum: '$total' }, count: { $sum: 1 }, agents: { $addToSet: '$agent' }, invoices: { $push: '$_id' } } },
      { $lookup: { from: 'subscribers', localField: '_id', foreignField: '_id', as: 'company' } },
      { $unwind: { path: '$company', preserveNullAndEmptyArrays: true } },
      { $lookup: { from: 'users', localField: 'agents', foreignField: '_id', as: 'agentList' } }
    ];
    const result = await Invoice.aggregate(pipeline);
    res.json(result.map(r => ({ company: r.company || null, total: r.total, count: r.count, agents: r.agentList || [], invoices: r.invoices })));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Export PDF helpers
const generatePdfForRows = (title, rows, columns) => {
  const doc = new jsPDF();
  doc.setFontSize(10);
  doc.text(title, 10, 10);
  doc.autoTable({ head: [columns], body: rows, startY: 16 });
  return doc.output('arraybuffer');
};

exports.exportAgentPdf = async (req, res) => {
  try {
    const agentId = req.params.agentId;
    const { month } = req.query;
    let filter = { agent: require('mongoose').Types.ObjectId(agentId) };
    if (month) {
      const [y, m] = month.split('-');
      const start = new Date(Number(y), Number(m) - 1, 1);
      const end = new Date(Number(y), Number(m), 0, 23, 59, 59, 999);
      filter.createdAt = { $gte: start, $lte: end };
    }
    const invoices = await Invoice.find(filter).populate('patient').lean();
    const rows = invoices.map(inv => [inv.invoiceNumber || '', inv.createdAt.toISOString().slice(0,10), inv.patientName || '', inv.total.toFixed(2)]);
    const pdfBuf = generatePdfForRows(`Factures Agent ${agentId} ${month || ''}`, rows, ['Facture', 'Date', 'Patient', 'Montant']);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="agent_${agentId}_${month || 'all'}.pdf"`);
    res.send(Buffer.from(pdfBuf));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.exportCompanyPdf = async (req, res) => {
  try {
    const companyId = req.params.companyId;
    const { month } = req.query;
    let filter = { subscriber: require('mongoose').Types.ObjectId(companyId) };
    if (month) {
      const [y, m] = month.split('-');
      const start = new Date(Number(y), Number(m) - 1, 1);
      const end = new Date(Number(y), Number(m), 0, 23, 59, 59, 999);
      filter.createdAt = { $gte: start, $lte: end };
    }
    const invoices = await Invoice.find(filter).populate('patient').lean();
    const rows = invoices.map(inv => [inv.invoiceNumber || '', inv.createdAt.toISOString().slice(0,10), inv.patientName || '', inv.total.toFixed(2)]);
    const pdfBuf = generatePdfForRows(`Factures Entreprise ${companyId} ${month || ''}`, rows, ['Facture', 'Date', 'Patient', 'Montant']);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="company_${companyId}_${month || 'all'}.pdf"`);
    res.send(Buffer.from(pdfBuf));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.exportMonthlyPdf = async (req, res) => {
  try {
    const { month } = req.query; // required
    if (!month) return res.status(400).json({ message: 'month param required (YYYY-MM)' });
    const [y, m] = month.split('-');
    const start = new Date(Number(y), Number(m) - 1, 1);
    const end = new Date(Number(y), Number(m), 0, 23, 59, 59, 999);
    const invoices = await Invoice.find({ createdAt: { $gte: start, $lte: end } }).populate('patient').lean();
    const rows = invoices.map(inv => [inv.invoiceNumber || '', inv.createdAt.toISOString().slice(0,10), inv.patientName || '', inv.subscriber ? inv.subscriber.toString() : '', inv.total.toFixed(2)]);
    const pdfBuf = generatePdfForRows(`Factures Mensuelles ${month}`, rows, ['Facture', 'Date', 'Patient', 'Entreprise', 'Montant']);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="monthly_${month}.pdf"`);
    res.send(Buffer.from(pdfBuf));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.update = async (req, res) => {
  try {
    const pharmacyId = req.user?.pharmacyId;
    const { items, status } = req.body;
    let invoice = await Invoice.findOne({ _id: req.params.id, ...(pharmacyId ? { pharmacyId } : {}) });
    
    if (!invoice) return res.status(404).json({ message: 'Facture introuvable' });
    
    // If status changed to cancelled, or if we are modifying items, we need to handle stock
    const wasAlreadyCancelled = invoice.status === 'cancelled';
    const isNowCancelled = status === 'cancelled';

    if (items || (isNowCancelled && !wasAlreadyCancelled)) {
      // 1. REVERSE old items stock effect (if it wasn't already cancelled)
      if (!wasAlreadyCancelled) {
        for (const oldItem of invoice.items) {
          if (oldItem.medicineId) {
            const medicine = await Medicine.findById(oldItem.medicineId);
            if (medicine) {
              medicine.addStockFIFO(oldItem.quantity, `Correction/Annulation Facture: ${req.params.id}`);
              await medicine.save();
            }
          }
        }
      }

      // 2. APPLY new items stock effect (unless it's now cancelled)
      if (!isNowCancelled) {
        const itemsToApply = items || invoice.items;
        for (const newItem of itemsToApply) {
          if (newItem.medicineId) {
            const medicine = await Medicine.findById(newItem.medicineId);
            if (medicine) {
              medicine.reduceStockFIFO(newItem.quantity, `Facture (Mise à Jour): ${req.params.id}`);
              await medicine.save();
            }
          }
        }
      }
    }

    if (items) {
      invoice.items = items;
      invoice.total = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    }
    if (status !== undefined) {
      invoice.status = status;
    }
    
    await invoice.save();
    res.json(await invoice.populate('patient'));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const pharmacyId = req.user?.pharmacyId;
    const invoice = await Invoice.findOne({ _id: req.params.id, ...(pharmacyId ? { pharmacyId } : {}) });
    
    if (!invoice) return res.status(404).json({ message: 'Facture introuvable' });

    // Restore stock
    for (const item of invoice.items) {
      if (item.medicineId) {
        const medicine = await Medicine.findById(item.medicineId);
        if (medicine) {
          medicine.addStockFIFO(item.quantity, `Annulation Facture: ${req.params.id}`);
          await medicine.save();
        }
      }
    }

    await Invoice.findByIdAndDelete(req.params.id);
    res.json({ message: 'Facture supprimée et stock restauré' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const Admission = require('../models/Admission');

// ── Statistiques par entreprise et par patient ──────────────────────────────
exports.getStatsByCompanyPatient = async (req, res) => {
  try {
    const { startDate, endDate, subscriberId } = req.query;
    const match = {};

    if (startDate || endDate) {
      match.createdAt = {};
      if (startDate) match.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        match.createdAt.$lte = end;
      }
    }
    if (subscriberId) {
      const mongoose = require('mongoose');
      match.subscriber = new mongoose.Types.ObjectId(subscriberId);
    }

    // Tableau par entreprise : montant total et liste patients
    const byCompany = await require('../models/Invoice').aggregate([
      { $match: { ...match, subscriber: { $exists: true, $ne: null } } },
      {
        $group: {
          _id: { subscriber: '$subscriber', patient: '$patient' },
          patientName: { $first: '$patientName' },
          totalAmount: { $sum: '$total' },
          invoiceCount: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: '$_id.subscriber',
          totalCompany: { $sum: '$totalAmount' },
          patients: {
            $push: {
              patientId: '$_id.patient',
              patientName: '$patientName',
              totalAmount: '$totalAmount',
              invoiceCount: '$invoiceCount'
            }
          }
        }
      },
      {
        $lookup: {
          from: 'subscribers',
          localField: '_id',
          foreignField: '_id',
          as: 'companyInfo'
        }
      },
      { $unwind: { path: '$companyInfo', preserveNullAndEmptyArrays: true } },
      { $sort: { totalCompany: -1 } }
    ]);

    // Tableau patients sans entreprise (privé)
    const privatePatients = await require('../models/Invoice').aggregate([
      { $match: { ...match, $or: [{ subscriber: null }, { subscriber: { $exists: false } }] } },
      {
        $group: {
          _id: '$patient',
          patientName: { $first: '$patientName' },
          totalAmount: { $sum: '$total' },
          invoiceCount: { $sum: 1 }
        }
      },
      { $sort: { totalAmount: -1 } }
    ]);

    res.json({
      byCompany: byCompany.map(r => ({
        companyId: r._id,
        companyName: r.companyInfo?.name || 'Inconnu',
        companyCode: r.companyInfo?.code || '',
        totalCompany: r.totalCompany,
        patients: r.patients.sort((a, b) => b.totalAmount - a.totalAmount)
      })),
      privatePatients: privatePatients.map(r => ({
        patientId: r._id,
        patientName: r.patientName || 'CLIENT PASSANT',
        totalAmount: r.totalAmount,
        invoiceCount: r.invoiceCount
      }))
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getActiveAdmission = async (req, res) => {
  try {
    const { patientId } = req.params;
    let admission = await Admission.findOne({ patient: patientId, status: 'admitted' }).populate('room');
    if (!admission) {
      admission = await Admission.findOne({ patient: patientId, status: 'discharged' }).populate('room').sort({ dischargedAt: -1 });
    }
    res.json(admission || null);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
