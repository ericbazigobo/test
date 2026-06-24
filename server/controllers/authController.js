const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

exports.login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email }).populate('pharmacyId');
    if (!user) return res.status(400).json({ message: 'Utilisateur introuvable' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Identifiants invalides' });

    const RolePermission = require('../models/RolePermission');
    const { getDefaultModulesForRole } = require('../middleware/permission');
    
    let allowedModules = [];
    if (user.role === 'admin') {
      allowedModules = ['patients', 'admissions', 'rooms', 'pharmacies', 'billing', 'staff', 'laboratory', 'appointments', 'reports'];
    } else {
      const perm = await RolePermission.findOne({ role: user.role });
      allowedModules = perm ? perm.allowedModules : getDefaultModulesForRole(user.role);
    }

    const payload = {
      id: user._id,
      role: user.role,
      name: user.name,
      email: user.email,
      pharmacyId: user.pharmacyId?._id,
      pharmacyName: user.pharmacyId?.name,
      allowedModules
    };
    const secret = process.env.JWT_SECRET || 'emeraude-secret-key-super-secure-2026';
    const token = jwt.sign(payload, secret, { expiresIn: '8h' });

    res.json({ token, user: payload });
  } catch (error) {
    res.status(500).json({ message: 'Erreur de connexion', error: error.message });
  }
};
