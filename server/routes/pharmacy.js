const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { checkPermission } = require('../middleware/permission');
const pharmacyController = require('../controllers/pharmacyController');

router.use(auth);
router.use(checkPermission('pharmacies'));

// Routes pour les médicaments d'une pharmacie (doivent être avant les routes avec /:id)
router.get('/import-progress/:sessionId', pharmacyController.getImportProgress);

// Routes générales des pharmacies
router.post('/import-all', pharmacyController.importAllMedicines);
router.get('/', pharmacyController.list);
router.get('/:id', pharmacyController.getById);
router.post('/', pharmacyController.create);
router.put('/:id', pharmacyController.update);
router.delete('/:id', pharmacyController.delete);

// Routes pour les médicaments d'une pharmacie
router.get('/:id/medicines', pharmacyController.getMedicines);
router.post('/:id/medicines', pharmacyController.addMedicine);
router.post('/:id/import', pharmacyController.importMedicines);
router.put('/:pharmacyId/medicines/:medicineId', pharmacyController.updateMedicine);
router.delete('/:pharmacyId/medicines/:medicineId', pharmacyController.deleteMedicine);
router.post('/stock/add', pharmacyController.addStock);
router.post('/stock/reduce', pharmacyController.reduceStock);

// Routes de vente
router.post('/sell', pharmacyController.sellMedicine);

// Routes mouvements de stock
router.get('/:pharmacyId/movements', pharmacyController.getMovements);
router.delete('/:pharmacyId/medicines/:medicineId/movements/:movementId', pharmacyController.deleteMovement);
router.put('/:pharmacyId/medicines/:medicineId/movements/:movementId', pharmacyController.updateMovement);

// Code auto-génération
router.get('/:pharmacyId/medicines/generate-code', pharmacyController.generateMedicineCode);

// Routes financières
router.post('/:id/close-month', pharmacyController.closeMonth);
router.get('/:id/financials', pharmacyController.getFinancials);
router.get('/:id/sales', pharmacyController.getSales);

// Routes de caisse
router.get('/:pharmacyId/caisse', pharmacyController.getCaisseTransactions);
router.post('/:pharmacyId/caisse', pharmacyController.createCaisseTransaction);
router.delete('/:pharmacyId/caisse/:transactionId', pharmacyController.deleteCaisseTransaction);

// Routes d'inventaire
router.post('/inventory', pharmacyController.performInventory);
router.get('/:id/inventory-reports', pharmacyController.getInventoryReports);

module.exports = router;
