const express = require("express")

const router = new express.Router()

const expenseController = require('../controller/Expenses/expenseController');
const updateExpense = require('../controller/Expenses/updateExpense');

const checkPermission = require('../controller/permission');
const { verifyToken } = require('../controller/middleware');
const { nexVerifyToken } = require('../controller/nexMiddleware');


// expense
router.post('/add-expense', verifyToken, checkPermission("Created a New Expense"), expenseController.addExpense);
router.get('/get-all-expense', verifyToken, checkPermission("Viewed Expense Details"), expenseController.getAllExpense);
router.get('/get-one-expense/:expenseId', verifyToken, checkPermission("Viewed Expense Details"), expenseController.getOneExpense);
router.get('/get-last-expense-prefix', verifyToken, checkPermission("Created a New Expense"), expenseController.getLastExpensePrefix);
router.put('/update-expense/:expenseId', verifyToken, checkPermission("Edited Expense Information"), updateExpense.updateExpense);
router.delete('/delete-expense/:expenseId', verifyToken, checkPermission("Deleted Expense Information"), updateExpense.deleteExpense);
router.get('/expense-journal/:expenseId', verifyToken, checkPermission("Viewed Expense Details"), expenseController.expenseJournal);


// expenseCategory
router.post('/add-category', verifyToken, checkPermission("Created a New Expense Category"), expenseController.addCategory);
router.get('/get-all-category', verifyToken, checkPermission("Viewed Expense Category Details"), expenseController.getAllCategory);
router.get('/get-one-category/:categoryId', verifyToken, checkPermission("Viewed Expense Category Details"), expenseController.getACategory);
router.put('/update-category/:categoryId', verifyToken, checkPermission("Edited Expense Category Information"), expenseController.updateCategory);
router.delete('/delete-category/:categoryId', verifyToken, checkPermission("Deleted Expense Category Information"), expenseController.deleteCategory);















//nexPortal
router.post('/add-expense-nexportal', nexVerifyToken, checkPermission('Created a New Expense'), expenseController.addExpense);
router.get('/get-all-expense-nexportal', nexVerifyToken, checkPermission('Viewed Expense Details'), expenseController.getAllExpense);
router.get('/get-one-expense-nexportal/:expenseId', nexVerifyToken, checkPermission('Viewed Expense Details'), expenseController.getOneExpense);
router.get('/get-last-expense-prefix-nexportal', nexVerifyToken, checkPermission('Created a New Expense'), expenseController.getLastExpensePrefix);
router.put('/update-expense-nexportal/:expenseId', nexVerifyToken, checkPermission('Edited Expense Information'), updateExpense.updateExpense);
router.delete('/delete-expense-nexportal/:expenseId', nexVerifyToken, checkPermission('Deleted Expense Information'), updateExpense.deleteExpense);
router.get('/expense-journal-nexportal/:expenseId', nexVerifyToken, checkPermission('Viewed Expense Details'), expenseController.expenseJournal);

router.post('/add-category-nexportal', nexVerifyToken, checkPermission('Created a New Expense Category'), expenseController.addCategory);
router.get('/get-all-category-nexportal', nexVerifyToken, checkPermission('Viewed Expense Category Details'), expenseController.getAllCategory);
router.get('/get-one-category-nexportal/:categoryId', nexVerifyToken, checkPermission('Viewed Expense Category Details'), expenseController.getACategory);
router.put('/update-category-nexportal/:categoryId', nexVerifyToken, checkPermission('Edited Expense Category Information'), expenseController.updateCategory);
router.delete('/delete-category-nexportal/:categoryId', nexVerifyToken, checkPermission('Deleted Expense Category Information'), expenseController.deleteCategory);


module.exports = router