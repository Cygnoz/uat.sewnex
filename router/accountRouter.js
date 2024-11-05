const express = require("express")
const router = new express.Router()

const accountController = require("../controller/accountController")
const journalController = require("../controller/journalController")


const checkPermission = require('../controller/permission');
const { verifyToken } = require('../controller/middleware');



//Sensitive

router.put('/get-bank-account-number/:accountId',verifyToken,checkPermission('Viewed Account Number'),accountController.getBankAccNum)



//Accounts

// router.post('/add-account',accountController.addAccount)

router.post('/add-account',verifyToken,checkPermission('Created a New Account'),accountController.addAccount)

router.get('/get-all-account',verifyToken,checkPermission('Viewed Account Information'),accountController.getAllAccount)

router.get('/get-one-account/:accountId',verifyToken,checkPermission('Viewed Account Information'),accountController.getOneAccount)

router.put('/edit-account/:accountId',verifyToken,checkPermission('Edited Account Information'),accountController.editAccount)

router.delete('/delete-account/:accountId',verifyToken,checkPermission('Deleted an Account'),accountController.deleteAccount)




//Journal

router.post('/add-journal-entry',verifyToken,checkPermission('Added a Journal Entry'),journalController.addJournalEntry)

router.get('/get-all-journal',verifyToken,checkPermission('Viewed Journal Entry'),journalController.getAllJournal)

router.get('/get-one-journal/:id',verifyToken,checkPermission('Viewed Journal Entry'),journalController.getOneJournal)

router.get('/get-last-journal-prefix',verifyToken,checkPermission('Added a Journal Entry'),journalController.getLastJournalPrefix)




//Trial Balance

router.get('/get-one-trial-balance/:accountId',verifyToken,checkPermission('Viewed Account Information'),accountController.getOneTrailBalance)





module.exports = router
