// v1.0

const Organization = require("../database/model/organization");
const Account = require("../database/model/account")
const TrialBalance = require("../database/model/trialBalance")
const Currency = require("../database/model/currency");
const crypto = require('crypto');
const moment = require('moment-timezone');

const key = Buffer.from(process.env.ENCRYPTION_KEY, 'utf8'); 
const iv = Buffer.from(process.env.ENCRYPTION_IV, 'utf8'); 


// Fetch existing data
const dataExist = async (organizationId) => {
  const [ existingOrganization, currencyExists ] = await Promise.all([
    Organization.findOne({ organizationId }),
    Currency.find({ organizationId }, { currencyCode: 1, _id: 0 }),
  ]);
  return { existingOrganization, currencyExists };
};




//Add Account
exports.addAccount = async (req, res) => {
    const startTime = Date.now();
    console.log("Add Account:", req.body);

    try {
      const organizationId = req.user.organizationId;

      const cleanedData = cleanCustomerData(req.body);

      const { existingOrganization, currencyExists } = await dataExist(organizationId);

      //Data Exist Validation
      if (!validateOrganizationTaxCurrency( existingOrganization, currencyExists, res)) return;     
  

     //Validate Inputs  
     if (!validateInputs( cleanedData, organizationId, currencyExists, res )) return;



    const generatedDateTime = generateTimeAndDateForDB(existingOrganization.timeZoneExp, existingOrganization.dateFormatExp, existingOrganization.dateSplit);
    const openingDate = generatedDateTime.dateTime;    
    
  
      // Check if an accounts with the same name already exists
      const existingAccount = await Account.findOne({
        accountName: cleanedData.accountName,
        organizationId: organizationId,
        });  
      if (existingAccount) {
        console.log("Account with the provided Account Name already exists");
        return res.status(409).json({
          message: "Account with the provided Account Name already exists.",
        });        
      }
      

      // Encrypt bankAccNum before storing it
      if(cleanedData.bankAccNum){ cleanedData.bankAccNum = encrypt(cleanedData.bankAccNum); }

      const newAccount = new Account({ ...cleanedData, organizationId, openingDate });      
      await newAccount.save();

      const trialEntry = new TrialBalance({
        organizationId: organizationId,
        operationId: newAccount._id,
        date: openingDate,
        accountId: newAccount._id,
        accountName: newAccount.accountName,
        action: "Opening Balance",
        debitAmount: cleanedData.debitOpeningBalance,
        creditAmount: cleanedData.creditOpeningBalance,
        remark: newAccount.remark,
      });
      await trialEntry.save();
  
      
      res.status(201).json({ message: "Account created successfully." });
      console.log("Account created successfully",newAccount,trialEntry);
    } catch (error) {
      console.error("Error creating Account:", error);
      res.status(500).json({ message: "Internal server error." });
    } 
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    console.log(`Response time: ${responseTime} ms`); 
};


