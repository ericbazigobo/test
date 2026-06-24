const express = require('express');
const router = express.Router();
const { getExpenses, createExpense, updateExpense, deleteExpense } = require('../controllers/expenseController');
const auth = require('../middleware/auth');
const { checkPermission } = require('../middleware/permission');

router.use(auth);
router.use(checkPermission('billing'));

router.get('/', getExpenses);
router.post('/', createExpense);
router.put('/:id', updateExpense);
router.delete('/:id', deleteExpense);

module.exports = router;
