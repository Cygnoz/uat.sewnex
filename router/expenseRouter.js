const express = require("express")

const router = new express.Router()

const expenseController = require('../controller/Expenses/expenseController');
const updateExpense = require('../controller/Expenses/updateExpense');

const checkPermission = require('../controller/permission');
const { verifyToken } = require('../controller/middleware');
const { nexVerifyToken } = require('../controller/nexMiddleware');


// expense
router.post('/add-expense', verifyToken, expenseController.addExpense);
router.get('/get-all-expense', verifyToken, expenseController.getAllExpense);
router.get('/get-one-expense/:expenseId', verifyToken, expenseController.getOneExpense);
router.get('/get-last-expense-prefix', verifyToken, expenseController.getLastExpensePrefix);
router.put('/update-expense/:expenseId', verifyToken, updateExpense.updateExpense);
router.delete('/delete-expense/:expenseId', verifyToken, updateExpense.deleteExpense);
router.get('/expense-journal/:expenseId',verifyToken,expenseController.expenseJournal);


// expenseCategory
router.post('/add-category', verifyToken, expenseController.addCategory);
router.get('/get-all-category', verifyToken, expenseController.getAllCategory);
router.get('/get-one-category/:categoryId', verifyToken, expenseController.getACategory);
router.put('/update-category/:categoryId', verifyToken, expenseController.updateCategory);
router.delete('/delete-category/:categoryId', verifyToken, expenseController.deleteCategory);















//nexPortal
router.post('/add-expense-nexportal', nexVerifyToken, expenseController.addExpense);
router.get('/get-all-expense-nexportal', nexVerifyToken, expenseController.getAllExpense);
router.get('/get-one-expense-nexportal/:expenseId', nexVerifyToken, expenseController.getOneExpense);
router.get('/get-last-expense-prefix-nexportal', nexVerifyToken, expenseController.getLastExpensePrefix);
router.put('/update-expense-nexportal/:expenseId', nexVerifyToken, updateExpense.updateExpense);
router.delete('/delete-expense-nexportal/:expenseId', nexVerifyToken, updateExpense.deleteExpense);
router.get('/expense-journal-nexportal/:expenseId',nexVerifyToken,expenseController.expenseJournal);

router.post('/add-category-nexportal', nexVerifyToken, expenseController.addCategory);
router.get('/get-all-category-nexportal', nexVerifyToken, expenseController.getAllCategory);
router.get('/get-one-category-nexportal/:categoryId', nexVerifyToken, expenseController.getACategory);
router.put('/update-category-nexportal/:categoryId', nexVerifyToken, expenseController.updateCategory);
router.delete('/delete-category-nexportal/:categoryId', nexVerifyToken, expenseController.deleteCategory);


module.exports = router