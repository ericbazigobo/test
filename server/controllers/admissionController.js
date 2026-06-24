const Admission = require('../models/Admission');
const Room = require('../models/Room');
const Patient = require('../models/Patient');

exports.list = async (req, res) => {
  try {
    const { patient, startDate, endDate, month } = req.query;
    const query = {};

    if (patient) query.patient = patient;

    // Date filtering logic
    if (startDate || endDate) {
      query.admittedAt = {};
      if (startDate) query.admittedAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.admittedAt.$lte = end;
      }
    } else if (month) {
      // month format: YYYY-MM
      const [year, m] = month.split('-');
      const start = new Date(year, m - 1, 1);
      const end = new Date(year, m, 0, 23, 59, 59, 999);
      query.admittedAt = { $gte: start, $lte: end };
    }

    const admissions = await Admission.find(query)
      .populate('patient')
      .populate('room')
      .sort({ admittedAt: -1 });
    res.json(admissions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.create = async (req, res) => {
  try {
    const { patient: patientId, room: roomId, notes, treatment } = req.body;

    const patient = await Patient.findById(patientId);
    const room = await Room.findById(roomId);
    if (!patient || !room) return res.status(400).json({ message: 'Patient ou chambre invalide' });
    if (room.status === 'occupied') return res.status(400).json({ message: 'La chambre est déjà occupée' });

    room.status = 'occupied';
    room.assignedPatient = patient._id;
    await room.save();

    const admission = new Admission({ 
      patient: patient._id, 
      room: room._id, 
      status: 'admitted', 
      admittedAt: new Date(), 
      notes,
      treatment,
      pharmacyId: req.body.pharmacyId
    });
    await admission.save();
      await admission.populate('patient');
      await admission.populate('room');
      res.status(201).json(admission);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.discharge = async (req, res) => {
  try {
    const admission = await Admission.findById(req.params.id);
    if (!admission) return res.status(404).json({ message: 'Admission introuvable' });

    admission.status = 'discharged';
    admission.dischargedAt = new Date();
    await admission.save();

    const room = await Room.findById(admission.room);
    if (room) {
      room.status = 'cleaning';
      room.assignedPatient = null;
      await room.save();
    }

      await admission.populate('patient');
      await admission.populate('room');
      res.json(admission);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.update = async (req, res) => {
  try {
    const { notes, status, treatment } = req.body;
    let admission = await Admission.findById(req.params.id);
    
    if (!admission) return res.status(404).json({ message: 'Admission introuvable' });
    
    if (notes !== undefined) admission.notes = notes;
    if (status !== undefined) admission.status = status;
    if (treatment !== undefined) admission.treatment = treatment;
    
    await admission.save();
      await admission.populate('patient');
      await admission.populate('room');
      res.json(admission);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const admission = await Admission.findByIdAndDelete(req.params.id);
    if (!admission) return res.status(404).json({ message: 'Admission introuvable' });
    
    // Free the room if it was occupied
    if (admission.status === 'admitted') {
      const room = await Room.findById(admission.room);
      if (room && String(room.assignedPatient) === String(admission.patient)) {
        room.status = 'cleaning';
        room.assignedPatient = null;
        await room.save();
      }
    }
    
    res.json({ message: 'Admission supprimée' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
