// v1.1

const Organization = require("../database/model/organization");
const Client = require("../database/model/client");
const User = require("../database/model/user");
const Prefix = require("../database/model/prefix");
const Account = require("../database/model/account")
const Currency = require("../database/model/currency")
const Journal = require("../database/model/journal");
const TrialBalance = require("../database/model/trialBalance");
const Setting = require("../database/model/settings");
const PaymentTerms = require("../database/model/paymentTerm");
const Role = require('../database/model/role');
const Tax = require('../database/model/tax');
const bcrypt = require('bcrypt');





// Auto create Roles
const createRolesForOrganization = async (organizationId) => {
  try {
    
    // Check if the roles already exist for the organization
    const existingRoles = await Role.find({ organizationId:organizationId });
    
    if (existingRoles.length > 0) {
      console.log("Roles already exist for this organization.");
      return { success: true, message: "Roles already exist for this organization." };
    }

    // Create admin and staff roles
    const roles = [
      {
        organizationId,
        description: 'Admin',
        roleName: 'Admin',
        permissions: [
          
          
          // Organization Module
          { action: "OrganizationView", note: "Viewed Organization Details" },
          { action: "OrganizationSetup", note: "Setup/Modified Organization Details" },

          // Organization Module - Setting
          { action: "SettingView", note: "Viewed Setting details" },
          
          // Organization Module - Currency
          { action: "CurrencyView", note: "Viewed Currency Details" },
          { action: "CurrencyAdd", note: "Added a new Currency" },
          { action: "CurrencyEdit", note: "Edited Currency Information" },
          { action: "CurrencyDelete", note: "Deleted a Currency" },

          // Organization Module - Invoice(Settings)          
          { action: "InvoiceAdd", note: "Setup/Modified Invoice Setting" },

          // Organization Module - Payment Terms        
          { action: "PaymentTermAdd", note: "Added Payment Term" },
          { action: "PaymentTermEdit", note: "Edited Payment Term" },
          { action: "PaymentTermDelete", note: "Deleted Payment Term" },
          { action: "PaymentTermView", note: "Viewed Payment Term" },

          // Organization Module - Tax 
          { action: "TaxAdd", note: "Added Tax Information" },
          { action: "TaxEdit", note: "Edited Tax Information" },
          { action: "TaxView", note: "Viewed Tax Information" },

          // Organization Module - Prefix 
          { action: "PrefixAdd", note: "Added Prefix" },
          { action: "PrefixView", note: "Viewed Prefix" },
          { action: "PrefixEdit", note: "Edited Prefix" },
          { action: "PrefixDelete", note: "Deleted Prefix" },
          { action: "PrefixStatus", note: "Modified Prefix Status" },

          // Customers Module
          { action: "CustomersCreate", note: "Created a New Customer" },
          { action: "CustomersView", note: "Viewed Customer details" },          
          { action: "CustomersEdit", note: "Edited Customer information" },
          { action: "CustomersStatus", note: "Modified Customer Status" },
          { action: "CustomerImport", note: "Imported New Customers" },


          // Accounts Module
          { action: "AccountNumber", note: "Viewed Account Number" },
          { action: "AccountAdd", note: "Created a New Account" },          
          { action: "AccountView", note: "Viewed Account Information" },
          { action: "AccountEdit", note: "Edited Account Information" },
          { action: "AccountDelete", note: "Deleted an Account" },
          
          { action: "JournalAdd", note: "Added a Journal Entry" },
          { action: "JournalView", note: "Viewed Journal Entry" },


          // Inventory Module
          { action: "ItemAdd", note: "Created a New Item" },
          { action: "ItemView", note: "Viewed Item Information" },          
          { action: "ItemEdit", note: "Edited Item Information" },
          { action: "ItemDelete", note: "Deleted an Item" },

          // Inventory Module - Unit
          { action: "UnitAdd", note: "Created a New Unit" },
          { action: "UnitView", note: "Viewed Unit Information" },          
          { action: "UnitEdit", note: "Edited Unit Information" },
          { action: "UnitDelete", note: "Deleted a Unit" },

          // Inventory Module - BMCR
          { action: "BMCRAdd", note: "Created a New BMCR" },
          { action: "BMCRView", note: "Viewed BMCR Information" },          
          { action: "BMCREdit", note: "Edited BMCR Information" },
          { action: "BMCRDelete", note: "Deleted a BMCR" },

           // Inventory Module - Item(Settings)          
           { action: "ItemSetting", note: "Setup/Modified Item Setting" },

           //Supplier Module
          { action: "SupplierCreate", note: "Created a New Supplier" },
          { action: "SupplierView", note: "Viewed Supplier Details" },
          { action: "SupplierEdit", note: "Edited Supplier Information" },
          { action: "SupplierStatus", note: "Modified Supplier Status" },
          { action: "SupplierImport", note: "Import New Suppliers" },
    
          
        ],
      },
    ];
    

    await Role.insertMany(roles);
    console.log("Roles created successfully for organization:", organizationId);
    return { success: true, message: "Roles created successfully." };

  } catch (error) {
    console.error("Error creating roles:", error);
    return { success: false, message: "Failed to create roles." };
  }
};





