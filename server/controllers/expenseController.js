const Expense = require('../models/Expense');

exports.getExpenses = async (req, res) => {
  try {
    const { pharmacyId } = req.query;
    const query = {};
    if (pharmacyId) query.pharmacyId = pharmacyId;

    const expenses = await Expense.find(query).sort({ date: -1 });
    res.json(expenses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createExpense = async (req, res) => {
  try {
    const expense = new Expense(req.body);
    await expense.save();
    res.status(201).json(expense);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.updateExpense = async (req, res) => {
  try {
    const expense = await Expense.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!expense) return res.status(404).json({ message: 'Dépense non trouvée' });
    res.json(expense);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.deleteExpense = async (req, res) => {
  try {
    const expense = await Expense.findByIdAndDelete(req.params.id);
    if (!expense) return res.status(404).json({ message: 'Dépense non trouvée' });
    res.json({ message: 'Dépense supprimée' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
