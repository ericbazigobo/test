const router = require('express').Router();
const { getPatientPrescriptions, getPendingPrescriptions, createPrescription, updatePrescriptionStatus } = require('../controllers/prescriptionController');
const auth = require('../middleware/auth');
const { checkPermission } = require('../middleware/permission');

router.use(auth);
router.use(checkPermission(['patients', 'pharmacies']));
router.get('/patient/:patientId', getPatientPrescriptions);
router.get('/pending', getPendingPrescriptions);
router.post('/', createPrescription);
router.put('/:id/status', updatePrescriptionStatus);

module.exports = router;