// Auto create Currency
const createCurrencyForOrganization = async (organizationId) => {
  try {
    
    // Check if the Currency already exist for the organization
    const existingCurrency = await Currency.find({ organizationId:organizationId });
    
    if (existingCurrency.length > 0) {
      console.log("Currency already exist for this organization.");
      return { success: true, message: "Currency already exist for this organization." };
    }

    // Create Currency 
    const currencies = [
      { organizationId, currencyCode: 'AED',currencySymbol: 'AED',currencyName: 'UAE Dirham',decimalPlaces: '2',format: '1,234,567.89',baseCurrency:false},
      { organizationId, currencyCode: 'SAR',currencySymbol: 'SAR',currencyName: 'Saudi Riyal',decimalPlaces: '2',format: '1,234,567.89',baseCurrency:false},
      { organizationId, currencyCode: 'QAR',currencySymbol: 'QAR',currencyName: 'Qatari Riyal',decimalPlaces: '2',format: '1,234,567.89',baseCurrency:false},
      { organizationId, currencyCode: 'BHD',currencySymbol: 'BHD',currencyName: 'Bahraini Dinar',decimalPlaces: '2',format: '1,234,567.89',baseCurrency:false},
      { organizationId, currencyCode: 'OMR',currencySymbol: 'OMR',currencyName: 'Omani Rial',decimalPlaces: '2',format: '1,234,567.89',baseCurrency:false},
      // { organizationId, currencyCode: 'AUD',currencySymbol: '$',currencyName: 'Australian Dollar',decimalPlaces: '2',format: '1,234,567.89',baseCurrency:false},
      // { organizationId, currencyCode: 'CAD',currencySymbol: '$',currencyName: 'Canadian Dollar',decimalPlaces: '2',format: '1,234,567.89',baseCurrency:false},
      // { organizationId, currencyCode: 'CNY',currencySymbol: 'CNY',currencyName: 'Yuan Renminbi',decimalPlaces: '2',format: '1,234,567.89',baseCurrency:false},
      // { organizationId, currencyCode: 'EUR',currencySymbol: '€',currencyName: 'Euro',decimalPlaces: '2',format: '1,234,567.89',baseCurrency:false},
      // { organizationId, currencyCode: 'GBP',currencySymbol: '£',currencyName: 'Pound Sterling',decimalPlaces: '2',format: '1,234,567.89',baseCurrency:false},
      { organizationId, currencyCode: 'INR',currencySymbol: '₹',currencyName: 'Indian Rupee',decimalPlaces: '2',format: '1,234,567.89',baseCurrency:false},
      // { organizationId, currencyCode: 'JPY',currencySymbol: '¥',currencyName: 'Japanese Yen',decimalPlaces: '2',format: '1,234,567.89',baseCurrency:false},
      // { organizationId, currencyCode: 'SAR',currencySymbol: 'SAR',currencyName: 'Saudi Riyal',decimalPlaces: '2',format: '1,234,567.89',baseCurrency:false},
      // { organizationId, currencyCode: 'USD',currencySymbol: '$',currencyName: 'United States Dollar',decimalPlaces: '2',format: '1,234,567.89',baseCurrency:false},
      // { organizationId, currencyCode: 'ZAR',currencySymbol: 'R',currencyName: 'South African Rand',decimalPlaces: '2',format: '1,234,567.89',baseCurrency:false}
            
    ];

    await Currency.insertMany(currencies);
    console.log("Currency created successfully for organization:", organizationId);
    return { success: true, message: "Currency created successfully." };

  } catch (error) {
    console.error("Error creating roles:", error);
    return { success: false, message: "Failed to create roles." };
  }
};





//Auto create Payment terms
const createPaymentTermForOrganization = async (organizationId) => {
  try {
    
    // Check if the Payment terms already exist for the organization
    const existingPaymentTerm = await PaymentTerms.find({ organizationId:organizationId });
    
    if (existingPaymentTerm.length > 0) {
      console.log("Payment Terms already exist for this organization.");
      return { success: true, message: "Payment Terms already exist for this organization." };
    }

    // Create Payment terms
    const paymentTerm = [
      { organizationId, name: 'Pay Now',description:"Payment is doing right now"},
      { organizationId, name: 'Due on Receipt',description:"Payment is required immediately after receiving the invoice"},
      { organizationId, name: 'Due end of the month',description:"Payment is due by the last day of the month in which the invoice is issued"},
      { organizationId, name: 'Due end of next month',description:"Payment is due by the last day of the next month in which the invoice is issued"},
      { organizationId, name: 'Net 15',days: '15',description:"Payment is due within 15 days from the invoice "},
      { organizationId, name: 'Net 30',days: '30',description:"Payment is due within 30 days from the invoice "},
      { organizationId, name: 'Net 45',days: '45',description:"Payment is due within 45 days from the invoice "},
      { organizationId, name: 'Net 60',days: '60',description:"Payment is due within 60 days from the invoice "},
                  
    ];

    await PaymentTerms.insertMany(paymentTerm);
    console.log("Payment Terms created successfully for organization:", organizationId);
    return { success: true, message: "Payment Terms created successfully." };

  } catch (error) {
    console.error("Error creating roles:", error);
    return { success: false, message: "Failed to create roles." };
  }
};





