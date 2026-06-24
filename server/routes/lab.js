const router = require('express').Router();
const { getLabTests, createLabTest, updateLabTest } = require('../controllers/labController');
const auth = require('../middleware/auth');
const { checkPermission } = require('../middleware/permission');

router.use(auth);
router.use(checkPermission('laboratory'));
router.get('/', getLabTests);
router.post('/', createLabTest);
router.put('/:id', updateLabTest);

module.exports = router;
