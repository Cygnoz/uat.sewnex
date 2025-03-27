// v1.1

const Organization = require("../../database/model/organization");
const Client = require("../../database/model/client");
const User = require("../../database/model/user");
const Prefix = require("../../database/model/prefix");
const Account = require("../../database/model/account")
const Currency = require("../../database/model/currency")
const Journal = require("../../database/model/journal");
const TrialBalance = require("../../database/model/trialBalance");
const Setting = require("../../database/model/settings");
const PaymentTerms = require("../../database/model/paymentTerm");
const Role = require('../../database/model/role');
const Tax = require('../../database/model/tax');
const DefAcc = require("../../database/model/defaultAccount")
const bcrypt = require('bcrypt');

const SewnexSetting = require('../../Sewnex/model/sxSetting');

const { cleanData } = require("../../services/cleanData");



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

          // Accounts Module
          { action: "AccountNumber", note: "Viewed Account Number" },
          { action: "AccountAdd", note: "Created a New Account" },          
          { action: "AccountView", note: "Viewed Account Information" },
          { action: "AccountEdit", note: "Edited Account Information" },
          { action: "AccountDelete", note: "Deleted an Account" },
          
          { action: "JournalAdd", note: "Added a Journal Entry" },
          { action: "JournalView", note: "Viewed Journal Entry" },
          { action: "JournalEdit", note: "Edited Journal Entry" },
          { action: "JournalDelete", note: "Deleted Journal Entry" },





          // Customers Module
          { action: "CustomersCreate", note: "Created a New Customer" },
          { action: "CustomersView", note: "Viewed Customer details" },          
          { action: "CustomersEdit", note: "Edited Customer information" },
          { action: "CustomerDelete", note: "Deleted Customer" },
          
          { action: "CustomerImport", note: "Imported New Customers" },




          // Inventory Module
          { action: "ItemAdd", note: "Created a New Item" },
          { action: "ItemView", note: "Viewed Item Information" },          
          { action: "ItemEdit", note: "Edited Item Information" },
          { action: "ItemDelete", note: "Deleted an Item" },

              



          // Organization Module
          { action: "OrganizationSetup", note: "Setup/Modified Organization Details" },

          // Organization Module - Setting
          { action: "SettingView", note: "Viewed Setting details" },
          { action: "SettingAdd", note: "Added a new Setting" },
          { action: "SettingEdit", note: "Edited Setting details" },
          { action: "SettingDelete", note: "Deleted a Setting" },          
          




          //Purchase
          { action: "PurchaseOrderAdd", note: "Created a New Purchase Order" },
          { action: "PurchaseOrderView", note: "Viewed Purchase Order" },
          { action: "PurchaseOrderEdit", note: "Edited Purchase Order" },
          { action: "PurchaseOrderDelete", note: "Deleted Purchase Order" },

          { action: "PurchaseBillAdd", note: "Created a New Purchase Bill" },
          { action: "PurchaseBillView", note: "Viewed Purchase Bill" },
          { action: "PurchaseBillEdit", note: "Edited Purchase Bill" },
          { action: "PurchaseBillDelete", note: "Deleted Purchase Bill" },

          { action: "PurchasePaymentAdd", note: "Created a New Purchase Payment" },
          { action: "PurchasePaymentView", note: "Viewed Purchase Payment" },
          { action: "PurchasePaymentEdit", note: "Edited Purchase Payment" },
          { action: "PurchasePaymentDelete", note: "Deleted Purchase Payment" },

          { action: "PurchaseDebitNoteAdd", note: "Created a New Purchase Debit Note" },
          { action: "PurchaseDebitNoteView", note: "Viewed Purchase Debit Note" },
          { action: "PurchaseDebitNoteEdit", note: "Edited Purchase Debit Note" },
          { action: "PurchaseDebitNoteDelete", note: "Deleted Purchase Debit Note" },




          
           //Supplier Module
          { action: "SupplierCreate", note: "Created a New Supplier" },
          { action: "SupplierView", note: "Viewed Supplier Details" },
          { action: "SupplierEdit", note: "Edited Supplier Information" },
          { action: "SupplierDelete", note: "Deleted Supplier Information" },
          
          { action: "SupplierImport", note: "Import New Suppliers" },
          





          //Report Module
          { action: "ReportView", note: "Viewed Reports" },





          //Sales Module - Quote
          { action: "QuoteCreate", note: "Created a New Quote" },
          { action: "QuoteView", note: "Viewed Quote Details" },
          { action: "QuoteEdit", note: "Edited Quote Information" },
          { action: "QuoteDelete", note: "Deleted Quote Information" },

          //Sales Module - Order
          { action: "OrderCreate", note: "Created a New Order" },
          { action: "OrderView", note: "Viewed Order Details" },
          { action: "OrderEdit", note: "Edited Order Information" },
          { action: "OrderDelete", note: "Deleted Order Information" },

          //Sales Module - Invoice
          { action: "InvoiceCreate", note: "Created a New Invoice" },
          { action: "InvoiceView", note: "Viewed Invoice Details" },
          { action: "InvoiceEdit", note: "Edited Invoice Information" },
          { action: "InvoiceDelete", note: "Deleted Invoice Information" },

          //Sales Module - Receipt
          { action: "ReceiptCreate", note: "Created a New Receipt" },
          { action: "ReceiptView", note: "Viewed Receipt Details" },
          { action: "ReceiptEdit", note: "Edited Receipt Information" },
          { action: "ReceiptDelete", note: "Deleted Receipt Information" },

          //Sales Module - Credit Note
          { action: "CreditNoteCreate", note: "Created a New Credit Note" },
          { action: "CreditNoteView", note: "Viewed Credit Note Details" },
          { action: "CreditNoteEdit", note: "Edited Credit Note Information" },
          { action: "CreditNoteDelete", note: "Deleted Credit Note Information" },
          
          //Staff Module - Expense
          { action: "ExpenseCreate", note: "Created a New Expense" },
          { action: "ExpenseView", note: "Viewed Expense Details" },
          { action: "ExpenseEdit", note: "Edited Expense Information" },
          { action: "ExpenseDelete", note: "Deleted Expense Information" },


        ],
      },{
        organizationId,
        description: 'Manufacture',
        roleName: 'Manufacture',
        permissions: []
      },{
        organizationId,
        description: 'Designer',
        roleName: 'Designer',
        permissions: []
      },{
        organizationId,
        description: 'Worker',
        roleName: 'Worker',
        permissions: []
      }
      
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
        receipt: 'CP-',receiptNum: 1,
        purchaseOrder: "PO-",purchaseOrderNum: 1,        
        salesOrder: "SO-",salesOrderNum: 1,
        payment: "VP-",paymentNum: 1,
        bill: "BS-",billNum: 1,
        debitNote: "CDN-",debitNoteNum: 1,
        invoice:"INV-",invoiceNum: 1,
        quote: "QT-",quoteNum: 1,        
        deliveryChallan: "DC-",deliveryChallanNum: 1,
        expense: "EX-",expenseNum: 1,
        order: "ORD", orderNum: 1,
        internalOrder:"INTORD",internalOrderNum:1,     
        }]},            
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
    await insertAccounts(accounts, organizationId);
    await defaultAccounts(organizationId);
  
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










