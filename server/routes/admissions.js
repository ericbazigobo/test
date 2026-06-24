const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { checkPermission } = require('../middleware/permission');
const admissionController = require('../controllers/admissionController');

router.use(auth);
router.use(checkPermission('admissions'));
router.get('/', admissionController.list);
router.post('/', admissionController.create);
router.post('/:id/discharge', admissionController.discharge);
router.put('/:id', admissionController.update);
router.delete('/:id', admissionController.remove);

module.exports = router;
