
const DefAcc = require("../../database/model/defaultAccount")
const Organization = require("../../database/model/organization")
const Accounts = require("../../database/model/account")
const Tax = require("../../database/model/tax")
const mongoose = require('mongoose');
  





// Fetch existing data
const dataExist = async (organizationId, accountIds) => {
  const [organizationExists, taxExist, accounts, defAccExist] = await Promise.all([
    Organization.findOne({ organizationId }, { organizationId: 1 }),
    Tax.findOne({ organizationId }, { taxType: 1 }),
    Accounts.find({ organizationId, _id: { $in: accountIds } }, { _id: 1 }),
    DefAcc.findOne({ organizationId })
  ]);
  return { organizationExists, taxExist, accounts, defAccExist };
};



  
// Add Default Account
exports.addDefaultAccount = async (req, res) => {
    try {
      const organizationId = req.user.organizationId;

      //Clean Data
      const cleanedData = cleanCustomerData(req.body);

      const {
        salesAccount, purchaseAccount, salesDiscountAccount, purchaseDiscountAccount,
        accountReceivableAccount, accountPayableAccount, outputCgst, outputSgst,
        outputIgst, outputVat, inputCgst, inputSgst, inputIgst, inputVat
      } = cleanedData;
  
      const accountIds = [
        salesAccount, purchaseAccount, salesDiscountAccount, purchaseDiscountAccount,
        accountReceivableAccount, accountPayableAccount, outputCgst, outputSgst, outputIgst,
        outputVat, inputCgst, inputSgst, inputIgst, inputVat
      ].filter(id => id !== undefined);
  
      // Validate account IDs only if there are any valid account IDs
      if (accountIds.length > 0 && !validateAccountID(cleanedData, accountIds, res)) return;




      const { organizationExists, taxExist, accounts, defAccExist } = await dataExist(organizationId, accountIds);
      
      //Data Exist Validation
      if (!validateOrganizationTaxCurrency( organizationExists, taxExist, res )) return;
      

      // Validate accounts only if there are valid account IDs
      const invalidAccounts = accountIds.length > 0 ? validateAccountsExist(accounts, accountIds) : [];
      if (invalidAccounts.length > 0) {
        return res.status(400).json({ message: `Invalid Account IDs: ${invalidAccounts.join(', ')}` });
      }
       
  
      // Create or update default account
    const defaultAccountData = {
      organizationId, salesAccount, purchaseAccount, salesDiscountAccount,
      purchaseDiscountAccount, accountReceivableAccount, accountPayableAccount,
      outputCgst, outputSgst, outputIgst, outputVat, inputCgst, inputSgst, inputIgst, inputVat
    };

    if (defAccExist) {
      // Update existing default account
      await DefAcc.updateOne({ organizationId }, defaultAccountData);
      res.status(200).json({ message: "Default Account updated successfully" });
    } else {
      // Create a new default account
      const newDefaultAccount = new DefAcc(defaultAccountData);
      await newDefaultAccount.save();
      res.status(201).json({ message: "Default Account created successfully" });
    }
  } catch (error) {
    console.error("Error adding Default Account:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
  

// Get Default Account 
exports.getDefaultAccount  = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;

    const defaultAccount = await DefAcc.findOne({organizationId});

    if (defaultAccount) {
      res.status(200).json(defaultAccount);
    } else {
      res.status(404).json({ message: "Default Account not found" });
    }
  } catch (error) {
    console.error("Error fetching Default Account:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};


//Clean Data 
function cleanCustomerData(data) {
  const cleanData = (value) => (value === null || value === undefined || value === "" || value === 0 ? undefined : value);
  return Object.keys(data).reduce((acc, key) => {
    acc[key] = cleanData(data[key]);
    return acc;
  }, {});
}



// Validate Organization Tax 
function validateOrganizationTaxCurrency( organizationExists, taxExist, res ) {
  if (!organizationExists) {
    res.status(404).json({ message: "Organization not found" });
    return false;
  }
  if (!taxExist) {
    res.status(404).json({ message: "Tax not found" });
    return false;
  }
  return true;
}


// Validate Account IDs
function validateAccountID(cleanedData, accountIds, res) {
  
  const idsToValidate = [
    { id: cleanedData.salesAccount, name: 'Sales Account ID' },
    { id: cleanedData.purchaseAccount, name: 'Purchase Account ID' },
    { id: cleanedData.salesDiscountAccount, name: 'Sales Discount Account ID' },
    { id: cleanedData.purchaseDiscountAccount, name: 'Purchase Discount Account ID' },
    { id: cleanedData.accountReceivableAccount, name: 'Account Receivable Account ID' },
    { id: cleanedData.accountPayableAccount, name: 'Account Payable Account ID' },
    { id: cleanedData.outputCgst, name: 'Output CGST Account ID' },
    { id: cleanedData.outputSgst, name: 'Output SGST Account ID' },
    { id: cleanedData.outputIgst, name: 'Output IGST Account ID' },
    { id: cleanedData.outputVat, name: 'Output VAT Account ID' },
    { id: cleanedData.inputCgst, name: 'Input CGST Account ID' },
    { id: cleanedData.inputSgst, name: 'Input SGST Account ID' },
    { id: cleanedData.inputIgst, name: 'Input IGST Account ID' },
    { id: cleanedData.inputVat, name: 'Input VAT Account ID' }
  ].filter(({ id }) => id !== undefined);

  const idErrors = validateAllIds(idsToValidate);
  if (idErrors.length > 0) {
    res.status(400).json({ message: idErrors });
    return false;
  }
  return true;
}

// Function to validate multiple IDs
const validateAllIds = (idList) => {
  return idList
    .map(({ id, name }) => validateId(id, name))
    .filter(Boolean); // Filter out valid IDs
};

// Validate if the ID is a valid MongoDB ObjectId and has 24 characters
const validateId = (id, idName) => {
  if (id === undefined || id === null) {
    return undefined; 
  }
  if (!mongoose.Types.ObjectId.isValid(id) || id.length !== 24) {
    return `${idName} is invalid: ${id}`;
  }
};




// Validate Account IDs
const validateAccountsExist = (accounts, accountIds) => {
  const existingAccountIds = accounts.map(account => account._id.toString());
  const invalidAccounts = accountIds.filter(accountId => !existingAccountIds.includes(accountId));
  
  return invalidAccounts; // Return the list of invalid account IDs
};






