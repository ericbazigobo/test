const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Subscriber = require('../models/Subscriber');
const Agent = require('../models/Agent');
const Patient = require('../models/Patient');
const Room = require('../models/Room');
const Medicine = require('../models/Medicine');
const Staff = require('../models/Staff');
const Appointment = require('../models/Appointment');
const Admission = require('../models/Admission');
const Invoice = require('../models/Invoice');
const Pharmacy = require('../models/Pharmacy');
const bcrypt = require('bcryptjs');

// DANGEROUS: Reset database and reseed (admin only)
router.post('/reseed', async (req, res) => {
  try {
    console.log('🗑️ Nettoyage complet de la base de données...');
    
    // Delete everything
    await User.deleteMany();
    await Patient.deleteMany();
    await Room.deleteMany();
    await Medicine.deleteMany();
    await Staff.deleteMany();
    await Appointment.deleteMany();
    await Admission.deleteMany();
    await Invoice.deleteMany();
    await Subscriber.deleteMany();
    await Agent.deleteMany();
    await Pharmacy.deleteMany();
    
    console.log('🧹 Initialisation des données de test...');
    
    // Create pharmacies
    const pharmacies = await Pharmacy.create([
      { name: 'Pharmacie Centrale', code: 'PHARM-001', address: 'Bâtiment Principal', manager: 'Dr. Marie Dubois' },
      { name: 'Pharmacie Pédiatrique', code: 'PHARM-002', address: 'Aile Est', manager: 'Dr. Jean Martin' },
      { name: 'Pharmacie d\'Urgence', code: 'PHARM-003', address: 'Urgences', manager: 'Dr. Sophie Laurent' },
      { name: 'Pharmacie Cardiologie', code: 'PHARM-004', address: 'Service Cardio', manager: 'Dr. Pierre Dubois' },
      { name: 'Pharmacie Dermatologie', code: 'PHARM-005', address: 'Service Dermato', manager: 'Dr. Anne Moreau' },
      { name: 'Pharmacie Gynécologie', code: 'PHARM-006', address: 'Service Gynéco', manager: 'Dr. Claire Bernard' },
      { name: 'Pharmacie Ophtalmologie', code: 'PHARM-007', address: 'Service Ophtalmo', manager: 'Dr. Michel Roux' },
      { name: 'Pharmacie ORL', code: 'PHARM-008', address: 'Service ORL', manager: 'Dr. Isabelle Petit' },
      { name: 'Pharmacie Psychiatrie', code: 'PHARM-009', address: 'Service Psychiatrie', manager: 'Dr. Alain Leroy' },
      { name: 'Pharmacie Générale', code: 'PHARM-010', address: 'Rez-de-chaussée', manager: 'Dr. Thomas Durand' },
      { name: 'Pharmacie Chirurgie', code: 'PHARM-011', address: 'Bloc Opératoire', manager: 'Dr. Sophie Martin' },
      { name: 'Pharmacie Néonatologie', code: 'PHARM-012', address: 'Service Néonatal', manager: 'Dr. Marie Dubois' },
      { name: 'Pharmacie Oncologie', code: 'PHARM-013', address: 'Service Oncologie', manager: 'Dr. Jean-François Leroy' },
      { name: 'Pharmacie Radiologie', code: 'PHARM-014', address: 'Service Radiologie', manager: 'Dr. Catherine Moreau' },
      { name: 'Pharmacie Urgences', code: 'PHARM-015', address: 'Service Urgences', manager: 'Dr. Philippe Roux' }
    ]);

    // Create admin user
    const adminPassword = await bcrypt.hash('admin123', 10);
    await User.create({
      name: 'Admin Centre Médical Emeraude',
      email: 'admin@emeraude.com',
      password: adminPassword,
      role: 'admin',
      pharmacyId: pharmacies[0]._id
    });

    // Create patients
    const patients = [];
    for (let i = 0; i < pharmacies.length; i++) {
      const pharmacyPatients = await Patient.create([
        { firstName: 'Claire', lastName: `Lemaire${i}`, dob: '1992-06-20', gender: 'female', phone: `060102030${i}`, email: `claire${i}@example.com`, address: '12 rue du Parc', history: [{ date: new Date(), note: 'Visite initiale' }], pharmacyId: pharmacies[i]._id },
        { firstName: 'Samuel', lastName: `Bernard${i}`, dob: '1985-02-10', gender: 'male', phone: `060203040${i}`, email: `samuel${i}@example.com`, address: '25 avenue Victor', history: [{ date: new Date(), note: 'Contrôle tension' }], pharmacyId: pharmacies[i]._id }
      ]);
      patients.push(...pharmacyPatients);
    }

    // Create rooms
    for (let i = 0; i < pharmacies.length; i++) {
      await Room.create([
        { number: `10${i}1`, type: 'standard', status: 'vacant', price: 15000, pharmacyId: pharmacies[i]._id },
        { number: `10${i}2`, type: 'standard', status: 'vacant', price: 15000, pharmacyId: pharmacies[i]._id }
      ]);
    }

    // Create medicines
    for (let i = 0; i < pharmacies.length; i++) {
      await Medicine.create([
        { name: 'Paracétamol', code: `MED-001-${i}`, stock: 150, lowStockThreshold: 20, price: 1500, movements: [{ type: 'in', quantity: 150, note: 'Stock initial' }], pharmacyId: pharmacies[i]._id },
        { name: 'Ibuprofène', code: `MED-002-${i}`, stock: 80, lowStockThreshold: 15, price: 2000, movements: [{ type: 'in', quantity: 80, note: 'Stock initial' }], pharmacyId: pharmacies[i]._id }
      ]);
    }

    // Create staff
    for (let i = 0; i < pharmacies.length; i++) {
      await Staff.create([
        { firstName: 'Mathilde', lastName: `Simon${i}`, role: 'doctor', specialty: 'Généraliste', phone: `061121314${i}`, email: `mathilde${i}.simon@emeraude.com`, pharmacyId: pharmacies[i]._id }
      ]);
    }

    // Create 8 subscribers
    const subscribers = await Subscriber.create([
      { name: 'KAMBOVE MINING', contact: '+243973338887', address: 'Bâtiment Principal' },
      { name: 'DTS', contact: '+243123456789', address: 'Siège DTS' },
      { name: 'TIA', contact: '+243987654321', address: 'Bureau TIA' },
      { name: 'RAWBANK', contact: '+243555666777', address: 'Siège RAWBANK' },
      { name: 'CME AGENT', contact: '+243111222333', address: 'Centre CME' },
      { name: 'CME FAMILLE', contact: '+243444555666', address: 'Centre CME Famille' },
      { name: 'MORCO', contact: '+243777888999', address: 'Bureau MORCO' },
      { name: 'GGA', contact: '+243222333444', address: 'Siège GGA' }
    ]);

    res.json({
      success: true,
      message: '✅ Données de test réinitialisées avec succès',
      data: {
        pharmacies: pharmacies.length,
        patients: patients.length,
        subscribers: subscribers.length,
        admin: 'admin@emeraude.com / admin123'
      }
    });
  } catch (error) {
    console.error('Reseed error:', error);
    res.status(500).json({
      success: false,
      message: '❌ Erreur lors du reseed',
      error: error.message
    });
  }
});

module.exports = router;
