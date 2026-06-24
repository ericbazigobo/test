const Staff = require('../models/Staff');

exports.list = async (req, res) => {
  try {
    const staff = await Staff.find().sort({ lastName: 1, firstName: 1 });
    res.json(staff);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.create = async (req, res) => {
  try {
    const staff = new Staff(req.body);
    await staff.save();
    res.status(201).json(staff);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.update = async (req, res) => {
  try {
    const staff = await Staff.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true }
    );
    if (!staff) return res.status(404).json({ message: 'Personnel introuvable' });
    res.json(staff);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const staff = await Staff.findByIdAndDelete(req.params.id);
    if (!staff) return res.status(404).json({ message: 'Personnel introuvable' });
    res.json({ message: 'Personnel supprimé' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

