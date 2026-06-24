const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { checkPermission } = require('../middleware/permission');
const billingController = require('../controllers/billingController');

router.use(auth);
router.use(checkPermission('billing'));
router.get('/', billingController.list);
router.get('/active-admission/:patientId', billingController.getActiveAdmission);
// Debug logging for billing create requests
router.post('/', (req, res, next) => {
	try {
		console.log('Billing route hit - headers:', JSON.stringify(req.headers).slice(0,1000));
		console.log('Billing route hit - body (preview):', JSON.stringify(req.body).slice(0,1000));
	} catch (e) {
		console.warn('Billing route debug log failed', e.message);
	}
	next();
}, billingController.create);
router.get('/agent-summary', billingController.agentBilling);
router.get('/company-summary', billingController.companyBilling);
router.get('/stats/by-company-patient', billingController.getStatsByCompanyPatient);
router.get('/export/agent/:agentId', billingController.exportAgentPdf);
router.get('/export/company/:companyId', billingController.exportCompanyPdf);
router.get('/export/monthly', billingController.exportMonthlyPdf);
router.post('/:id/pay', billingController.pay);
router.put('/:id', billingController.update);
router.delete('/:id', billingController.remove);

module.exports = router;
