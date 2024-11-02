const express = require("express")

const router = new express.Router()

const expenseController = require('../controller/expenseController');


const checkPermission = require('../controller/permission');
const { verifyToken } = require('../controller/middleware');

// expense
router.post('/add-expense',verifyToken, expenseController.addExpense);
router.get('/get-all-expense',verifyToken, expenseController.getAllExpense);
router.get('/get-one-expense/:id',verifyToken, expenseController.getOneExpense);
router.put('/update-expense/:id', expenseController.updateExpense);
router.delete('/delete-expense/:id', expenseController.deleteExpense);

// expenseCategory
router.post('/add-category',verifyToken, expenseController.addCategory);
router.get('/get-all-category',verifyToken, expenseController.getAllCategory);
router.get('/get-one-category/:id',verifyToken, expenseController.getACategory);
router.put('/update-category/:id',verifyToken, expenseController.updateCategory);
router.delete('/delete-category/:id',verifyToken, expenseController.deleteCategory);



module.exports = router