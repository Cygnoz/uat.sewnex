// v1.0

const Organization = require("../database/model/organization");
const Account = require("../database/model/account")
const TrialBalance = require("../database/model/trialBalance")
const Currency = require("../database/model/currency");
const crypto = require('crypto');

const { singleCustomDateTime, multiCustomDateTime } = require("../services/timeConverter");
const { cleanData } = require("../services/cleanData");

const key = Buffer.from(process.env.ENCRYPTION_KEY, 'utf8'); 
const iv = Buffer.from(process.env.ENCRYPTION_IV, 'utf8'); 


// Fetch existing data
const dataExist = async ( organizationId, parentAccountId, accountId ) => {
  const [ existingOrganization, currencyExists, parentAccountExist, accountExist, trialBalance, allAccount ] = await Promise.all([
    Organization.findOne({ organizationId }).lean(),
    Currency.find({ organizationId }, { currencyCode: 1, _id: 0 }).lean(),
    Account.findOne({ organizationId , _id : parentAccountId}).lean(),
    Account.findOne({ _id: accountId, organizationId: organizationId })
    .populate('parentAccountId', 'accountName')    
    .lean(),
    TrialBalance.find({ accountId: accountId, organizationId: organizationId })
    .populate('accountId', 'accountName')
    .lean()
    .sort({ createDateTime: 1 }),
    Account.find({ organizationId: organizationId },{ bankAccNum: 0 , organizationId : 0 })
    .populate('parentAccountId', 'accountName')
    .lean(),
  ]);
  return { existingOrganization, currencyExists, parentAccountExist, accountExist, trialBalance, allAccount };
};




//Add Account
exports.addAccount = async (req, res) => {
    console.log("Add Account:", req.body);

    try {
      const organizationId = req.user.organizationId;

      const cleanedData = cleanData(req.body);
      
      const { parentAccountId } = cleanedData;

      const { existingOrganization, currencyExists, parentAccountExist } = await dataExist(organizationId, parentAccountId, null);      

      //Data Exist Validation
      if (!validateDataExist( existingOrganization, currencyExists, parentAccountId, parentAccountExist, null, null, res )) return;     
  
     //Validate Inputs  
     if (!validateInputs( cleanedData, organizationId, currencyExists, parentAccountExist, null, null, res )) return; 
  
      // Check if an accounts with the same name already exists
      const existingAccount = await Account.findOne({ accountName: cleanedData.accountName, organizationId: organizationId });  
      if (existingAccount) {
        console.log("Account with the provided Account Name already exists");
        return res.status(409).json({ message: "Account with the provided Account Name already exists."});        
      }     

      // Encrypt bankAccNum before storing it
      if(cleanedData.bankAccNum){ cleanedData.bankAccNum = encrypt(cleanedData.bankAccNum); }

      const newAccount = new Account({ ...cleanedData, organizationId, systemAccounts: false });      
      await newAccount.save();

      const trialEntry = new TrialBalance({
        organizationId: organizationId,
        operationId: newAccount._id,
        accountId: newAccount._id,
        action: "Opening Balance",
        debitAmount: cleanedData.debitOpeningBalance || 0,
        creditAmount: cleanedData.creditOpeningBalance || 0,
        remark: newAccount.remark,
      });
      await trialEntry.save();
  
      
      res.status(201).json({ message: "Account created successfully." });
      console.log("Account created successfully",newAccount,trialEntry);
    } catch (error) {
      console.error("Error creating Account:", error);
      res.status(500).json({ message: "Internal server error." });
    } 
};


