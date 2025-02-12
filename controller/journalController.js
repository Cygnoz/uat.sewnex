// v1.0

const Organization = require("../database/model/organization");
const Account = require("../database/model/account");
const Prefix = require("../database/model/prefix");
const Journal = require("../database/model/journal");
const TrialBalance = require("../database/model/trialBalance");

const mongoose = require('mongoose');
const moment = require("moment-timezone");

const { singleCustomDateTime, multiCustomDateTime } = require("../services/timeConverter");
const { cleanData } = require("../services/cleanData");


// Fetch existing data
const dataExist = async ( organizationId, id ) => {
    const [ existingOrganization, allJournal, journal, existingPrefix ] = await Promise.all([
    Organization.findOne({ organizationId }).lean(),
    Journal.find({ organizationId })
    .populate({
    path: "transaction.accountId", 
    select: "accountName",
    })
    .lean(),
    
    Journal.findOne({ _id: id, organizationId })
    .populate({
    path: "transaction.accountId", // Populate the accountId field
    select: "accountName", // Include only the accountName field
    })    
    .lean(),
      
    Prefix.findOne({ organizationId:organizationId,'series.status': true })

    ]);
    return { existingOrganization, allJournal, journal, existingPrefix };
  };

// Add Journal Entry
exports.addJournalEntry = async (req, res) => {
    console.log("Add journal Entry:", req.body);
    try {
        const { organizationId, id: userId, userName } = req.user;

        //Clean Data
        const cleanedData = cleanData(req.body);
        cleanedData.transaction = cleanedData.transaction?.map(acc => cleanData(acc)) || [];

        const { transaction } = cleanedData;

        const transactionIds = transaction.map(item => item.accountId);
        
        // Check for duplicate itemIds
        const uniqueItemIds = new Set(transactionIds);
        if (uniqueItemIds.size !== transactionIds.length) {            
          return res.status(400).json({ message: "Duplicate Accounts found" });
        }     

        // Data Exist
        const { existingOrganization, existingPrefix } = await dataExist( organizationId );   

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

        //Data Exist Validation
        if (!validateOrganizationPrefix( existingOrganization, existingPrefix, res )) return;
        
        //Validate Inputs  
        if (!validateInputs(cleanedData, existingOrganization.organizationId, res)) return;

        //Prefix
        await journalPrefix( cleanedData, existingPrefix );

        cleanedData.createdDateTime = moment.tz(cleanedData.date, "YYYY-MM-DDTHH:mm:ss.SSS[Z]", existingOrganization.timeZoneExp).toISOString();     
        
        // Create a new journal entry
        const savedJournal = await createNewJournal(cleanedData, organizationId, userId, userName );      

        // Insert data into TrialBalance collection and update account balances
        for (const trans of transaction) {
            const newTrialEntry = new TrialBalance({
                organizationId,
                operationId:savedJournal._id,
                transactionId: cleanedData.journalId,
                accountId: trans.accountId,
                action: "Journal",
                debitAmount: trans.debitAmount,
                creditAmount: trans.creditAmount,
                createdDateTime:cleanedData.createdDateTime,
                remark: cleanedData.note
            });

            const entry = await newTrialEntry.save();
            console.log("Trial entry",entry);
        }

        res.status(201).json({ message: "Journal entry created successfully." });
        console.log("Journal entry created successfully:", savedJournal);
    } catch (error) {
        console.error("Error creating journal entry:", error);
        res.status(500).json({ message: "Internal server error." });
    }
};



// Update Journal Entry 
exports.updateJournalEntry = async (req, res) => {
    console.log("Update Journal Entry:", req.body);

    try {
      const { organizationId } = req.user;
      const { id } = req.params; 

        // Fetch existing journal entry
      const existingJournalEntry = await Journal.findOne({ _id: id, organizationId });
      if (!existingJournalEntry) {
        console.log("Journal entry not found with ID:", id);
        return res.status(404).json({ message: "Journal entry not found!" });
      }

      //Clean Data
      const cleanedData = cleanData(req.body);
      cleanedData.transaction = cleanedData.transaction?.map(acc => cleanData(acc)) || [];

      const { transaction } = cleanedData;

      const transactionIds = transaction.map(t => t.accountId);
        
      // Check for duplicate transactionIds
      const uniqueTransactionIds = new Set(transactionIds);
      if (uniqueTransactionIds.size !== transactionIds.length) {            
        return res.status(400).json({ message: "Duplicate Accounts found!" });
      }  

      // Ensure `journalId` field matches the existing journal entry
      if (cleanedData.journalId !== existingJournalEntry.journalId) {
        return res.status(400).json({
          message: `The provided journalId does not match the existing record. Expected: ${existingJournalEntry.journalId}`,
        });
      }
      
      // Data Exist
      const { existingOrganization, existingPrefix } = await dataExist( organizationId );   

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

      //Data Exist Validation
      if (!validateOrganizationPrefix( existingOrganization, existingPrefix, res )) return;
        
      //Validate Inputs  
      if (!validateInputs(cleanedData, existingOrganization.organizationId, res)) return;

      cleanedData.createdDateTime = moment.tz(cleanedData.date, "YYYY-MM-DDTHH:mm:ss.SSS[Z]", existingOrganization.timeZoneExp).toISOString();     

      const mongooseDocument = Journal.hydrate(existingJournalEntry);
      Object.assign(mongooseDocument, cleanedData);
      const savedJournal = await mongooseDocument.save();
      if (!savedJournal) {
        return res.status(500).json({ message: "Failed to update journal entry!" });
      }

      // Fetch existing TrialBalance's createdDateTime
      const existingTrialBalance = await TrialBalance.findOne({
        organizationId: savedJournal.organizationId,
        operationId: savedJournal._id,
      });  
    
      // If there are existing entries, delete them
      if (existingTrialBalance) {
        await TrialBalance.deleteMany({
          organizationId: savedJournal.organizationId,
          operationId: savedJournal._id,
        });
        console.log(`Deleted existing TrialBalance entries for operationId: ${savedJournal._id}`);
      }

      // Insert data into TrialBalance collection and update account balances
      for (const trans of transaction) {
        const newTrialEntry = new TrialBalance({
            organizationId,
            operationId:savedJournal._id,
            transactionId: cleanedData.journalId,
            accountId: trans.accountId,
            action: "Journal",
            debitAmount: trans.debitAmount,
            creditAmount: trans.creditAmount,
            remark: cleanedData.note,
            createdDateTime: cleanedData.createdDateTime
        });

        const entry = await newTrialEntry.save();
        console.log("Trial entry",entry);
      }

      res.status(200).json({ message: "Journal entry updated successfully", savedJournal });
      // console.log("Journal entry updated successfully:", savedJournal);
    } catch (error) {
      console.error("Error updating journal entry:", error);
      res.status(500).json({ message: "Internal server error" });
    }
}


