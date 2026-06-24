const Attendance = require('../models/Attendance');

exports.getAttendances = async (req, res) => {
  try {
    const query = req.query.staffId ? { staffId: req.query.staffId } : {};
    const attendances = await Attendance.find(query)
      .populate('staffId', 'firstName lastName role')
      .sort({ date: -1 });
    res.json(attendances);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createAttendance = async (req, res) => {
  try {
    const attendance = new Attendance(req.body);
    const saved = await attendance.save();
    res.status(201).json(saved);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.updateAttendance = async (req, res) => {
  try {
    const updated = await Attendance.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
