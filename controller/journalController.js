// v1.0

const Organization = require("../database/model/organization");
const Account = require("../database/model/account");
const Prefix = require("../database/model/prefix");
const Journal = require("../database/model/journal");
const TrialBalance = require("../database/model/trialBalance");
const moment = require('moment-timezone');

const { singleCustomDateTime, multiCustomDateTime } = require("../services/timeConverter");
const { cleanData } = require("../services/cleanData");



// Add Journal Entry
exports.addJournalEntry = async (req, res) => {
    console.log("Add journal Entry:", req.body);
    try {
        const { organizationId, id: userId, userName } = req.user;

        //Clean Data
        const cleanedData = cleanCustomerData(req.body);
        cleanedData.transaction = cleanedData.transaction?.map(acc => cleanCustomerData(acc)) || [];

        const { transaction } = cleanedData;

        const transactionIds = transaction.map(item => item.accountId);
        
        // Check for duplicate itemIds
        const uniqueItemIds = new Set(transactionIds);
        if (uniqueItemIds.size !== transactionIds.length) {            
          return res.status(400).json({ message: "Duplicate Accounts found" });
        }        

        // Check if the organization exists
        const existingOrganization = await Organization.findOne({ organizationId });
        if (!existingOrganization) {
            return res.status(404).json({
                message: "No Organization Found.",
            });
        }
        

        // Check if all accounts exist for the given organization
        const allAccountIds = transaction.map(trans => trans.accountId);
        const existingAccounts = await Account.find({
            _id: { $in: allAccountIds },
            organizationId
        });

        if (existingAccounts.length !== allAccountIds.length) {
            return res.status(404).json({
                message: "One or more accounts not found for the given organization."
            });
        }

              //Validate Inputs  
        if (!validateInputs(cleanedData, existingOrganization.organizationId, res)) return;


        // Check if the organizationId exists in the Prefix collection
        const existingPrefix = await Prefix.findOne({ organizationId });
        if (!existingPrefix) {
            return res.status(404).json({ message: "No Prefix data found for the organization." });
        }
        console.log("Existing Prefix:", existingPrefix);

        // Ensure series is an array and contains items
        if (!Array.isArray(existingPrefix.series)) {
            return res.status(500).json({ message: "Series is not an array or is missing." });
        }
        if (existingPrefix.series.length === 0) {
            return res.status(404).json({ message: "No series data found for the organization." });
        }
        

        // Find the series with status true
        const activeSeries = existingPrefix.series.find(series => series.status === true);
        if (!activeSeries) {
            return res.status(404).json({ message: "No active series found for the organization." });
        }
        // Generate the journalId by joining journal and journalNum
        const journalId = `${activeSeries.journal}${activeSeries.journalNum}`;

        // Increment the journalNum for the active series
        activeSeries.journalNum += 1;

        // Save the updated prefix collection
        await existingPrefix.save();
        
        cleanedData.journalId =journalId;

        cleanedData.journalId =journalId;

        // Create a new journal entry
        const newJournalEntry = new Journal({ ...cleanedData, organizationId });


        
        const entry = await newJournalEntry.save();
        console.log("Journal entry",entry);

        

        // Insert data into TrialBalance collection and update account balances
        for (const trans of transaction) {
            const newTrialEntry = new TrialBalance({
                organizationId,
                operationId:newJournalEntry._id,
                transactionId: journalId,
                accountId: trans.accountId,
                accountName: trans.accountName,
                action: "Journal",
                debitAmount: trans.debitAmount,
                creditAmount: trans.creditAmount,
                remark: cleanedData.note
            });

            const entry = await newTrialEntry.save();
            console.log("Trial entry",entry);

            
        }

        res.status(201).json({
            message: "Journal entry created successfully."
        });
        console.log("Journal entry created successfully:", newJournalEntry);
    } catch (error) {
        console.error("Error creating journal entry:", error);
        res.status(500).json({ message: "Internal server error." });
    }
};



// Get all Journal for a given organizationId
exports.getAllJournal = async (req, res) => {
    try {
        const organizationId = req.user.organizationId;

        // Find all accounts where organizationId matches
        const journal = await Journal.find({ organizationId });

        if (!journal.length) {
            return res.status(404).json({
                message: "No Journal found for the provided organization ID.",
            });
        }

        res.status(200).json(journal);
    } catch (error) {
        console.error("Error fetching journals:", error);
        res.status(500).json({ message: "Internal server error." });
    }
};

// Get one Journal by ID for a given organizationId
exports.getOneJournal = async (req, res) => {
    try {
        const { id } = req.params;
        const organizationId = req.user.organizationId;

        // Find the journal where id and organizationId matches
        const journal = await Journal.findOne({ _id: id, organizationId: organizationId });
        
        if (!journal) {
            return res.status(404).json({
                message: "Journal not found for the provided ID and organization ID.",
            });
        }

        res.status(200).json(journal);
    } catch (error) {
        console.error("Error fetching journal:", error);
        res.status(500).json({ message: "Internal server error." });
    }
};


