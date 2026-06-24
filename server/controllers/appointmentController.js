const Appointment = require('../models/Appointment');
const Patient = require('../models/Patient');
const Staff = require('../models/Staff');

exports.list = async (req, res) => {
  try {
    const filter = {};
    if (req.query.patient) filter.patient = req.query.patient;
    
    if (req.query.startDate || req.query.endDate) {
      filter.date = {};
      if (req.query.startDate) filter.date.$gte = new Date(req.query.startDate);
      if (req.query.endDate) {
        const end = new Date(req.query.endDate);
        end.setHours(23, 59, 59, 999);
        filter.date.$lte = end;
      }
    }
    
    const appointments = await Appointment.find(filter)
      .populate('patient')
      .populate('staff')
      .sort({ date: 1 });
    res.json(appointments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.create = async (req, res) => {
  try {
    // pharmacyId is no longer required for appointments
    // const pharmacyId = req.user?.pharmacyId || req.body.pharmacyId;
    // if (!pharmacyId) return res.status(400).json({ message: 'PharmacyId requis' });

    const { patient: patientId, staff: staffId, date, notes, status } = req.body;
    const patient = await Patient.findOne({ _id: patientId });
    const staff = await Staff.findOne({ _id: staffId });
    if (!patient || !staff) return res.status(400).json({ message: 'Patient ou personnel invalide' });

    const appointment = new Appointment({ 
      patient: patient._id, 
      staff: staff._id, 
      date, 
      notes, 
      status: status || 'scheduled'
    });
    await appointment.save();
    await appointment.populate('patient');
    await appointment.populate('staff');
    res.status(201).json(appointment);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.update = async (req, res) => {
  try {
    const appointment = await Appointment.findOneAndUpdate(
      { _id: req.params.id },
      { $set: req.body },
      { new: true }
    ).populate('patient').populate('staff');
    if (!appointment) return res.status(404).json({ message: 'Rendez-vous introuvable' });
    res.json(appointment);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const appointment = await Appointment.findOneAndDelete({ _id: req.params.id });
    if (!appointment) return res.status(404).json({ message: 'Rendez-vous introuvable' });
    res.json({ message: 'Rendez-vous supprimé' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