// Auto sewnex create settings
const createSewnexSettingsOrganization = async (organizationId) => {
  try {
    
    // Check if the Settings already exist for the organization
    const existingSettings = await SewnexSetting.find({ organizationId:organizationId });
    
    if (existingSettings.length > 0) {
      console.log("Settings already exist for this organization.");
      return { success: true, message: "Settings already exist for this organization." };
    }

    // Create settings
    const settings = [
      {organizationId,

      //order
      datePreference:"Order Wise",
      orderTax:"Taxable",
      orderFabric:true,

      //Order status
      orderStatus:[
          {orderStatusName:"Order Placed"},
          {orderStatusName:"Manufacturing"},
          {orderStatusName:"Delivery"}
      ],

      //Manufacturing Status
      manufacturingStatus:[
        {manufacturingStatusName:"Cutting"},
        {manufacturingStatusName:"Stitching"},
        {manufacturingStatusName:"Embroidery"},
        {manufacturingStatusName:"Dying"},
    ],

    //Staff
    measuringStaff:true,

      




      
      

    }];

    await SewnexSetting.insertMany(settings);
    console.log("Sewnex Settings created successfully for organization:", organizationId);
    return { success: true, message: "Sewnex Settings created successfully." };

  } catch (error) {
    console.error("Error creating settings:", error);
    return { success: false, message: "Failed to create settings." };
  }
};







