const router = require('express').Router();
const { getAttendances, createAttendance, updateAttendance } = require('../controllers/attendanceController');
const auth = require('../middleware/auth');
const { checkPermission } = require('../middleware/permission');

router.use(auth);
router.use(checkPermission('staff'));
router.get('/', getAttendances);
router.post('/', createAttendance);
router.put('/:id', updateAttendance);

module.exports = router;
