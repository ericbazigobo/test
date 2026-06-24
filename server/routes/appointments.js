const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { checkPermission } = require('../middleware/permission');
const appointmentController = require('../controllers/appointmentController');

router.use(auth);
router.use(checkPermission('appointments'));
router.get('/', appointmentController.list);
router.post('/', appointmentController.create);
router.put('/:id', appointmentController.update);
router.delete('/:id', appointmentController.remove);

module.exports = router;
