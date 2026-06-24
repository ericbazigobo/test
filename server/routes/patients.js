const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { checkPermission } = require('../middleware/permission');
const patientController = require('../controllers/patientController');

router.use(auth);
router.use(checkPermission('patients'));
router.get('/', patientController.list);
router.post('/', patientController.create);
router.get('/:id', patientController.get);
router.put('/:id', patientController.update);
router.delete('/:id', patientController.remove);

module.exports = router;
