const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { checkPermission } = require('../middleware/permission');
const staffController = require('../controllers/staffController');

router.use(auth);
router.use(checkPermission('staff'));
router.get('/', staffController.list);
router.post('/', staffController.create);
router.put('/:id', staffController.update);
router.delete('/:id', staffController.remove);

module.exports = router;