// Create New Client, Organization, Prefix, Role
exports.createOrganizationAndClient = async (req, res) => {
  console.log("Create Organization and Client:", req.body);
  try {
    const cleanedData = cleanData(req.body);
    // const {
    //   organizationName,
    //   contactName,
    //   contactNum,
    //   email,
    //   password,
    //   startDate,
    //   endDate
    //   // Add other fields as needed
    // } = req.body;

    //Validate Inputs  
    if (!validateInputs(cleanedData, res)) return;
    
    // Check if an organization with the same organizationName already exists
    const existingOrganization = await Organization.findOne({ organizationName : cleanedData.organizationName });
    
    if (existingOrganization) {
      return res.status(409).json({ message: "Organization with the provided name already exists." });
    }
    
    const clientExists = await Client.findOne({ email:cleanedData.email });
    if (clientExists) {
      return res.status(404).json({ message: "Client Exists" });
    }
    

    // Count existing organizations to generate the next organizationId
    let nextId = 1;
    const lastOrganizationId = await Organization.findOne().sort({ _id: -1 }); // Sort by creation date to find the last one
    if (lastOrganizationId) {
      const lastId = parseInt(lastOrganizationId.organizationId.slice(6)); // Extract the numeric part from the customerID
      nextId = lastId + 1; // Increment the last numeric part
    }    
    const organizationId = `SX-ORG${nextId.toString().padStart(4, '0')}`;

    // Create a new organization
    const newOrganization = new Organization({
      ...cleanedData,
      primaryContactName: cleanedData.contactName,
      primaryContactNum: cleanedData.contactNum,
      primaryContactEmail: cleanedData.email,
      organizationId
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

    // Create Sewnex Settings for the organization
    const sewnexSettingsCreationResult = await createSewnexSettingsOrganization(organizationId);
    if (!sewnexSettingsCreationResult.success) {
      return res.status(500).json({ message: sewnexSettingsCreationResult.message });
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

     // Create Prefix for the organization
     const prefixCreationResult = await createPrefixForOrganization(organizationId);
     if (!prefixCreationResult.success) {
       return res.status(500).json({ message: prefixCreationResult.message });
     }   

    // Hash the password before saving
    const hashedPassword = await bcrypt.hash(cleanedData.password, 10);

    // Create a new client
    const newClient = new Client({ ...cleanedData, organizationId });

    const savedClient = await newClient.save();

    if (!savedClient) {
      console.error("Client could not be saved.");
      return res.status(500).json({ message: "Failed to create client." });
    }

    // Create a new user
    const newUser = new User({
      ...cleanedData,
      organizationId,
      userName: cleanedData.contactName,
      userNum: cleanedData.contactNum,
      userEmail: cleanedData.email,
      password: hashedPassword,
      role: 'Admin',
    });

    const savedUser = await newUser.save();

    if (!savedUser) {
      console.error("User could not be saved.");
      return res.status(500).json({ message: "Failed to create user." });
    }

    res.status(201).json({
      message: "Client created successfully.",
      organizationId: organizationId,
    });
    console.log("Organization, Client, User, Prefix, Currency, Role created successfully:", { organizationId });
  } catch (error) {
    console.error("Error creating Organization, Client, and User:", error);
    res.status(500).json({ message: "Internal server error.", error : error.message, stack: error.stack });
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
    res.status(500).json({ message: "Internal server error.", error : error.message, stack: error.stack });
  }
};


// Get One organization(Nex)
exports.getOneOrganizationNex = async (req, res) => {
  try {
    const { organizationId } = req.params;

    const existingOrganization = await Organization.findOne({ organizationId });

    if (existingOrganization) res.status(200).json(existingOrganization);
    else res.status(404).json({ message: "Organization not found" });
    
  } catch (error) {
    console.error("Error fetching organization:", error);
    res.status(500).json({ message: "Internal server error.", error : error.message, stack: error.stack });
  }
};

























// Fetch existing data
const dataExist = async (organizationId) => {
  const [ salesDiscountAccount, purchaseDiscountAccount ] = await Promise.all([
    Account.findOne({ organizationId, accountName:'Sales Discount' }, { _id: 1 }),
    Account.findOne({ organizationId, accountName:'Purchase Discount' }, { _id: 1 }),
  ]);
  return { salesDiscountAccount, purchaseDiscountAccount };
};










async function defaultAccounts(organizationId) {
  try {
    const { salesDiscountAccount, purchaseDiscountAccount } = await dataExist(organizationId);
    
    const defaultAccountData = {
      organizationId,
      salesDiscountAccount :salesDiscountAccount._id, 
      purchaseDiscountAccount :purchaseDiscountAccount._id,
    };

    const newDefaultAccount = new DefAcc(defaultAccountData);
    await newDefaultAccount.save();
  } catch (error) {
    console.error("Error adding Default Account:", error);
  }
}

















async function insertAccounts(accounts,organizationId) {

  const accountDocuments = accounts.map(account => {
      return {
          organizationId: organizationId, 
          accountName: account.accountName,
          accountCode: account.accountCode, 

          accountSubhead: account.accountSubhead,
          accountHead: account.accountHead,
          accountGroup: account.accountGroup,

          systemAccounts: account.systemAccounts,

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
        transactionId:'OB',
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

  //Current Asset
  { accountName: "Advance Tax", accountSubhead: "Current Asset", accountHead: "Asset", accountGroup: "Asset",accountCode:"AC-01",systemAccounts: true,description: "Any tax which is paid in advance is recorded into the advance tax account. This advance tax payment could be a quarterly, half yearly or yearly payment." },
  { accountName: "Employee Advance", accountSubhead: "Current Asset", accountHead: "Asset", accountGroup: "Asset",accountCode:"AC-02",systemAccounts: true,description: "Money paid out to an employee in advance can be tracked here till it's repaid or shown to be spent for company purposes." },
  { accountName: "Input Tax Credit", accountSubhead: "Current Asset", accountHead: "Asset", accountGroup: "Asset",accountCode:"AC-03",systemAccounts: true,description: "Input Tax Credits" },
  { accountName: "Prepaid Expense", accountSubhead: "Current Asset", accountHead: "Asset", accountGroup: "Asset",accountCode:"AC-04",systemAccounts: false,description: "An asset account that reports amounts paid in advance while purchasing goods or services from a vendor." },
  { accountName: "Reverse Charge Tax Input but not due", accountSubhead: "Current Asset", accountHead: "Asset", accountGroup: "Asset",accountCode:"AC-05",systemAccounts: true,description: "The amount of tax payable for your reverse charge purchases can be tracked here." },
  { accountName: "Sales to Customers (Cash)", accountSubhead: "Current Asset", accountHead: "Asset", accountGroup: "Asset",accountCode:"AC-06",systemAccounts: true,description: "Sales to Customers (Cash)." },
  { accountName: "TDS Receivable", accountSubhead: "Current Asset", accountHead: "Asset", accountGroup: "Asset",accountCode:"AC-07" ,systemAccounts: false,description: "TDS Receivable."},
  { accountName: "Inventory Asset", accountSubhead: "Current Asset", accountHead: "Asset", accountGroup: "Asset",accountCode:"AC-09",systemAccounts: true,description: "An account which tracks the value of goods in your inventory.." },

  //Non-Current Asset
  { accountName: "Furniture and Equipment", accountSubhead: "Non-Current Asset", accountHead: "Asset", accountGroup: "Asset",accountCode:"AC-08",systemAccounts: false,description: "Purchases of furniture and equipment for your office that can be used for a long period of time usually exceeding one year can be tracked with this account." },

  //Cash
  { accountName: "Petty Cash", accountSubhead: "Cash", accountHead: "Asset", accountGroup: "Asset",accountCode:"AC-10",systemAccounts: true,description: "It is a small amount of cash that is used to pay your minor or casual expenses rather than writing a check." },
  { accountName: "Undeposited Funds", accountSubhead: "Cash", accountHead: "Asset", accountGroup: "Asset",accountCode:"AC-11" ,systemAccounts: true,description: "Record funds received by your company yet to be deposited in a bank as undeposited funds and group them as a current asset in your balance sheet."},

  //Equity
  { accountName: "Capital Stock", accountSubhead: "Equity", accountHead: "Equity", accountGroup: "Asset",accountCode:"AC-12" ,systemAccounts: false,description: "An equity account that tracks the capital introduced when a business is operated through a company or corporation."},
  { accountName: "Distribution", accountSubhead: "Equity", accountHead: "Equity", accountGroup: "Asset",accountCode:"AC-13",systemAccounts: false,description: "An equity account that tracks the payment of stock, cash or physical products to its shareholders." },
  { accountName: "Dividends Paid", accountSubhead: "Equity", accountHead: "Equity", accountGroup: "Asset",accountCode:"AC-14",systemAccounts: false,description: "An equity account to track the dividends paid when a corporation declares dividend on its common stock." },
  { accountName: "Drawings", accountSubhead: "Equity", accountHead: "Equity", accountGroup: "Asset",accountCode:"AC-15",systemAccounts: true,description: "The money withdrawn from a business by its owner can be tracked with this account." },
  { accountName: "Investments", accountSubhead: "Equity", accountHead: "Equity", accountGroup: "Asset",accountCode:"AC-16" ,systemAccounts: false,description: "An equity account used to track the amount that you invest."},
  { accountName: "Opening Balance Offset", accountSubhead: "Equity", accountHead: "Equity", accountGroup: "Asset",accountCode:"AC-17",systemAccounts: true,description: "This is an account where you can record the balance from your previous years earning or the amount set aside for some activities. It is like a buffer account for your funds." },
  { accountName: "Owner's Equity", accountSubhead: "Equity", accountHead: "Equity", accountGroup: "Asset",accountCode:"AC-18",systemAccounts: true,description: "The owners rights to the assets of a company can be quantified in the owner''s equity account." },
  { accountName: "Retained Earning", accountSubhead: "Equity", accountHead: "Equity", accountGroup: "Asset",accountCode:"AC-19",systemAccounts: true,description: "Retained Earnings." },

  //Sales
  { accountName: "Sales", accountSubhead: "Sales", accountHead: "Income", accountGroup: "Asset",accountCode:"AC-26",systemAccounts: true,description: "The income from the sales in your business is recorded under the sales account."},

  //Indirect Income 
  { accountName: "Interest Income", accountSubhead: "Indirect Income", accountHead: "Income", accountGroup: "Asset",accountCode:"AC-22",systemAccounts: true,description: "A percentage of your balances and deposits are given as interest to you by your banks and financial institutions. This interest is recorded into the interest income account." },
  { accountName: "Late Fee Income", accountSubhead: "Indirect Income", accountHead: "Income", accountGroup: "Asset",accountCode:"AC-23",systemAccounts: true,description: "Any late fee income is recorded into the late fee income account. The late fee is levied when the payment for an invoice is not received by the due date."},
  { accountName: "Other Charges", accountSubhead: "Indirect Income", accountHead: "Income", accountGroup: "Asset",accountCode:"AC-24",systemAccounts: true,description: "Miscellaneous charges like adjustments made to the invoice can be recorded in this account."},
  { accountName: "Purchase Discount", accountSubhead: "Indirect Income", accountHead: "Expenses", accountGroup: "Liability",accountCode:"AC-56",systemAccounts: true,description: "Tracks any reduction that your vendor offers on your purchases. Some vendors also provide them to encourage quick payment settlement." },

  //Current Liability
  { accountName: "Employee Reimbursements", accountSubhead: "Current Liability", accountHead: "Liabilities", accountGroup: "Liability",accountCode:"AC-27",systemAccounts: true,description: "This account can be used to track the reimbursements that are due to be paid out to employees." },
  { accountName: "Output Tax Credit", accountSubhead: "Current Liability", accountHead: "Liabilities", accountGroup: "Liability",accountCode:"AC-28",systemAccounts: true,description: "Output Tax Credit" },
  { accountName: "Opening Balance Adjustments", accountSubhead: "Current Liability", accountHead: "Liabilities", accountGroup: "Liability",accountCode:"AC-29" ,systemAccounts: true,description: "This account will hold the difference in the debits and credits entered during the opening balance."},
  { accountName: "Tax Payable", accountSubhead: "Current Liability", accountHead: "Liabilities", accountGroup: "Liability",accountCode:"AC-30" ,systemAccounts: true,description: "The amount of money which you owe to your tax authority is recorded under the tax payable account. This amount is a sum of your outstanding in taxes and the tax charged on sales."},
  { accountName: "TDS Payable", accountSubhead: "Current Liability", accountHead: "Liabilities", accountGroup: "Liability",accountCode:"AC-31",systemAccounts: false,description: "TDS Payable" },
  { accountName: "Unearned Revenue", accountSubhead: "Current Liability", accountHead: "Liabilities", accountGroup: "Liability",accountCode:"AC-32" ,systemAccounts: true,description: "A liability account that reports amounts received in advance of providing goods or services. When the goods or services are provided, this account balance is decreased and a revenue account is increased."},
  
  //Non-Current Liability
  { accountName: "Construction Loan", accountSubhead: "Non-Current Liability", accountHead: "Liabilities", accountGroup: "Liability",accountCode:"AC-33",systemAccounts: false,description: "An expense account that tracks the amount you repay for construction loans." },
  { accountName: "Mortgages", accountSubhead: "Non-Current Liability", accountHead: "Liabilities", accountGroup: "Liability",accountCode:"AC-34" ,systemAccounts: false,description: "An expense account that tracks the amounts you pay for the mortgage loan."},
  
  
  //Direct Expense
  { accountName: "Fuel/Mileage Expenses", accountSubhead: "Direct Expense", accountHead: "Expenses", accountGroup: "Liability",accountCode:"AC-45",systemAccounts: false,description: "Fuel/Mileage Expenses" },
  { accountName: "Raw Material and Consumables", accountSubhead: "Direct Expense", accountHead: "Expenses", accountGroup: "Liability",accountCode:"AC-57" ,systemAccounts: false,description: "An expense account to track the amount spent on purchasing raw materials and consumables."},
  
  //Cost of Goods Sold
  { accountName: "Cost of Goods Sold", accountSubhead: "Cost of Goods Sold", accountHead: "Expenses", accountGroup: "Liability",accountCode:"AC-65" ,systemAccounts: true,description: "An expense account which tracks the value of the goods sold."},
  
  //Indirect Expense
  { accountName: "Sales Discount", accountSubhead: "Indirect Expense", accountHead: "Income", accountGroup: "Asset",accountCode:"AC-20",systemAccounts: true,description: "Any reduction on your selling price as a discount can be recorded into the discount account."},
  { accountName: "Advertising and Marketing", accountSubhead: "Indirect Expense", accountHead: "Expenses", accountGroup: "Liability",accountCode:"AC-36",systemAccounts: false,description: "Your expenses on promotional, marketing and advertising activities like banners, web-adds, trade shows, etc. are recorded in advertising and marketing account." },
  { accountName: "Exchange Gain or Loss", accountSubhead: "Indirect Expense", accountHead: "Expenses", accountGroup: "Liability",accountCode:"AC-66" ,systemAccounts: true,description: "Changing the conversion rate can result in a gain or a loss. You can record this into the exchange gain or loss account."},
  { accountName: "Bad Debt", accountSubhead: "Indirect Expense", accountHead: "Expenses", accountGroup: "Liability",accountCode:"AC-38" ,systemAccounts: true,description: "Any amount which is lost and is unrecoverable is recorded into the bad debt account."},
  { accountName: "Bank Fees and Charges", accountSubhead: "Indirect Expense", accountHead: "Expenses", accountGroup: "Liability",accountCode:"AC-39" ,systemAccounts: true,description: "Any bank fees levied is recorded into the bank fees and charges account. A bank account maintenance fee, transaction charges, a late payment fee are some examples."},
  { accountName: "Consultant Expense", accountSubhead: "Indirect Expense", accountHead: "Expenses", accountGroup: "Liability",accountCode:"AC-40" ,systemAccounts: false,description: "Charges for availing the services of a consultant is recorded as a consultant expenses. The fees paid to a soft skills consultant to impart personality development training for your employees is a good example."},
  { accountName: "Credit Card Charges", accountSubhead: "Indirect Expense", accountHead: "Expenses", accountGroup: "Liability",accountCode:"AC-42" ,systemAccounts: false,description: " Service fees for transactions , balance transfer fees, annual credit fees and other charges levied on a credit card are recorded into the credit card account."},
  { accountName: "Depreciation Expense", accountSubhead: "Indirect Expense", accountHead: "Expenses", accountGroup: "Liability",accountCode:"AC-44",systemAccounts: false,description: "Any depreciation in value of your assets can be captured as a depreciation expense." },
  { accountName: "IT and Internet Expense", accountSubhead: "Indirect Expense", accountHead: "Expenses", accountGroup: "Liability",accountCode:"AC-46",systemAccounts: false,description: "Money spent on your IT infrastructure and usage like internet connection, purchasing computer equipment etc is recorded as an IT and Computer Expense." },
  { accountName: "Janitorial Expense", accountSubhead: "Indirect Expense", accountHead: "Expenses", accountGroup: "Liability",accountCode:"AC-47" ,systemAccounts: false,description: "All your janitorial and cleaning expenses are recorded into the janitorial expenses account."},
  { accountName: "Lodging", accountSubhead: "Indirect Expense", accountHead: "Expenses", accountGroup: "Liability",accountCode:"AC-48" ,systemAccounts: true,description: "Any expense related to putting up at motels etc while on business travel can be entered here."},
  { accountName: "Office Supplies", accountSubhead: "Indirect Expense", accountHead: "Expenses", accountGroup: "Liability",accountCode:"AC-51",systemAccounts: false,description: "All expenses on purchasing office supplies like stationery are recorded into the office supplies account." },
  { accountName: "Other Expenses", accountSubhead: "Indirect Expense", accountHead: "Expenses", accountGroup: "Liability",accountCode:"AC-52",systemAccounts: true,description: "Any minor expense on activities unrelated to primary business operations is recorded under the other expense account." },
  { accountName: "Postage", accountSubhead: "Indirect Expense", accountHead: "Expenses", accountGroup: "Liability" ,accountCode:"AC-54",systemAccounts: false,description: "Your expenses on ground mails, shipping and air mails can be recorded under the postage account."},
  { accountName: "Printing and Stationary", accountSubhead: "Indirect Expense", accountHead: "Expenses", accountGroup: "Liability",accountCode:"AC-55",systemAccounts: false,description: "Expenses incurred by the organization towards printing and stationery." },
  { accountName: "Rent Expense", accountSubhead: "Indirect Expense", accountHead: "Expenses", accountGroup: "Liability",accountCode:"AC-58",systemAccounts: false,description: "The rent paid for your office or any space related to your business can be recorded as a rental expense." },
  { accountName: "Repairs and Maintenance", accountSubhead: "Indirect Expense", accountHead: "Expenses", accountGroup: "Liability",accountCode:"AC-59",systemAccounts: false,description: "The costs involved in maintenance and repair of assets is recorded under this account." },
  { accountName: "Salaries", accountSubhead: "Indirect Expense", accountHead: "Expenses", accountGroup: "Liability",accountCode:"AC-60",systemAccounts: false,description: "Salaries for your employees and the wages paid to workers are recorded under the salaries and wages account." },
  { accountName: "Telephone Expense", accountSubhead: "Indirect Expense", accountHead: "Expenses", accountGroup: "Liability",accountCode:"AC-61",systemAccounts: false,description: "The expenses on your telephone, mobile and fax usage are accounted as telephone expenses." },
  { accountName: "Travel Expense", accountSubhead: "Indirect Expense", accountHead: "Expenses", accountGroup: "Liability",accountCode:"AC-63",systemAccounts: false,description: "Expenses on business travels like hotel bookings, flight charges, etc. are recorded as travel expenses." },
  { accountName: "Uncategorized", accountSubhead: "Indirect Expense", accountHead: "Expenses", accountGroup: "Liability",accountCode:"AC-64",systemAccounts: true,description: "This account can be used to temporarily track expenses that are yet to be identified and classified into a particular category." },
  
];












//Validate inputs
function validateInputs(data, res) {
  const validationErrors = validateData(data);
  if (validationErrors.length > 0) {
    res.status(400).json({ message: validationErrors.join(", ") });
    return false;
  }
  return true;
}

//Validate Data
function validateData(data) {
  const errors = [];

  //Basic Info
  validateReqFields( data, errors);

  return errors;
}

// Field validation utility
function validateField(condition, errorMsg, errors) {
  if (condition) errors.push(errorMsg);
}

//Valid Req Fields
function validateReqFields( data, errors ) {

  
  validateField( typeof data.organizationName === 'undefined', `Organization Name Required`, errors );
  validateField( typeof data.contactName === 'undefined', `Contact Name Required`, errors );
  validateField( typeof data.contactNum === 'undefined', `Contact Number Required`, errors );
  
  validateField( typeof data.email === 'undefined', `Email Required`, errors );
  validateField( typeof data.password === 'undefined', `Password Required`, errors );
  
  // validateField( typeof data.startDate === 'undefined', `Start Date Required`, errors );
  // validateField( typeof data.endDate === 'undefined', `End Date Required`, errors );  

  // const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  // const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/; //minimum 8 characters,one uppercase letter, one lowercase letter, one number, and one special character

  // validateField( !emailRegex.test(data.email), `Invalid email format.`, errors );
  // validateField( !passwordRegex.test(data.password), `Password must be at least 8 characters long and include at least one letter and one number.`, errors );

}