//Auto create Prefix 
const createPrefixForOrganization = async (organizationId) => {
  try {
    
    // Check if the Prefix already exist for the organization
    const existingPrefix = await Prefix.find({ organizationId:organizationId });
    
    if (existingPrefix.length > 0) {
      console.log("Prefix already exist for this organization.");
      return { success: true, message: "Prefix already exist for this organization." };
    }

    // Create Prefix
    const prefix = [
      { organizationId, series: [{
        seriesName: 'Default Series',
        status:true,
        journal:"JN-",journalNum:1,        
        creditNote: "CN-",creditNoteNum: 1,        
        customerPayment: 'CP-',customerPaymentNum: 1,
        purchaseOrder: "PO-",purchaseOrderNum: 1,        
        salesOrder: "SO-",salesOrderNum: 1,
        vendorPayment: "VP-",vendorPaymentNum: 1,
        retainerInvoice: "RET-",retainerInvoiceNum: 1,
        vendorCredits: "DN-",vendorCreditsNum: 1,
        billOfSupply: "BOS-",billOfSupplyNum: 1,
        debitNote: "CDN-",debitNoteNum: 1,
        invoice:"INV-",invoiceNum: 1,
        quote: "QT-",quoteNum: 1,        
        deliveryChallan: "DC-",deliveryChallanNum: 1,  }]},            
    ];

    await Prefix.insertMany(prefix);
    console.log("Prefix created successfully for organization:", organizationId);
    return { success: true, message: "Prefix created successfully." };

  } catch (error) {
    console.error("Error creating roles:", error);
    return { success: false, message: "Failed to create roles." };
  }
};





//Auto create Tax 
const createTaxForOrganization = async (organizationId) => {
  try {
    
    // Check if the tax already exist for the organization
    const existingTax = await Tax.find({ organizationId:organizationId });
    
    if (existingTax.length > 0) {
      console.log("Tax already exist for this organization.");
      return { success: true, message: "Tax already exist for this organization." };
    }

    // Create Tax
    const tax = [
      { organizationId,taxType:"",gstTaxRate:[
        {taxName: "GST0",taxRate:0,cgst:0,sgst:0,igst:0},
        {taxName: "GST5",taxRate:5,cgst:2.5,sgst:2.5,igst:5},
        {taxName: "GST12",taxRate:12,cgst:6,sgst:6,igst:12},
        {taxName: "GST18",taxRate:18,cgst:9,sgst:9,igst:18},
        {taxName: "GST28",taxRate:28,cgst:14,sgst:14,igst:28},],
        vatTaxRate:[
          {taxName: "VAT0",taxRate:0,},
          {taxName: "VAT5",taxRate:5,},
          {taxName: "VAT10",taxRate:10,},
          {taxName: "VAT15",taxRate:15,},
          {taxName: "VAT20",taxRate:20,},
        ]    
    }];

    await Tax.insertMany(tax);
    console.log("Tax created successfully for organization:", organizationId);
    return { success: true, message: "Tax created successfully." };

  } catch (error) {
    console.error("Error creating roles:", error);
    return { success: false, message: "Failed to create tax." };
  }
};






// Auto create Accounts
const createAccountsForOrganization = async (organizationId) => {
  try {
    
    insertAccounts(accounts, organizationId, createdDateAndTime);
    
  
    console.log("Accounts created successfully for organization:", organizationId);
    return { success: true, message: "Accounts created successfully." };

  } catch (error) {
    console.error("Error creating roles:", error);
    return { success: false, message: "Failed to create tax." };
  }
};












