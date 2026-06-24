const router = require('express').Router();
const { getSuppliers, createSupplier, updateSupplier, getPurchaseOrders, createPurchaseOrder, updatePurchaseOrder } = require('../controllers/supplierController');
const auth = require('../middleware/auth');
const { checkPermission } = require('../middleware/permission');

router.use(auth);
router.use(checkPermission('pharmacies'));
router.get('/:pharmacyId', getSuppliers);
router.post('/:pharmacyId', createSupplier);
router.put('/update/:id', updateSupplier);

router.get('/:pharmacyId/orders', getPurchaseOrders);
router.post('/:pharmacyId/orders', createPurchaseOrder);
router.put('/orders/:id', updatePurchaseOrder);

module.exports = router;