//Edit account
exports.editAccount = async (req, res) => {
  console.log("Edit Account:", req.body);
  try {
    const { accountId } = req.params;
    const organizationId = req.user.organizationId;

    const cleanedData = cleanCustomerData(req.body);

    const { existingOrganization, currencyExists } = await dataExist(organizationId);

    //Data Exist Validation
    if (!validateOrganizationTaxCurrency( existingOrganization, currencyExists, res)) return;     
  

    //Validate Inputs  
    if (!validateInputs( cleanedData, organizationId, currencyExists, res )) return;
     
     

    // Check if an account with the given organizationId and accountId exists
    const account = await Account.findOne({
      _id: accountId,
      organizationId: organizationId,
    });

    if (!account) {
      console.log("Account not found for the provided Account ID");
      return res.status(404).json({
        message:
          "Account not found for the provided Account ID",
      });
    }
    // Encrypt bankAccNum before storing it
    if(cleanedData.bankAccNum){ cleanedData.bankAccNum = encrypt(bankAccNum); }

    // Update account fields
    account.accountName = cleanedData.accountName;
    account.accountCode = cleanedData.accountCode;

    account.accountSubhead = cleanedData.accountSubhead;
    account.accountHead = cleanedData.accountHead;
    account.accountGroup = cleanedData.accountGroup;

    account.description = cleanedData.description;
    account.bankAccNum = cleanedData.bankAccNum;
    account.bankIfsc = cleanedData.bankIfsc;
    account.bankCurrency = cleanedData.bankCurrency;

    // Save updated account
    await account.save();

    res.status(200).json({
      message: "Account updated successfully.",
    });
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

        // Find all accounts where organizationId matches
        const accounts = await Account.find(
          { organizationId: organizationId },{ bankAccNum: 0 } 
      );

    if (!accounts.length) {
      return res.status(404).json({
        message: "No accounts found for the provided organization ID.",
      });
    }

    res.status(200).json(accounts);
  } catch (error) {
    console.error("Error fetching accounts:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};


//Get one Account for a given organizationId
exports.getOneAccount = async (req, res) => {
  try {
    const { accountId } = req.params;
    const organizationId = req.user.organizationId;


    // Find the account by accountId and organizationId
    const account = await Account.findOne({
      _id: accountId,
      organizationId: organizationId,
    });

    if (!account) {
      return res.status(404).json({
        message:
          "Account not found for the provided Organization ID and Account ID.",
      });
    }

    res.status(200).json(account);
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

      const account = await Account.findOne({
          _id: accountId,
          organizationId: organizationId,
      }, 'bankAccNum'); 

      if (!account) {
          return res.status(404).json({
              message: "Account not found for the provided Organization ID and Account ID.",
          });
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
    const account = await Account.findOne({
      _id: accountId,
      organizationId: organizationId,
    });

    if (!account) {
      return res.status(404).json({
        message:
          "Account not found for the provided Organization ID and Account ID.",
      });
    }

    // Delete the account
    await account.delete();

    res.status(200).json({
      message: "Account deleted successfully.",
      deletedAccount: account,
    });
    console.log("Account deleted successfully:", account);
  } catch (error) {
    console.error("Error deleting Account:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};


//Get one Account for a given organizationId
exports.getOneTrailBalance = async (req, res) => {
  try {
      const { accountId } = req.params;
      const organizationId = req.user.organizationId;      

      // Find the TrialBalance by accountId and organizationId
      const trialBalance = await TrialBalance.find({
          accountId: accountId,
          organizationId: organizationId,
      });

      if (!trialBalance) {
          return res.status(404).json({
              message: "Trial Balance not found.",
          });
      }

      res.status(200).json(trialBalance);
  } catch (error) {
      console.error("Error fetching account:", error);
      res.status(500).json({ message: "Internal server error." });
  }
};







//Account Structure
const validStructure = {
  Asset: {
    Asset: [
      "Asset",
      "Current asset",
      "Cash",
      "Bank",
      "Fixed asset",
      "Stock",
      "Payment Clearing",
      "Sundry Debtors",
    ],
    Equity: ["Equity"],
    Income: ["Income", "Other Income"],
  },
  Liability: {
    Liabilities: [
      "Current Liability",
      "Credit Card",
      "Long Term Liability",
      "Other Liability",
      "Overseas Tax Payable",
      "Sundry Creditors",
    ],
    Expenses: ["Expense", "Cost of Goods Sold", "Other Expense"],
  },
};


//Encrpytion 
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


//Decrpytion
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


//Clean Data 
function cleanCustomerData(data) {
  const cleanData = (value) => (value === null || value === undefined || value === "" ? undefined : value);
  return Object.keys(data).reduce((acc, key) => {
    acc[key] = cleanData(data[key]);
    return acc;
  }, {});
}


// Function to generate time and date for storing in the database
function generateTimeAndDateForDB(
  timeZone,
  dateFormat,
  dateSplit,
  baseTime = new Date(),
  timeFormat = "HH:mm:ss",
  timeSplit = ":"
) {
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
  const timeZoneName = localDate.format("z"); // Get time zone abbreviation

  // Combine the formatted date and time with the split characters and time zone
  const dateTime = `${formattedDate} ${formattedTime
    .split(":")
    .join(timeSplit)} (${timeZoneName})`;

  return {
    date: formattedDate,
    time: `${formattedTime} (${timeZoneName})`,
    dateTime: dateTime,
  };
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
  function validateOrganizationTaxCurrency( existingOrganization, currencyExists, res) {
    if (!existingOrganization) {
      res.status(404).json({ message: "Organization not found" });
      return false;
    }
    if (!currencyExists) {
      res.status(404).json({ message: "Currency not found" });
      return false;
    }
    
    return true;
  }





























//Validate inputs
function validateInputs( data,  organizationId, currencyExists, res ) {
  const validCurrencies = currencyExists.map((currency) => currency.currencyCode);
  const validationErrors = validateItemData( data, organizationId, validCurrencies );

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
function validateItemData( data, organizationId, validCurrencies ) {  
  
  const errors = [];

  //Basic Info

  //OtherDetails
  validateReqFields( data, errors);
  validateAccountStructure(data.accountGroup, data.accountHead, data.accountSubhead, errors);


  validateAlphanumericFields(['bankIfsc'], data, errors);
  validateIntegerFields(['bankAccNum'], data, errors);
  //validateFloatFields([''], data, errors);
  //validateAlphabetsFields([''], data, errors);

  //Currency
  validateCurrency(data.bankCurrency, validCurrencies, errors);

  //Tax Details

  return errors;
}






//Valid Req Fields
function validateReqFields( data, errors ) { 
  if (typeof data.accountName === 'undefined' ) {
    errors.push("Account Name required");
  }
  if (typeof data.accountSubhead === 'undefined' ) {
  errors.push(" Account Subhead required");
  }
  if (typeof data.accountHead === 'undefined' ) {
  errors.push("Account Head required");
  }
  if (typeof data.accountGroup === 'undefined' ) {
    errors.push("Account Group required");
  }
  if (typeof data.accountHead === 'undefined' ) {
    errors.push("Account Head required");
  }
  if (typeof data.debitOpeningBalance === 'undefined' && typeof data.creditOpeningBalance === 'undefined') {
    errors.push("Opening Balance required");
  }
  if (typeof data.debitOpeningBalance !== 'undefined' && typeof data.creditOpeningBalance !== 'undefined') {
    errors.push("Select Credit or Debit Opening Balance");
  }

  if (data.accountSubhead === "Bank" && typeof data.bankAccNum === 'undefined' ) {
  errors.push("Bank Account Number required");
  }
  if (data.accountSubhead === "Bank" && typeof data.bankIfsc === 'undefined' ) {
    errors.push("IFSC required");
  }
  if (data.accountSubhead === "Bank" && typeof data.bankCurrency === 'undefined' ) {
    errors.push("Currency required");
  }
}


// Validation function for account structure
function validateAccountStructure(accountGroup, accountHead, accountSubhead, errors) {
  validateField(!validStructure[accountGroup]?.[accountHead]?.includes(accountSubhead) || false,
    "Invalid Account Group, Head, or Subhead.", errors);
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

