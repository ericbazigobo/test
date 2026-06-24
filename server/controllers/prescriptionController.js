const Prescription = require('../models/Prescription');
const AuditLog = require('../models/AuditLog');

exports.getPatientPrescriptions = async (req, res) => {
  try {
    const prescriptions = await Prescription.find({ patientId: req.params.patientId })
      .populate('doctorId', 'username role')
      .populate('medications.medicineId', 'name code')
      .sort({ date: -1 });
    res.json(prescriptions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getPendingPrescriptions = async (req, res) => {
  try {
    const prescriptions = await Prescription.find({ status: { $in: ['En attente', 'Partiellement servie'] } })
      .populate('patientId', 'firstName lastName code')
      .populate('doctorId', 'username')
      .sort({ date: 1 });
    res.json(prescriptions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createPrescription = async (req, res) => {
  try {
    const prescription = new Prescription({
      ...req.body,
      doctorId: req.body.doctorId || req.user.id
    });
    const saved = await prescription.save();
    
    await AuditLog.create({
      userId: req.user.id,
      userName: req.user.username || 'System',
      action: 'CREATE',
      targetModel: 'Prescription',
      targetId: saved._id,
      details: `Prescription créée pour patient ${req.body.patientId}`
    });

    if (req.broadcast) {
      req.broadcast({ type: 'PRESCRIPTION_CREATED', prescription: saved });
    }

    res.status(201).json(saved);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.updatePrescriptionStatus = async (req, res) => {
  try {
    const updated = await Prescription.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true }
    );
    if (req.broadcast) {
      req.broadcast({ type: 'PRESCRIPTION_CREATED', prescription: updated });
    }
    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
