const express = require("express")

const router = new express.Router()

const expenseController = require('../controller/expenseController');


// expense
router.post('/add-expense', expenseController.addExpense);
router.get('/get-all-expense', expenseController.getAllExpense);
router.get('/get-one-expense/:id', expenseController.getAExpense);
router.put('/update-expense/:id', expenseController.updateExpense);
router.delete('/delete-expense/:id', expenseController.deleteExpense);

// expenseCategory
router.post('/add-category', expenseController.addCategory);
router.get('/get-all-category', expenseController.getAllCategory);
router.get('/get-one-category/:id', expenseController.getACategory);
router.put('/update-category/:id', expenseController.updateCategory);
router.delete('/delete-category/:id', expenseController.deleteCategory);



module.exports = router