// Auto create Settings
const createSettingsOrganization = async (organizationId) => {
  try {
    
    // Check if the Settings already exist for the organization
    const existingSettings = await Setting.find({ organizationId:organizationId });
    
    if (existingSettings.length > 0) {
      console.log("Settings already exist for this organization.");
      return { success: true, message: "Settings already exist for this organization." };
    }

    // Create settings
    const settings = [
      {organizationId,
      //Item
      itemDuplicateName:false, hsnSac:false, 
      priceList:false, priceListAtLineLevel:false, 
      compositeItem:false, stockBelowZero:false,
      OutOfStockBelowZero :false, notifyReorderPoint:false, 
      trackCostOnItems:false,

      //Customer
      duplicateCustomerMobile:false, duplicateCustomerEmail:false, 
      duplicateCustomerDisplayName:false,
      
      //Supplier
      duplicateSupplierDisplayName:false, duplicateSupplierEmail:false, 
      duplicateSupplierMobile:false, 

      //Sales Order
      salesOrderAddress: false, salesOrderCustomerNote: false,
      salesOrderTermsCondition: false, salesOrderClose: 'invoice', 
      restrictSalesOrderClose: false,

      //Shipment
      carrierNotification: false, manualNotification: false,

      //Invoice
      invoiceEdit: false, displayExpenseReceipt: false,
      paymentReceipt: false, invoiceQrCode: false, 

      //Credit Note
      overideCostPrice: false, creditNoteQr: false,
      recordLocking: false,
      

    }];

    await Setting.insertMany(settings);
    console.log("Settings created successfully for organization:", organizationId);
    return { success: true, message: "Settings created successfully." };

  } catch (error) {
    console.error("Error creating roles:", error);
    return { success: false, message: "Failed to create tax." };
  }
};







