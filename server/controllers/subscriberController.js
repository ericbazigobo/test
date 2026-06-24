const Subscriber = require('../models/Subscriber');
const SubscriberRestriction = require('../models/SubscriberRestriction');
const Medicine = require('../models/Medicine');
const Agent = require('../models/Agent');
const multer = require('multer');
const XLSX = require('xlsx');
const upload = multer({ storage: multer.memoryStorage() });

exports.list = async (req, res) => {
  try {
    const subscribers = await Subscriber.find().sort({ name: 1 });
    res.json(subscribers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.create = async (req, res) => {
  try {
    const { name, contact, address, notes } = req.body;
    const sub = new Subscriber({ name, contact, address, notes });
    await sub.save();
    res.status(201).json(sub);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.update = async (req, res) => {
  try {
    const sub = await Subscriber.findById(req.params.id);
    if (!sub) return res.status(404).json({ message: 'Abonné introuvable' });
    const { name, contact, address, notes, active } = req.body;
    if (name !== undefined) sub.name = name;
    if (contact !== undefined) sub.contact = contact;
    if (address !== undefined) sub.address = address;
    if (notes !== undefined) sub.notes = notes;
    if (active !== undefined) sub.active = !!active;
    await sub.save();
    res.json(sub);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deactivate = async (req, res) => {
  try {
    const sub = await Subscriber.findById(req.params.id);
    if (!sub) return res.status(404).json({ message: 'Abonné introuvable' });
    sub.active = false;
    await sub.save();
    res.json({ message: 'Abonné désactivé' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getRestrictions = async (req, res) => {
  try {
    const restrictions = await SubscriberRestriction.find({ subscriber: req.params.id }).populate('medicine');
    res.json(restrictions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.setRestriction = async (req, res) => {
  try {
    const { medicineId, allowed } = req.body;
    if (!medicineId) return res.status(400).json({ message: 'medicineId requis' });
    const subId = req.params.id;
    const med = await Medicine.findById(medicineId);
    if (!med) return res.status(404).json({ message: 'Médicament introuvable' });
    const up = await SubscriberRestriction.findOneAndUpdate({ subscriber: subId, medicine: medicineId }, { allowed: !!allowed }, { upsert: true, new: true });
    res.json(up);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Middleware handler for express route (uses multer) — defined as factory to be used inline in routes
exports.uploadAgentsMiddleware = upload.single('file');

exports.uploadAgents = async (req, res) => {
  try {
    const subId = req.params.id;
    const sub = await Subscriber.findById(subId);
    if (!sub) return res.status(404).json({ message: 'Abonné introuvable' });
    if (!req.file) return res.status(400).json({ message: 'Fichier requis' });

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    const created = [];
    for (const row of rows) {
      const firstName = (row.firstName || row.firstname || row['First Name'] || row['Prenom'] || '').toString().trim();
      const lastName = (row.lastName || row.lastname || row['Last Name'] || row['Nom'] || '').toString().trim();
      const family = (row.family || row['Family'] || row.famille || '').toString().trim();
      const relation = (row.relation || row.Relation || '').toString().trim();
      const identifier = (row.id || row.identifier || row.identifiant || '').toString().trim();
      const phone = (row.phone || row.telephone || row.tel || '').toString().trim();
      const email = (row.email || row.Email || '').toString().trim();

      const count = await Agent.countDocuments({ subscriber: subId });
      const seq = String(count + 1).padStart(4, '0');
      const code = `${sub.code || 'SUB'}-AG${seq}`;

      let familyCode;
      if (family) {
        familyCode = `${code}-F1`;
      }

      const name = `${firstName} ${lastName}`.trim();
      const agent = new Agent({ subscriber: subId, name, familyName: family, relation, identifier, phone, email, code, familyCode });
      await agent.save();
      created.push(agent);
    }

    res.json({ message: 'Agents importés', count: created.length, created });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.listAgents = async (req, res) => {
  try {
    const subId = req.params.id;
    const agents = await Agent.find({ subscriber: subId }).sort({ lastName: 1, firstName: 1 });
    res.json(agents);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Aggregate billing for a subscriber and return PDF summary
exports.billingSummaryPdf = async (req, res) => {
  try {
    const subId = req.params.id;
    const SubscriberModel = require('../models/Subscriber');
    const Invoice = require('../models/Invoice');
    const sub = await SubscriberModel.findById(subId);
    if (!sub) return res.status(404).json({ message: 'Abonné introuvable' });

    const invoices = await Invoice.find({ subscriber: subId }).sort({ createdAt: -1 }).limit(100);

    // Prepare a simple PDF using jsPDF and autotable
    const { jsPDF } = require('jspdf');
    require('jspdf-autotable');
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    doc.setFontSize(14);
    doc.text(`Récapitulatif facturation - ${sub.name}`, 14, 20);

    const rows = invoices.map(inv => [inv.invoiceNumber || inv._id.toString(), (inv.patientName || '') , (new Date(inv.createdAt)).toLocaleDateString(), (inv.total || 0).toFixed(2)]);
    doc.autoTable({ head: [['Facture', 'Patient', 'Date', 'Montant']], body: rows, startY: 30 });

    const total = invoices.reduce((s, i) => s + (i.total || 0), 0);
    doc.text(`Total (${invoices.length}): ${total.toFixed(2)}`, 14, doc.lastAutoTable.finalY + 10);

    const pdf = doc.output('arraybuffer');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="billing_summary_${sub.code || sub._id}.pdf"`);
    res.send(Buffer.from(pdf));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Simple POS receipt endpoint (HTML) for an invoice
exports.posReceipt = async (req, res) => {
  try {
    const invoId = req.params.id;
    const Invoice = require('../models/Invoice');
    const inv = await Invoice.findById(invoId).populate('patient');
    if (!inv) return res.status(404).json({ message: 'Invoice not found' });

    // Minimal 58mm wide HTML for printing
    const lines = [];
    lines.push(`<div style="width:58mm;font-family:monospace;">`);
    lines.push(`<h3 style="text-align:center">${inv.pharmacyName || 'Pharmacie'}</h3>`);
    lines.push(`<p>Facture: ${inv.invoiceNumber || inv._id}</p>`);
    lines.push(`<p>Date: ${new Date(inv.createdAt).toLocaleString()}</p>`);
    lines.push(`<hr/>`);
    for (const it of (inv.items || [])) {
      lines.push(`<div style="display:flex;justify-content:space-between"><span>${(it.description||it.name||'')}</span><span>${(it.quantity||1)}x${(it.unitPrice||0)}</span></div>`);
    }
    lines.push(`<hr/>`);
    lines.push(`<div style="display:flex;justify-content:space-between"><strong>Total</strong><strong>${(inv.total||0).toFixed(2)}</strong></div>`);
    lines.push(`</div>`);

    res.setHeader('Content-Type', 'text/html');
    res.send(lines.join('\n'));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
