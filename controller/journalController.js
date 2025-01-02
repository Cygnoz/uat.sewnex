// v1.0

const Organization = require("../database/model/organization");
const Account = require("../database/model/account");
const Prefix = require("../database/model/prefix");
const Journal = require("../database/model/journal");
const TrialBalance = require("../database/model/trialBalance");

const { singleCustomDateTime, multiCustomDateTime } = require("../services/timeConverter");
const { cleanData } = require("../services/cleanData");


// Fetch existing data
const dataExist = async ( organizationId, journalId ) => {
    const [ existingOrganization, allJournal, journal, prefix ] = await Promise.all([
    Organization.findOne({ organizationId }).lean(),

    Journal.find({ organizationId })
    .populate({
    path: "transaction.accountId", 
    select: "accountName",
    })
    .lean(),
    
    Journal.findOne({ _id: journalId, organizationId })
    .populate({
    path: "transaction.accountId", // Populate the accountId field
    select: "accountName", // Include only the accountName field
    })    
    .lean(),
      
    Prefix.findOne({ organizationId:organizationId,'series.status': true }).lean(),

    ]);
    return { existingOrganization, allJournal, journal, prefix };
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


// Get Last Journal Prefix
exports.getLastJournalPrefix = async (req, res) => {
    try {
        const organizationId = req.user.organizationId;

        // Find all accounts where organizationId matches
        const { prefix } = await dataExist( organizationId, null );

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