// Create New Client, Organization, Prefix, Role
exports.createOrganizationAndClient = async (req, res) => {
  console.log("Create Organization and Client:", req.body);
  try {
    const {
      organizationName,
      contactName,
      contactNum,
      email,
      password,
      // Add other fields as needed
    } = req.body;

    // Check if an organization with the same organizationName already exists
    const existingOrganization = await Organization.findOne({ organizationName });

    if (existingOrganization) {
      return res.status(409).json({
        message: "Organization with the provided name already exists.",
      });
    }

    const clientExists = await Client.findOne({
      email:email,
    });
    if (clientExists) {
      return res.status(404).json({
        message: "Client Exists",
      });
    }
    

    // Count existing organizations to generate the next organizationId
    const organizationCount = await Organization.countDocuments({});
    const nextIdNumber = organizationCount + 1;
    const organizationId = `INDORG${nextIdNumber.toString().padStart(4, '0')}`;

    // Create a new organization
    const newOrganization = new Organization({
      organizationId,
      organizationName,
      primaryContactName: contactName,
      primaryContactNum: contactNum,
    });

    let savedOrganization = await newOrganization.save();

    if (!savedOrganization) {
      console.error("Organization could not be saved.");
      return res.status(500).json({ message: "Failed to create organization." });
    }

    // Create roles for the organization
    const roleCreationResult = await createRolesForOrganization(organizationId);
    if (!roleCreationResult.success) {
      return res.status(500).json({ message: roleCreationResult.message });
    }

    // Create Currency for the organization
    const currencyCreationResult = await createCurrencyForOrganization(organizationId);
    if (!currencyCreationResult.success) {
      return res.status(500).json({ message: currencyCreationResult.message });
    }

    // Create Payment Term for the organization
    const paymentTermCreationResult = await createPaymentTermForOrganization(organizationId);
    if (!paymentTermCreationResult.success) {
      return res.status(500).json({ message: paymentTermCreationResult.message });
    }
    
    
    // Create Settings for the organization
    const settingsCreationResult = await createSettingsOrganization(organizationId);
    if (!settingsCreationResult.success) {
      return res.status(500).json({ message: settingsCreationResult.message });
    }
    

    // Create Tax for the organization
    const taxCreationResult = await createTaxForOrganization(organizationId);
    if (!taxCreationResult.success) {
      return res.status(500).json({ message: taxCreationResult.message });
    }

    // Create Accounts for the organization
    const accountsCreationResult = await createAccountsForOrganization(organizationId);
    if (!accountsCreationResult.success) {
      return res.status(500).json({ message: accountsCreationResult.message });
    }

    // Hash the password before saving
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create a new client
    const newClient = new Client({
      organizationName,
      organizationId,
      contactName,
      contactNum,
      email,
      // Add other fields as needed
    });

    const savedClient = await newClient.save();

    if (!savedClient) {
      console.error("Client could not be saved.");
      return res.status(500).json({ message: "Failed to create client." });
    }

    // Create a new user
    const newUser = new User({
      organizationName,
      organizationId,
      userName: contactName,
      userNum: contactNum,
      userEmail: email,
      password: hashedPassword,
      role: 'Admin',
      // Add other fields as needed
    });

    const savedUser = await newUser.save();

    if (!savedUser) {
      console.error("User could not be saved.");
      return res.status(500).json({ message: "Failed to create user." });
    }


    // Create Prefix for the organization
    const prefixCreationResult = await createPrefixForOrganization(organizationId);
    if (!prefixCreationResult.success) {
      return res.status(500).json({ message: prefixCreationResult.message });
    }    

    res.status(201).json({
      message: "Client created successfully.",
      organizationId: organizationId,
    });
    console.log("Organization, Client, User, Prefix, Currency, Role created successfully:", { organizationId });
  } catch (error) {
    console.error("Error creating Organization, Client, and User:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};



// Get all Client
exports.getAllClient = async (req, res) => {
  try {
    const allClient = await Client.find();

    if (allClient.length > 0) {
      res.status(200).json(allClient);
    } else {
      res.status(404).json("No Client found");
    }
  } catch (error) {
    console.error(error);
    res.status(500).json("Internal server error");
  }
};



// Flush DB
exports.deleteAll = async (req, res) => {
  try {
    await Organization.deleteMany({});
    console.log("Organization data deleted.");

    await Client.deleteMany({});
    console.log("Client data deleted.");

    await User.deleteMany({});
    console.log("User data deleted.");

    await Prefix.deleteMany({});
    console.log("Prefix data deleted.");

    await Account.deleteMany({});
    console.log("Account data deleted.");

    await Journal.deleteMany({});
    console.log("Journal data deleted.");

    await TrialBalance.deleteMany({});
    console.log("Trial Balance data deleted.");

    await Role.deleteMany({});
    console.log("Role data deleted.");

    await Currency.deleteMany({});
    console.log("Currency data deleted.");

    await PaymentTerms.deleteMany({});
    console.log("Payment Terms data deleted.");

    await Setting.deleteMany({});
    console.log("Payment Terms data deleted.");

    await Tax.deleteMany({});
    console.log("Tax data deleted.");


    res.status(200).json("Database Flushed Successfully");

  } catch (error) {
    console.error(error);
    res.status(500).json("Internal server error");
  }
};


















































async function insertAccounts(accounts,organizationId,createdDateAndTime) {

  const accountDocuments = accounts.map(account => {
      return {
          organizationId: organizationId, 
          accountName: account.accountName,
          accountCode: account.accountCode, 

          accountSubhead: account.accountSubhead,
          accountHead: account.accountHead,
          accountGroup: account.accountGroup,

          openingDate: createdDateAndTime, 
          description: account.description
      };});

    try {
        const autoAccountCreation = await Account.insertMany(accountDocuments);
        console.log('Accounts created successfully');

         // Loop through the created accounts and add a trial balance entry for each one
  for (const savedAccount of autoAccountCreation) {
    const debitOpeningBalance = undefined;  
    const creditOpeningBalance = undefined; 


    const newTrialEntry = new TrialBalance({
        organizationId,
        operationId: savedAccount._id,
        date: savedAccount.openingDate,
        accountId: savedAccount._id,
        accountName: savedAccount.accountName,
        action: "Opening Balance",
        debitAmount: debitOpeningBalance,
        creditAmount: creditOpeningBalance,
        remark: 'Opening Balance'
    });

    await newTrialEntry.save();
}

console.log('Trial balance entries created successfully');
        
        
        
    } catch (error) {
        console.error('Error inserting accounts:', error);
    }
}


const accounts = [
  { accountName: "Advance Tax", accountSubhead: "Current Asset", accountHead: "Asset", accountGroup: "Asset",accountCode:"AC-01",description: "Any tax which is paid in advance is recorded into the advance tax account. This advance tax payment could be a quarterly, half yearly or yearly payment." },
  { accountName: "Employee Advance", accountSubhead: "Current Asset", accountHead: "Asset", accountGroup: "Asset",accountCode:"AC-02",description: "Money paid out to an employee in advance can be tracked here till it's repaid or shown to be spent for company purposes." },
  { accountName: "Prepaid Expense", accountSubhead: "Current Asset", accountHead: "Asset", accountGroup: "Asset",accountCode:"AC-03",description: "An asset account that reports amounts paid in advance while purchasing goods or services from a vendor." },
  { accountName: "TDS Receivable", accountSubhead: "Current Asset", accountHead: "Asset", accountGroup: "Asset",accountCode:"AC-04" ,description: "TDS Receivable."},
  { accountName: "Sales to Customers (Cash)", accountSubhead: "Current Asset", accountHead: "Asset", accountGroup: "Asset",accountCode:"AC-05",description: "Sales to Customers (Cash)." },
  { accountName: "Reverse Charge Tax Input but not due", accountSubhead: "Current Asset", accountHead: "Asset", accountGroup: "Asset",accountCode:"AC-06",description: "The amount of tax payable for your reverse charge purchases can be tracked here." },
  
  { accountName: "Accounts Receivable", accountSubhead: "Accounts Receivable", accountHead: "Asset", accountGroup: "Asset",accountCode:"AC-07",description: "The money that customers owe you becomes the accounts receivable. A good example of this is a payment expected from an invoice sent to your customer." },
  
  { accountName: "Inventory Asset", accountSubhead: "Stock", accountHead: "Asset", accountGroup: "Asset",accountCode:"AC-08",description: "An account which tracks the value of goods in your inventory.." },
  
  { accountName: "Petty Cash", accountSubhead: "Cash", accountHead: "Asset", accountGroup: "Asset",accountCode:"AC-09",description: "It is a small amount of cash that is used to pay your minor or casual expenses rather than writing a check." },
  { accountName: "Undeposited Funds", accountSubhead: "Cash", accountHead: "Asset", accountGroup: "Asset",accountCode:"AC-10" ,description: "Record funds received by your company yet to be deposited in a bank as undeposited funds and group them as a current asset in your balance sheet."},

  { accountName: "Capital Stock", accountSubhead: "Equity", accountHead: "Equity", accountGroup: "Asset",accountCode:"AC-11" ,description: "An equity account that tracks the capital introduced when a business is operated through a company or corporation."},
  { accountName: "Distribution", accountSubhead: "Equity", accountHead: "Equity", accountGroup: "Asset",accountCode:"AC-12",description: "An equity account that tracks the payment of stock, cash or physical products to its shareholders." },
  { accountName: "Dividends Paid", accountSubhead: "Equity", accountHead: "Equity", accountGroup: "Asset",accountCode:"AC-13",description: "An equity account to track the dividends paid when a corporation declares dividend on its common stock." },
  { accountName: "Drawings", accountSubhead: "Equity", accountHead: "Equity", accountGroup: "Asset",accountCode:"AC-14",description: "The money withdrawn from a business by its owner can be tracked with this account." },
  { accountName: "Investments", accountSubhead: "Equity", accountHead: "Equity", accountGroup: "Asset",accountCode:"AC-15" ,description: "An equity account used to track the amount that you invest."},
  { accountName: "Opening Balance Offset", accountSubhead: "Equity", accountHead: "Equity", accountGroup: "Asset",accountCode:"AC-16",description: "This is an account where you can record the balance from your previous years earning or the amount set aside for some activities. It is like a buffer account for your funds." },
  { accountName: "Owner's Equity", accountSubhead: "Equity", accountHead: "Equity", accountGroup: "Asset",accountCode:"AC-17",description: "The owners rights to the assets of a company can be quantified in the owner''s equity account." },

  
  { accountName: "General Income", accountSubhead: "Income", accountHead: "Income", accountGroup: "Asset",accountCode:"AC-18",description: "A general category of account where you can record any income which cannot be recorded into any other category." },
  { accountName: "Interest Income", accountSubhead: "Income", accountHead: "Income", accountGroup: "Asset",accountCode:"AC-19",description: "A percentage of your balances and deposits are given as interest to you by your banks and financial institutions. This interest is recorded into the interest income account." },
  { accountName: "Sales", accountSubhead: "Income", accountHead: "Income", accountGroup: "Asset",accountCode:"AC-20",description: "The income from the sales in your business is recorded under the sales account."},
  { accountName: "Other Charges", accountSubhead: "Income", accountHead: "Income", accountGroup: "Asset",accountCode:"AC-21",description: "Miscellaneous charges like adjustments made to the invoice can be recorded in this account."},
  { accountName: "Shipping Charge", accountSubhead: "Income", accountHead: "Income", accountGroup: "Asset",accountCode:"AC-22",description: "Shipping charges made to the invoice will be recorded in this account."},
  { accountName: "Late Fee Income", accountSubhead: "Income", accountHead: "Income", accountGroup: "Asset",accountCode:"AC-23",description: "Any late fee income is recorded into the late fee income account. The late fee is levied when the payment for an invoice is not received by the due date."},
  { accountName: "Discount", accountSubhead: "Income", accountHead: "Income", accountGroup: "Asset",accountCode:"AC-24",description: "Any reduction on your selling price as a discount can be recorded into the discount account."},
  
  { accountName: "Employee Reimbursements", accountSubhead: "Current Liability", accountHead: "Liabilities", accountGroup: "Liability",accountCode:"AC-25",description: "This account can be used to track the reimbursements that are due to be paid out to employees." },
  { accountName: "TDS Payable", accountSubhead: "Current Liability", accountHead: "Liabilities", accountGroup: "Liability",accountCode:"AC-26",description: "TDS Payable" },
  
  { accountName: "Accounts Payable", accountSubhead: "Accounts Payable", accountHead: "Liabilities", accountGroup: "Liability",accountCode:"AC-27",description: "This is an account of all the money which you owe to others like a pending bill payment to a vendor,etc." },
  
  { accountName: "Construction Loan", accountSubhead: "Long Term Liability", accountHead: "Liabilities", accountGroup: "Liability",accountCode:"AC-28",description: "An expense account that tracks the amount you repay for construction loans." },
  { accountName: "Mortgages", accountSubhead: "Long Term Liability", accountHead: "Liabilities", accountGroup: "Liability",accountCode:"AC-29" ,description: "An expense account that tracks the amounts you pay for the mortgage loan."},
  
  { accountName: "Opening Balance Adjustments", accountSubhead: "Other Liability", accountHead: "Liabilities", accountGroup: "Liability",accountCode:"AC-30" ,description: "This account will hold the difference in the debits and credits entered during the opening balance."},
  { accountName: "Unearned Revenue", accountSubhead: "Other Liability", accountHead: "Liabilities", accountGroup: "Liability",accountCode:"AC-31" ,description: "A liability account that reports amounts received in advance of providing goods or services. When the goods or services are provided, this account balance is decreased and a revenue account is increased."},
  { accountName: "Tax Payable", accountSubhead: "Other Liability", accountHead: "Liabilities", accountGroup: "Liability",accountCode:"AC-32" ,description: "The amount of money which you owe to your tax authority is recorded under the tax payable account. This amount is a sum of your outstanding in taxes and the tax charged on sales."},
  { accountName: "Accounts Payable", accountSubhead: "Other Liability", accountHead: "Liabilities", accountGroup: "Liability",accountCode:"AC-33" ,description: "This is an account of all the money which you owe to others like a pending bill payment to a vendor,etc."},
  { accountName: "Dimension Adjustments", accountSubhead: "Other Liability", accountHead: "Liabilities", accountGroup: "Liability",accountCode:"AC-34" ,description: "This adjustment account tracks the transfers between different dimensions like tags, branches."},
  
  { accountName: "Advertising and Marketing", accountSubhead: "Expense", accountHead: "Expenses", accountGroup: "Liability",accountCode:"AC-35",description: "Your expenses on promotional, marketing and advertising activities like banners, web-adds, trade shows, etc. are recorded in advertising and marketing account." },
  { accountName: "Automobile Expense", accountSubhead: "Expense", accountHead: "Expenses", accountGroup: "Liability",accountCode:"AC-36" ,description: "Transportation related expenses like fuel charges and maintenance charges for automobiles, are included to the automobile expense account."},
  { accountName: "Bad Debt", accountSubhead: "Expense", accountHead: "Expenses", accountGroup: "Liability",accountCode:"AC-37" ,description: "Any amount which is lost and is unrecoverable is recorded into the bad debt account."},
  { accountName: "Bank Fees and Charges", accountSubhead: "Expense", accountHead: "Expenses", accountGroup: "Liability",accountCode:"AC-38" ,description: "Any bank fees levied is recorded into the bank fees and charges account. A bank account maintenance fee, transaction charges, a late payment fee are some examples."},
  { accountName: "Consultant Expense", accountSubhead: "Expense", accountHead: "Expenses", accountGroup: "Liability",accountCode:"AC-39" ,description: "Charges for availing the services of a consultant is recorded as a consultant expenses. The fees paid to a soft skills consultant to impart personality development training for your employees is a good example."},
  { accountName: "Contract Assets", accountSubhead: "Expense", accountHead: "Expenses", accountGroup: "Liability",accountCode:"AC-40" ,description: " An asset account to track the amount that you receive from your customers while you're yet to complete rendering the services."},
  { accountName: "Credit Card Charges", accountSubhead: "Expense", accountHead: "Expenses", accountGroup: "Liability",accountCode:"AC-41" ,description: " Service fees for transactions , balance transfer fees, annual credit fees and other charges levied on a credit card are recorded into the credit card account."},
  { accountName: "Depreciation and Amortisation", accountSubhead: "Expense", accountHead: "Expenses", accountGroup: "Liability",accountCode:"AC-42",description: "An expense account that is used to track the depreciation of tangible assets and intangible assets, which is amortization." },
  { accountName: "Depreciation Expense", accountSubhead: "Expense", accountHead: "Expenses", accountGroup: "Liability",accountCode:"AC-43",description: "Any depreciation in value of your assets can be captured as a depreciation expense." },
  { accountName: "Fuel/Mileage Expenses", accountSubhead: "Expense", accountHead: "Expenses", accountGroup: "Liability",accountCode:"AC-44",description: "Fuel/Mileage Expenses" },
  { accountName: "IT and Internet Expense", accountSubhead: "Expense", accountHead: "Expenses", accountGroup: "Liability",accountCode:"AC-45",description: "Money spent on your IT infrastructure and usage like internet connection, purchasing computer equipment etc is recorded as an IT and Computer Expense." },
  { accountName: "Janitorial Expense", accountSubhead: "Expense", accountHead: "Expenses", accountGroup: "Liability",accountCode:"AC-46" ,description: "All your janitorial and cleaning expenses are recorded into the janitorial expenses account."},
  { accountName: "Lodging", accountSubhead: "Expense", accountHead: "Expenses", accountGroup: "Liability",accountCode:"AC-47" ,description: "Any expense related to putting up at motels etc while on business travel can be entered here."},
  { accountName: "Meals and Entertainment", accountSubhead: "Expense", accountHead: "Expenses", accountGroup: "Liability",accountCode:"AC-48",description: "Expenses on food and entertainment are recorded into this account." },
  { accountName: "Merchandise", accountSubhead: "Expense", accountHead: "Expenses", accountGroup: "Liability",accountCode:"AC-49" ,description: "An expense account to track the amount spent on purchasing merchandise."},
  { accountName: "Office Supplies", accountSubhead: "Expense", accountHead: "Expenses", accountGroup: "Liability",accountCode:"AC-50",description: "All expenses on purchasing office supplies like stationery are recorded into the office supplies account." },
  { accountName: "Other Expenses", accountSubhead: "Expense", accountHead: "Expenses", accountGroup: "Liability",accountCode:"AC-51",description: "Any minor expense on activities unrelated to primary business operations is recorded under the other expense account." },
  { accountName: "Postage", accountSubhead: "Expense", accountHead: "Expenses", accountGroup: "Liability" ,accountCode:"AC-52",description: "Your expenses on ground mails, shipping and air mails can be recorded under the postage account."},
  { accountName: "Printing and Stationary", accountSubhead: "Expense", accountHead: "Expenses", accountGroup: "Liability",accountCode:"AC-53",description: "Expenses incurred by the organization towards printing and stationery." },
  { accountName: "Parking", accountSubhead: "Expense", accountHead: "Expenses", accountGroup: "Liability",accountCode:"AC-54",description: "The parking fares you pay while on business trips can be recorded under this expense category." },
  { accountName: "Purchase Discounts", accountSubhead: "Expense", accountHead: "Expenses", accountGroup: "Liability",accountCode:"AC-55",description: "Tracks any reduction that your vendor offers on your purchases. Some vendors also provide them to encourage quick payment settlement." },
  { accountName: "Raw Material and Consumables", accountSubhead: "Expense", accountHead: "Expenses", accountGroup: "Liability",accountCode:"AC-56" ,description: "An expense account to track the amount spent on purchasing raw materials and consumables."},
  { accountName: "Rent Expense", accountSubhead: "Expense", accountHead: "Expenses", accountGroup: "Liability",accountCode:"AC-57",description: "The rent paid for your office or any space related to your business can be recorded as a rental expense." },
  { accountName: "Repairs and Maintenance", accountSubhead: "Expense", accountHead: "Expenses", accountGroup: "Liability",accountCode:"AC-58",description: "The costs involved in maintenance and repair of assets is recorded under this account." },
  { accountName: "Telephone Expense", accountSubhead: "Expense", accountHead: "Expenses", accountGroup: "Liability",accountCode:"AC-59",description: "The expenses on your telephone, mobile and fax usage are accounted as telephone expenses." },
  { accountName: "Transportation Expense", accountSubhead: "Expense", accountHead: "Expenses", accountGroup: "Liability",accountCode:"AC-60" ,description: "An expense account to track the amount spent on transporting goods or providing services."},
  { accountName: "Travel Expense", accountSubhead: "Expense", accountHead: "Expenses", accountGroup: "Liability",accountCode:"AC-61",description: "Expenses on business travels like hotel bookings, flight charges, etc. are recorded as travel expenses." },
  { accountName: "Uncategorized", accountSubhead: "Expense", accountHead: "Expenses", accountGroup: "Liability",accountCode:"AC-62",description: "This account can be used to temporarily track expenses that are yet to be identified and classified into a particular category." },
  { accountName: "Salaries and Employee Wages", accountSubhead: "Expense", accountHead: "Expenses", accountGroup: "Liability",accountCode:"AC-63",description: "Salaries for your employees and the wages paid to workers are recorded under the salaries and wages account." },
  
  { accountName: "Cost of Goods Sold", accountSubhead: "Cost of Goods Sold", accountHead: "Expenses", accountGroup: "Liability",accountCode:"AC-64" ,description: "An expense account which tracks the value of the goods sold."},
  { accountName: "Exchange Gain or Loss", accountSubhead: "Cost of Goods Sold", accountHead: "Expenses", accountGroup: "Liability",accountCode:"AC-65" ,description: "Changing the conversion rate can result in a gain or a loss. You can record this into the exchange gain or loss account."},
  { accountName: "Job Costing", accountSubhead: "Cost of Goods Sold", accountHead: "Expenses", accountGroup: "Liability" ,accountCode:"AC-66",description: "An expense account to track the costs that you incur in performing a job or a task."},
  { accountName: "Labor", accountSubhead: "Cost of Goods Sold", accountHead: "Expenses", accountGroup: "Liability",accountCode:"AC-67",description: " An expense account that tracks the amount that you pay as labor." },
  { accountName: "Materials", accountSubhead: "Cost of Goods Sold", accountHead: "Expenses", accountGroup: "Liability",accountCode:"AC-68",description: "An expense account that tracks the amount you use in purchasing materials." },
  { accountName: "Subcontractor", accountSubhead: "Cost of Goods Sold", accountHead: "Expenses", accountGroup: "Liability",accountCode:"AC-69",description: "An expense account to track the amount that you pay subcontractors who provide service to you." }
];