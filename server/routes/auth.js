const express = require('express');
const router = express.Router();
const { login } = require('../controllers/authController');
const auth = require('../middleware/auth');
const RolePermission = require('../models/RolePermission');
const { loadConfig, saveConfig } = require('../utils/configManager');
const User = require('../models/User');
const bcrypt = require('bcryptjs');

router.post('/login', login);

// Admin-only endpoints for permissions and configuration
router.get('/permissions', auth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Accès réservé aux administrateurs' });
  }
  try {
    const permissions = await RolePermission.find();
    res.json(permissions);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération des permissions', error: error.message });
  }
});

router.put('/permissions', auth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Accès réservé aux administrateurs' });
  }
  try {
    const { permissions } = req.body; // array of { role, allowedModules }
    for (const p of permissions) {
      await RolePermission.findOneAndUpdate(
        { role: p.role },
        { allowedModules: p.allowedModules },
        { upsert: true, new: true }
      );
    }
    res.json({ message: 'Permissions mises à jour avec succès' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la mise à jour des permissions', error: error.message });
  }
});

router.get('/config', auth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Accès réservé aux administrateurs' });
  }
  try {
    const config = loadConfig();
    res.json(config);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération de la configuration', error: error.message });
  }
});

router.post('/config', auth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Accès réservé aux administrateurs' });
  }
  try {
    const success = saveConfig(req.body);
    if (success) {
      res.json({ message: 'Configuration enregistrée avec succès. Veuillez redémarrer l\'application pour appliquer les changements.' });
    } else {
      res.status(500).json({ message: 'Impossible d\'enregistrer la configuration' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de l\'enregistrement de la configuration', error: error.message });
  }
});

// Admin-only CRUD for User Management
router.get('/users', auth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Accès réservé aux administrateurs' });
  }
  try {
    const users = await User.find().populate('pharmacyId');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la récupération des utilisateurs', error: error.message });
  }
});

router.post('/users', auth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Accès réservé aux administrateurs' });
  }
  try {
    const { name, email, password, role, pharmacyId } = req.body;
    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: 'Champs obligatoires manquants (nom, email, mot de passe, rôle)' });
    }
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Un utilisateur avec cet email existe déjà' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      role,
      pharmacyId
    });
    await newUser.save();
    res.status(201).json(await newUser.populate('pharmacyId'));
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la création de l\'utilisateur', error: error.message });
  }
});

router.put('/users/:id', auth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Accès réservé aux administrateurs' });
  }
  try {
    const { name, email, password, role, pharmacyId } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur introuvable' });
    }
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ message: 'Un utilisateur avec cet email existe déjà' });
      }
      user.email = email;
    }
    if (name) user.name = name;
    if (role) user.role = role;
    if (pharmacyId) user.pharmacyId = pharmacyId;
    if (password && password.trim() !== '') {
      user.password = await bcrypt.hash(password, 10);
    }
    await user.save();
    res.json(await user.populate('pharmacyId'));
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la mise à jour de l\'utilisateur', error: error.message });
  }
});

router.delete('/users/:id', auth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Accès réservé aux administrateurs' });
  }
  try {
    if (String(req.user.id) === String(req.params.id)) {
      return res.status(400).json({ message: 'Impossible de supprimer votre propre compte' });
    }
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur introuvable' });
    }
    res.json({ message: 'Utilisateur supprimé avec succès' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la suppression de l\'utilisateur', error: error.message });
  }
});

module.exports = router;
