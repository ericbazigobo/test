const express = require('express');
const router = express.Router();
const subscriberController = require('../controllers/subscriberController');
const multer = require('multer');

router.get('/', subscriberController.list);
router.post('/', subscriberController.create);
router.put('/:id', subscriberController.update);
router.delete('/:id', subscriberController.deactivate);

router.get('/:id/restrictions', subscriberController.getRestrictions);
router.post('/:id/restrictions', subscriberController.setRestriction);

// Upload agents Excel for a subscriber
const upload = multer({ storage: multer.memoryStorage() });
router.post('/:id/upload-agents', upload.single('file'), subscriberController.uploadAgents);
router.get('/:id/agents', subscriberController.listAgents);
router.get('/:id/billing-summary.pdf', subscriberController.billingSummaryPdf);
router.get('/:id/receipt/:invoiceId', subscriberController.posReceipt);

module.exports = router;
