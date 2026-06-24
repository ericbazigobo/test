const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { checkPermission } = require('../middleware/permission');
const reportsController = require('../controllers/reportsController');

router.use(auth);
router.use(checkPermission('reports'));
router.get('/', reportsController.stats);
router.post('/monthly', reportsController.generateMonthlyReport);
router.get('/monthly', reportsController.getMonthlyReports);
router.get('/hospital-financials', reportsController.getHospitalFinancials);
router.post('/reset-monthly', reportsController.resetMonthlyData);

module.exports = router;