// Get all Journal for a given organizationId
exports.getAllJournal = async (req, res) => {
    try {
        const organizationId = req.user.organizationId;

        const { allJournal, existingOrganization } = await dataExist( organizationId, null );

        if (!allJournal.length) {
            return res.status(404).json({
                message: "No Journal found for the provided organization ID.",
            });
        }

        const transformedItems = allJournal.map(acc => ({
            ...acc,        
            transaction : acc.transaction.map(data => ({
                ...data,        
                accountId: data.accountId?._id || undefined,
                accountName: data.accountId?.accountName || undefined,
              })),
        }));


        const formattedObjects = multiCustomDateTime(transformedItems, existingOrganization.dateFormatExp, existingOrganization.timeZoneExp, existingOrganization.dateSplit );          
     

        res.status(200).json(formattedObjects);
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

        const { journal, existingOrganization } = await dataExist( organizationId, id );
        
        if (!journal) {
            return res.status(404).json({
                message: "Journal not found for the provided ID and organization ID.",
            });
        }

        console.log("Journal:", journal);
        
        journal.transaction = journal.transaction.map(acc => ({
            ...acc,        
            accountId: acc.accountId?._id || undefined,
            accountName: acc.accountId?.accountName || undefined,
        }));
        
        const formattedObjects = singleCustomDateTime(journal, existingOrganization.dateFormatExp, existingOrganization.timeZoneExp, existingOrganization.dateSplit );          

        res.status(200).json(formattedObjects);

    } catch (error) {
        console.error("Error fetching journal:", error);
        res.status(500).json({ message: "Internal server error." });
    }
};


// Delete Journal Entry 
exports.deleteJournalEntry  = async (req, res) => {
    console.log("Delete journal entry request received:", req.params);

    try {
        const { organizationId } = req.user;
        const { id } = req.params;

        // Validate id
        if (!mongoose.Types.ObjectId.isValid(id) || id.length !== 24) {
            return res.status(400).json({ message: `Invalid Journal Entry ID: ${id}` });
        }

        // Fetch existing journal entry
        const existingJournalEntry = await Journal.findOne({ _id: id, organizationId });
        if (!existingJournalEntry) {
            console.log("Journal entry not found with ID:", id);
            return res.status(404).json({ message: "Journal entry not found!" });
        }

        // Fetch existing TrialBalance's createdDateTime
        const existingTrialBalance = await TrialBalance.findOne({
          organizationId: existingJournalEntry.organizationId,
          operationId: existingJournalEntry._id,
        });  
        // If there are existing entries, delete them
        if (existingTrialBalance) {
          await TrialBalance.deleteMany({
            organizationId: existingJournalEntry.organizationId,
            operationId: existingJournalEntry._id,
          });
          console.log(`Deleted existing TrialBalance entries for operationId: ${existingJournalEntry._id}`);
        }

        // Delete the journal entry
        const deletedJournalEntry = await existingJournalEntry.deleteOne();
        if (!deletedJournalEntry) {
            console.error("Failed to delete journal entry!");
            return res.status(500).json({ message: "Failed to delete journal entry!" });
        }

        res.status(200).json({ message: "Journal entry deleted successfully!" });
        console.log("Journal entry deleted successfully with ID:", id);

    } catch (error) {
        console.error("Error deleting journal entry:", error);
        res.status(500).json({ message: "Internal server error!" });
    }
  };





// Create New Journal
function createNewJournal( data, organizationId, userId, userName ) {
    const newJournal = new Journal({ ...data, organizationId, status :"Sent", userId, userName });
    return newJournal.save();
}


// Validate Organization Tax Currency
function validateOrganizationPrefix( existingOrganization, existingPrefix, res ) {
    if (!existingOrganization) {
      res.status(404).json({ message: "Organization not found" });
      return false;
    }
    if (!existingPrefix) {
      res.status(404).json({ message: "Prefix not found" });
      return false;
    }
    return true;
}



// Journal Prefix
function journalPrefix( cleanData, existingPrefix ) {
    const activeSeries = existingPrefix.series.find(series => series.status === true);
    if (!activeSeries) {
        return res.status(404).json({ message: "No active series found for the organization." });
    }
    cleanData.journalId = `${activeSeries.journal}${activeSeries.journalNum}`;
  
    activeSeries.journalNum += 1;
  
    existingPrefix.save() 
}

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

        res.status(200).json(lastPrefix);
    } catch (error) {
        console.error("Error fetching accounts:", error);
        res.status(500).json({ message: "Internal server error." });
    }
};






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