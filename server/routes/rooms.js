const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { checkPermission } = require('../middleware/permission');
const roomController = require('../controllers/roomController');

router.use(auth);
router.use(checkPermission('rooms'));
router.get('/', roomController.list);
router.post('/', roomController.create);
router.put('/:id', roomController.update);
router.delete('/:id', roomController.remove);

module.exports = router;