//Edit account
exports.editAccount = async (req, res) => {
  console.log("Edit Account:", req.body);
  try {
    const { accountId } = req.params;
    const organizationId = req.user.organizationId;

    const cleanedData = cleanData(req.body);

    const { parentAccountId } = cleanedData;

    const { existingOrganization, currencyExists, parentAccountExist, accountExist, trialBalance } = await dataExist(organizationId, parentAccountId, accountId);

    //Data Exist Validation
    if (!validateDataExist( existingOrganization, currencyExists, parentAccountId, parentAccountExist, accountId, accountExist, res )) return;       

    //Validate Inputs  
    if (!validateInputs( cleanedData, organizationId, currencyExists, parentAccountExist, accountExist, trialBalance, res )) return; 

    // Encrypt bankAccNum before storing it
    if(cleanedData.bankAccNum){ cleanedData.bankAccNum = encrypt(bankAccNum); }

    // Save updated account
    Object.assign(accountExist, cleanedData);
    const savedAccount = await accountExist.save();

    if (!savedAccount) {
      console.error("Account could not be saved.");
      return res.status(500).json({ message: "Failed to Update account." });
    } 

    res.status(200).json({ message: "Account updated successfully." });
    console.log("Account updated successfully:");
  } catch (error) {
    console.error("Error updating Account:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};


// Get all accounts for a given organizationId
exports.getAllAccount = async (req, res) => {
    try {
      const organizationId = req.user.organizationId;

      const { existingOrganization, allAccount } = await dataExist(organizationId, null, null);

      if (!allAccount.length) {
        return res.status(404).json({ message: "No accounts found for the provided organization ID." });
      }

      const transformedItems = allAccount.map(acc => ({
        ...acc,        
        parentAccountId: acc.parentAccountId?._id || undefined,
        parentAccountName: acc.parentAccountId?.accountName || undefined,
      }));
       

      const formattedObjects = multiCustomDateTime(transformedItems, existingOrganization.dateFormatExp, existingOrganization.timeZoneExp, existingOrganization.dateSplit );          

      
    res.status(200).json(formattedObjects);
  } catch (error) {
    console.error("Error fetching accounts:", error);
    res.status(500).json({ message: "Internal server error.", error: error });
  }
};


//Get one Account for a given organizationId
exports.getOneAccount = async (req, res) => {
  try {
    const { accountId } = req.params;
    const organizationId = req.user.organizationId;

    // Find the account by accountId 
    const { existingOrganization, accountExist } = await dataExist(organizationId, null, accountId);

    if (!accountExist) {
      return res.status(404).json({ message: "Account not found for the provided Organization ID and Account ID." });
    }

    const data = {
      ...accountExist,
      parentAccountId: accountExist.parentAccountId?._id || undefined,
      parentAccountName: accountExist.parentAccountId?.accountName || undefined,
    }

    const formattedObjects = singleCustomDateTime(data, existingOrganization.dateFormatExp, existingOrganization.timeZoneExp, existingOrganization.dateSplit );    
    
    res.status(200).json(formattedObjects);
  } catch (error) {
    console.error("Error fetching account:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};


// Get only bankAccNum for a given organizationId and accountId
exports.getBankAccNum = async (req, res) => {
  try {
      const { accountId } = req.params;
      const organizationId = req.user.organizationId;

      const account = await Account.findOne({ _id: accountId, organizationId: organizationId }, 'bankAccNum'); 

      if (!account) {
          return res.status(404).json({ message: "Account not found" });
      }

      // Decrypt the bankAccNum
      let decryptedBankAccNum = null;
      if (account.bankAccNum) {
          decryptedBankAccNum = decrypt(account.bankAccNum);
      }

      res.status(200).json({ bankAccNum: decryptedBankAccNum });
  } catch (error) {
      console.error("Error fetching bank account number:", error);
      res.status(500).json({ message: "Internal server error." });
  }
};


//Delete account
exports.deleteAccount = async (req, res) => {
  try {
    const { accountId } = req.params;
    const organizationId = req.user.organizationId;

    // Check if an account with the given organizationId and accountId exists
    const { accountExist, trialBalance } = await dataExist(organizationId, null, accountId);

    if (!accountExist) {
      return res.status(404).json({ message: "Account not found" });
    }
    if (trialBalance.length > 1) {
      return res.status(404).json({ message: "You cannot delete this account as it is associated with transactions." });
    }
    if (accountExist.delete === "false") {
      return res.status(404).json({ message: "Account cannot be deleted" });
    }

    // Delete the account
    await accountExist.delete();

    res.status(200).json({ message: "Account deleted successfully.", deletedAccount: accountExist });
    console.log("Account deleted successfully:", accountExist );
  } catch (error) {
    console.error("Error deleting Account:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};


//Get all trial balance for a given account
exports.getOneTrailBalance = async (req, res) => {
  try {
      const { accountId } = req.params;
      const organizationId = req.user.organizationId;      

      const { existingOrganization, accountExist, trialBalance } = await dataExist(organizationId, null, accountId);

      if (!accountExist) {
        return res.status(404).json({ message: "Account not found." });
      }
      if (!trialBalance) {
          return res.status(404).json({ message: "Trial Balance not found." });
      }

      const transformedItems = trialBalance.map(acc => ({
        ...acc,        
        accountId: acc.accountId?._id || undefined,
        accountName: acc.accountId?.accountName || undefined,
      }));

      // Sort trialBalance by createdDateTime
      transformedItems.sort((a, b) => new Date(a.createdDateTime) - new Date(b.createdDateTime));

      const formattedObjects = multiCustomDateTime(transformedItems, existingOrganization.dateFormatExp, existingOrganization.timeZoneExp, existingOrganization.dateSplit );    
      
      const trialBalanceWithCumulativeSum = calculateCumulativeSum(formattedObjects);      

      res.status(200).json(trialBalanceWithCumulativeSum);
  } catch (error) {
      console.error("Error fetching account:", error);
      res.status(500).json({ message: "Internal server error.", error: error });
  }
};


// Add cumulative sum to transactions
function calculateCumulativeSum(transactions) {
  let cumulativeSum = 0;
  return transactions.map((transaction) => {
    // Calculate cumulative sum
    cumulativeSum += (transaction.debitAmount || 0) - (transaction.creditAmount || 0);

    // Format the cumulative sum based on its value
    const formattedCumulativeSum =
      cumulativeSum === 0
        ? 0
        : cumulativeSum > 0
        ? `${Math.abs(cumulativeSum)}(Dr)`
        : `${Math.abs(cumulativeSum)}(Cr)`;

    return {
      ...transaction,
      cumulativeSum: formattedCumulativeSum,
    };
  });
}














//Account Structure
const validStructure = {
  Asset: {
    Asset: [
      "Current Asset",
      "Non-Current Asset",
      "Cash",
      "Bank",
      // "Sundry Debtors",
    ],
    Equity: ["Equity"],
    Income: [
      "Sales", 
      "Indirect Income"
    ],
  },
  Liability: {
    Liabilities: [
      "Current Liability",
      "Non-Current Liability",
      // "Sundry Creditors",
    ],
    Expenses: [
      "Direct Expense", 
      "Cost of Goods Sold", 
      "Indirect Expense"
    ],
  },
};


//encryption 
function encrypt(text) {
  try {
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const authTag = cipher.getAuthTag().toString('hex'); // Get authentication tag

      return `${iv.toString('hex')}:${encrypted}:${authTag}`; // Return IV, encrypted text, and tag
  } catch (error) {
      console.error("Encryption error:", error);
      throw error;
  }
}


//decryption
function decrypt(encryptedText) {
  try {
      // Split the encrypted text to get the IV, encrypted data, and authentication tag
      const [ivHex, encryptedData, authTagHex] = encryptedText.split(':');
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');

      // Create the decipher with the algorithm, key, and IV
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(authTag); // Set the authentication tag

      let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
  } catch (error) {
      console.error("Decryption error:", error);
      throw error;
  }
}






// Validation function for account structure
function validateAccountStructure(accountGroup, accountHead, accountSubhead) {
  return (
    validStructure[accountGroup]?.[accountHead]?.includes(accountSubhead) ||
    false
  );
}

// Validation function for bank details
function validateBankDetails(accountSubhead, bankDetails) {
  if (accountSubhead === "Bank") {
    // Validate if all bank details are present
    return bankDetails.bankAccNum && bankDetails.bankIfsc && bankDetails.bankCurrency;
  }

  // Set bank details to undefined if not "Bank"
  bankDetails.bankAccNum = bankDetails.bankIfsc = bankDetails.bankCurrency = undefined;
  return true;
}


  // Validate Organization Tax Currency
  function validateDataExist( existingOrganization, currencyExists, parentAccountId, parentAccountExist, accountId, accountExist, res) {
    if (!existingOrganization) {
      res.status(404).json({ message: "Organization not found" });
      return false;
    }
    if (!currencyExists) {
      res.status(404).json({ message: "Currency not found" });
      return false;
    }
    if (parentAccountId) {
      if (!parentAccountExist) {
        res.status(404).json({ message: "Parent account not found" });
        return false;
      }
    }
    if (accountId) {
      if (!accountExist) {
        res.status(404).json({ message: "Account not found" });
        return false;
      }
    }
    
    return true;
  }





























//Validate inputs
function validateInputs( data,  organizationId, currencyExists, parentAccountExist, accountExist, trialBalance, res ) {
  const validCurrencies = currencyExists.map((currency) => currency.currencyCode);
  const parentAccountType = ["Other Asset", "Bank", "Payment clearing", "Credit card", "Other Liability", "Overseas Tax Payable", "Other Income", "Other Expense" ];  
  const validationErrors = validateData( data, organizationId, validCurrencies, parentAccountType, parentAccountExist, accountExist, trialBalance );

 if (validationErrors.length > 0) {
   res.status(400).json({ message: validationErrors.join(", ") });
   return false;
 }
 return true;
}


// Field validation utility
function validateField(condition, errorMsg, errors) {
  if (condition) {
    console.log(errorMsg);      
    errors.push(errorMsg)};
}



//Validate Data
function validateData( data, organizationId, validCurrencies, parentAccountType, parentAccountExist, accountExist, trialBalance ) {  
  
  const errors = [];

  //Basic Info

  //OtherDetails
  validateReqFields( data, errors);
  validateAccountStructure(data.accountGroup, data.accountHead, data.accountSubhead, parentAccountExist, errors);

  //Parent Account
  validateParentAccountType(parentAccountExist, data.accountSubhead, parentAccountType, errors);
  


  validateAlphanumericFields(['bankIfsc'], data, errors);
  validateIntegerFields(['bankAccNum'], data, errors);
  //validateFloatFields([''], data, errors);
  //validateAlphabetsFields([''], data, errors);

  //Currency
  validateCurrency(data.bankCurrency, validCurrencies, errors);

  //Edit Account
  if(accountExist){

    if(trialBalance.length > 1){
      validateField( accountExist.accountSubhead !== data.accountSubhead || accountExist.accountHead !== data.accountHead || accountExist.accountGroup !== data.accountGroup, "Account Type cannot be changed", errors);
    }
  }

  return errors;
}






//Valid Req Fields
function validateReqFields( data, errors ) {
  
  validateField(typeof data.accountName === 'undefined', "Account Name required", errors);
  validateField(typeof data.accountSubhead === 'undefined', "Account Subhead required", errors);
  validateField(typeof data.accountHead === 'undefined', "Account Head required", errors);
  validateField(typeof data.accountGroup === 'undefined', "Account Group required", errors);
  
  
  // validateField( typeof data.debitOpeningBalance === 'undefined' && typeof data.creditOpeningBalance === 'undefined', "Opening Balance required", errors );
  validateField( typeof data.debitOpeningBalance !== 'undefined' && typeof data.creditOpeningBalance !== 'undefined', "Select Credit or Debit Opening Balance", errors );

  if (data.accountSubhead === "Bank") {
    validateField(typeof data.bankAccNum === 'undefined', "Bank Account Number required", errors);
    validateField(typeof data.bankIfsc === 'undefined', "IFSC required", errors);
    validateField(typeof data.bankCurrency === 'undefined', "Currency required", errors);
  }
}


// Validation function for account structure
function validateAccountStructure(accountGroup, accountHead, accountSubhead, parentAccountExist, errors) {
  validateField(!validStructure[accountGroup]?.[accountHead]?.includes(accountSubhead) || false, "Invalid Account Group, Head, or Subhead.", errors);
  if(parentAccountExist){
    validateField(!validStructure[parentAccountExist.accountGroup]?.[parentAccountExist.accountHead]?.includes(parentAccountExist.accountSubhead) || false, "Invalid Parent Account.", errors);    
    validateField( parentAccountExist.accountGroup !== accountGroup || parentAccountExist.accountHead !== accountHead || parentAccountExist.accountSubhead !== accountSubhead , "Invalid Parent Account.", errors);
  }
}


//Valid Alphanumeric Fields
function validateAlphanumericFields(fields, data, errors) {
  fields.forEach((field) => {
    validateField(data[field] && !isAlphanumeric(data[field]), "Invalid " + field + ": " + data[field], errors);
  });
}

// Validate Integer Fields
function validateIntegerFields(fields, data, errors) {
fields.forEach(field => {
  validateField(data[field] && !isInteger(data[field]), `Invalid ${field}: ${data[field]}`, errors);
});
}

//Valid Float Fields  
function validateFloatFields(fields, data, errors) {
  fields.forEach((balance) => {
    validateField(data[balance] && !isFloat(data[balance]),
      "Invalid " + balance.replace(/([A-Z])/g, " $1") + ": " + data[balance], errors);
  });
}

//Valid Alphabets Fields 
function validateAlphabetsFields(fields, data, errors) {
  fields.forEach((field) => {
    if (data[field] !== undefined) {
      validateField(!isAlphabets(data[field]),
        field.charAt(0).toUpperCase() + field.slice(1) + " should contain only alphabets.", errors);
    }
  });
}


//Validate Currency
function validateCurrency(currency, validCurrencies, errors) {
  validateField(currency && !validCurrencies.includes(currency), "Invalid Currency: " + currency, errors);
}


//Validate Parent Account Type
function validateParentAccountType(parentAccountExist, accountSubhead, parentAccountType, errors) {
  if (parentAccountExist) {
  validateField(accountSubhead && parentAccountType.includes(accountSubhead), "The account type cannot be designated as a sub-account.", errors);
}}












// Validation helpers
function isAlphabets(value) {
  return /^[A-Za-z\s]+$/.test(value);
}

function isFloat(value) {
  return /^-?\d+(\.\d+)?$/.test(value);
}

function isInteger(value) {
  return /^\d+$/.test(value);
}

function isAlphanumeric(value) {
  return /^[A-Za-z0-9]+$/.test(value);
}

