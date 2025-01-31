const express = require("express")

const router = new express.Router()

const expenseController = require('../controller/Expenses/expenseController');


const checkPermission = require('../controller/permission');
const { verifyToken } = require('../controller/middleware');

// expense
router.post('/add-expense', verifyToken, expenseController.addExpense);
router.get('/get-all-expense', verifyToken, expenseController.getAllExpense);
router.get('/get-one-expense/:expenseId', verifyToken, expenseController.getOneExpense);
router.get('/get-last-expense-prefix', verifyToken, expenseController.getLastExpensePrefix);
// router.put('/update-expense/:id', verifyToken, expenseController.updateExpense);
// router.delete('/delete-expense/:id', verifyToken, expenseController.deleteExpense);

// expenseCategory
router.post('/add-category', verifyToken, expenseController.addCategory);
router.get('/get-all-category', verifyToken, expenseController.getAllCategory);
router.get('/get-one-category/:categoryId', verifyToken, expenseController.getACategory);
router.put('/update-category/:categoryId', verifyToken, expenseController.updateCategory);
router.delete('/delete-category/:categoryId', verifyToken, expenseController.deleteCategory);



module.exports = router