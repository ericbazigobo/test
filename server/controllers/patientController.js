const Patient = require('../models/Patient');

const buildFilter = (req) => {
  const filter = {};
  const search = req.query.search?.trim();
  if (search) {
    filter.$or = [
      { firstName: { $regex: search, $options: 'i' } },
      { lastName: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { code: { $regex: search, $options: 'i' } }
    ];
  }
  return filter;
};

exports.list = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const filter = buildFilter(req);
    const [totalItems, patients] = await Promise.all([
      Patient.countDocuments(filter),
      Patient.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
    ]);

    const totalPages = Math.max(1, Math.ceil(totalItems / limit));

    res.json({ items: patients, page, limit, totalPages, totalItems });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.create = async (req, res) => {
  try {
    const code = await Patient.generateCode();
    const patient = new Patient({ ...req.body, code });
    await patient.save();
    res.status(201).json(patient);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.get = async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id).lean();
    if (!patient) return res.status(404).json({ message: 'Patient introuvable' });
    res.json(patient);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.update = async (req, res) => {
  try {
    const patient = await Patient.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true }
    ).lean();
    if (!patient) return res.status(404).json({ message: 'Patient introuvable' });
    res.json(patient);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const patient = await Patient.findByIdAndDelete(req.params.id).lean();
    if (!patient) return res.status(404).json({ message: 'Patient introuvable' });
    res.json({ message: 'Patient supprimé' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
