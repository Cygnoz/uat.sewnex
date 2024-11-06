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



