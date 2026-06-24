const router = require('express').Router();
const { getConsultationsByPatient, createConsultation, updateConsultation } = require('../controllers/consultationController');
const auth = require('../middleware/auth');
const { checkPermission } = require('../middleware/permission');

router.use(auth);
router.use(checkPermission('patients'));
router.get('/patient/:patientId', getConsultationsByPatient);
router.post('/', createConsultation);
router.put('/:id', updateConsultation);

module.exports = router;
