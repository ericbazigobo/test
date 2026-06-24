const LabTest = require('../models/LabTest');
const AuditLog = require('../models/AuditLog');

exports.getLabTests = async (req, res) => {
  try {
    // Get all tests or filter by patient
    const query = req.query.patientId ? { patientId: req.query.patientId } : {};
    const tests = await LabTest.find(query)
      .populate('patientId', 'firstName lastName code')
      .populate('doctorId', 'username')
      .populate('labTechId', 'username')
      .sort({ dateRequested: -1 });
    res.json(tests);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createLabTest = async (req, res) => {
  try {
    const test = new LabTest({
      ...req.body,
      doctorId: req.user.id
    });
    const saved = await test.save();
    
    await AuditLog.create({
      userId: req.user.id,
      userName: req.user.username || 'System',
      action: 'CREATE',
      targetModel: 'LabTest',
      targetId: saved._id,
      details: `Demande examen labo: ${test.testName}`
    });

    res.status(201).json(saved);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.updateLabTest = async (req, res) => {
  try {
    const updateData = { ...req.body };
    if (updateData.status === 'Terminé' && !updateData.dateCompleted) {
      updateData.dateCompleted = new Date();
    }
    // Si c'est un laborantin qui met à jour
    if (req.user && req.user.role === 'lab') {
      updateData.labTechId = req.user.id;
    }

    const updated = await LabTest.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    ).populate('patientId', 'firstName lastName code');

    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
