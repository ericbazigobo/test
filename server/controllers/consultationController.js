const Consultation = require('../models/Consultation');
const Patient = require('../models/Patient');
const AuditLog = require('../models/AuditLog');

exports.getConsultationsByPatient = async (req, res) => {
  try {
    const consultations = await Consultation.find({ patientId: req.params.patientId })
      .populate('doctorId', 'username role')
      .sort({ date: -1 });
    res.json(consultations);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createConsultation = async (req, res) => {
  try {
    const consultation = new Consultation({
      ...req.body,
      doctorId: req.user.id
    });
    const savedConsultation = await consultation.save();
    
    await AuditLog.create({
      userId: req.user.id,
      userName: req.user.username || 'System',
      action: 'CREATE',
      targetModel: 'Consultation',
      targetId: savedConsultation._id,
      details: `Création d'une consultation pour patient ${req.body.patientId}`
    });

    res.status(201).json(savedConsultation);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.updateConsultation = async (req, res) => {
  try {
    const updatedConsultation = await Consultation.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json(updatedConsultation);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