// Get Last Journal Prefix
exports.getLastJournalPrefix = async (req, res) => {
    try {
        const organizationId = req.user.organizationId;

        // Find all accounts where organizationId matches
        const prefix = await Prefix.findOne({ organizationId:organizationId,'series.status': true });

        if (!prefix) {
            return res.status(404).json({
                message: "No Prefix found for the provided organization ID.",
            });
        }
        
        const series = prefix.series[0];     
        const lastPrefix = series.journal + series.journalNum;
        console.log(lastPrefix);

        res.status(200).json(lastPrefix);
    } catch (error) {
        console.error("Error fetching accounts:", error);
        res.status(500).json({ message: "Internal server error." });
    }
};









// Function to generate time and date for storing in the database
function generateTimeAndDateForDB(timeZone, dateFormat, dateSplit, baseTime = new Date(), timeFormat = 'HH:mm:ss', timeSplit = ':') {
    // Convert the base time to the desired time zone
    const localDate = moment.tz(baseTime, timeZone);
  
    // Format date and time according to the specified formats
    let formattedDate = localDate.format(dateFormat);
    
    // Handle date split if specified
    if (dateSplit) {
      // Replace default split characters with specified split characters
      formattedDate = formattedDate.replace(/[-/]/g, dateSplit); // Adjust regex based on your date format separators
    }
  
    const formattedTime = localDate.format(timeFormat);
    const timeZoneName = localDate.format('z'); // Get time zone abbreviation
  
    // Combine the formatted date and time with the split characters and time zone
    const dateTime = `${formattedDate} ${formattedTime.split(':').join(timeSplit)} (${timeZoneName})`;
  
    return {
      date: formattedDate,
      time: `${formattedTime} (${timeZoneName})`,
      dateTime: dateTime
    };
  }
  










  //Clean Data 
function cleanCustomerData(data) {
    const cleanData = (value) => (value === null || value === undefined || value === "" ? undefined : value);
    return Object.keys(data).reduce((acc, key) => {
      acc[key] = cleanData(data[key]);
      return acc;
    }, {});
  }







  //Validate inputs
  function validateInputs( data, organizationId, res) {
    const validationErrors = validateAccountData( data, organizationId );
  
    if (validationErrors.length > 0) {
      res.status(400).json({ message: validationErrors.join(", ") });
      return false;
    }
    return true;
  }




  //Validate Data
  function validateAccountData( data, organizationId ) {
    const errors = [];

    //Basic Info
    validateReqFields( data,  errors);
    validTransaction ( data, data.transaction,  errors);
    
    
    
    return errors;
  }

// Field validation utility
function validateField(condition, errorMsg, errors) {
    if (condition) {errors.push(errorMsg);
    console.log(errorMsg);}
    
}
//Valid Req Fields
function validateReqFields( data, errors ) {
    validateField( typeof data.transaction === 'undefined', `Select an accounts`, errors );  
    validateField( typeof data.date === 'undefined', `Please select a date`, errors );  
}
// Function to Validate transaction
function validTransaction( data, transaction, errors ) {

    const calculatedTotalDebitAmount = transaction.reduce((sum, trans) => sum + trans.debitAmount, 0);
    const calculatedTotalCreditAmount = transaction.reduce((sum, trans) => sum + trans.creditAmount, 0);

    validateField( calculatedTotalDebitAmount !== calculatedTotalCreditAmount , `Calculated debit and credit amounts must be equal.`, errors );  

    validateField( data.totalDebitAmount !== calculatedTotalDebitAmount || data.totalCreditAmount !== calculatedTotalCreditAmount , `Provided total debit and credit amounts must match the calculated amounts.`, errors );  

    validateField( transaction.length <2 ,`Select two or more Accounts. ${transaction.length}`, errors );  
 
    transaction.forEach((transaction) => {        

        validateField( typeof transaction.debitAmount === 'undefined' && typeof transaction.creditAmount === 'undefined' , `Please enter debit or credit amount`, errors );  

        validateField( transaction.debitAmount === 0 &&  transaction.creditAmount === 0 , `Please enter debit or credit amount for account ${transaction.accountName}`, errors );  

        validateFloatFields(['debitAmount', 'creditAmount'], transaction, errors);
  
  
      });
  }
  //Valid Float Fields  
  function validateFloatFields(fields, data, errors) {
    fields.forEach((balance) => {
      validateField(data[balance] && !isFloat(data[balance]),
        "Invalid " + balance.replace(/([A-Z])/g, " $1") + ": " + data[balance], errors);
    });
  }
  function isFloat(value) {
    return /^-?\d+(\.\d+)?$/.test(value);
  }