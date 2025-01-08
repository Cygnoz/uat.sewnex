const Organization = require("../database/model/organization");
const Account = require("../database/model/account");
const Supplier = require("../database/model/supplier");
const Tax = require("../database/model/tax");
const Currency = require("../database/model/currency");
const moment = require("moment-timezone");
const TrialBalance = require("../database/model/trialBalance");
const SupplierHistory = require("../database/model/supplierHistory");
const Settings = require("../database/model/settings")

const { singleCustomDateTime, multiCustomDateTime } = require("../services/timeConverter");
const { cleanData } = require("../services/cleanData");



const dataExist = async ( organizationId, supplierId ) => {
    const [organizationExists, taxExists, currencyExists, allSupplier ,settings, existingSupplier, accountExist, trialBalance, supplierHistory ] = await Promise.all([
      Organization.findOne({ organizationId },{ timeZoneExp: 1, dateFormatExp: 1, dateSplit: 1, organizationCountry: 1 }).lean(),
      Tax.findOne({ organizationId },{ taxType: 1 }).lean(),
      Currency.find({ organizationId }, { currencyCode: 1, _id: 0 }).lean(),
      Supplier.find({ organizationId : organizationId },{ organizationId:0 }).lean(),
      Settings.find({ organizationId },{ duplicateSupplierDisplayName: 1, duplicateSupplierEmail: 1, duplicateSupplierMobile: 1 }).lean(),
      Supplier.findOne({ _id:supplierId, organizationId},{ organizationId:0 }).lean(),
      Account.findOne({ accountId: supplierId, organizationId },{ organizationId:0 }).lean(),
      TrialBalance.findOne({ organizationId, operationId: supplierId},{ organizationId:0 }).lean(),
      SupplierHistory.find({ organizationId, supplierId },{ organizationId:0 }).lean()

    ]);
    return { organizationExists, taxExists, currencyExists, allSupplier , settings, existingSupplier, accountExist, trialBalance, supplierHistory};
  };



//Add Supplier
exports.addSupplier = async (req, res) => {
  console.log("Add Supplier:", req.body);  

  try {
    const { organizationId, id: userId, userName } = req.user;
    //Clean Data
    const cleanedData = cleanData(req.body)
    cleanedData.contactPersons = cleanedData.contactPersons?.map(person => cleanData(person)) || [];
    cleanedData.bankDetails = cleanedData.bankDetails?.map(bankDetail => cleanData(bankDetail)) || []
    const { supplierEmail, debitOpeningBalance, creditOpeningBalance, supplierDisplayName, mobile } = cleanedData;

    const { organizationExists, taxExists, currencyExists , allSupplier, settings} = await dataExist( organizationId, null);
    cleanedData.taxType = taxExists.taxType
    // checking values from supplier settings
    const { duplicateSupplierDisplayName , duplicateSupplierEmail , duplicateSupplierMobile } = settings[0]
    
    //Data Exist Validation
    if (!validateOrganizationTaxCurrency(organizationExists, taxExists, currencyExists, res)) return;     

    //Validate Inputs  
    if (!validateInputs(cleanedData, currencyExists, taxExists, organizationExists, res)) return;
    
    //Duplication Check
    const errors = [];
    const duplicateCheck = { duplicateSupplierDisplayName, duplicateSupplierEmail, duplicateSupplierMobile }
    
    await checkDuplicateSupplierFields( duplicateCheck, supplierDisplayName, supplierEmail, mobile, organizationId, errors);  
    if (errors.length) {
    return res.status(409).json({ message: errors }); }
    
    const savedSupplier = await createNewSupplier( cleanedData, organizationId );
     
    const savedAccount = await createNewAccount( supplierDisplayName, organizationId, allSupplier , savedSupplier );

    await saveTrialBalanceAndHistory(savedSupplier, savedAccount, debitOpeningBalance, creditOpeningBalance, userId, userName );

    console.log("Supplier & Account created successfully");
    res.status(201).json({ message: "Supplier created successfully." });
  } catch (error) {
    console.error("Error creating Supplier:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

//Edit Supplier
exports.updateSupplier = async (req, res) => {
  console.log("Edit supper",req.body);
    try {
      const { organizationId, id: userId, userName } = req.user;
     
      const cleanedData = cleanData(req.body);
      cleanedData.contactPersons = cleanedData.contactPersons?.map(person => cleanData(person)) || [];
      cleanedData.bankDetails = cleanedData.bankDetails?.map(bankDetail => cleanData(bankDetail)) || [];
      const { supplierId } = req.params;
  
      const { supplierDisplayName, supplierEmail, mobile } = cleanedData;
  
      const { organizationExists, taxExists, currencyExists , settings, existingSupplier, accountExist, trialBalance } = await dataExist( organizationId, supplierId );
      
       // checking values from supplier settings
      const { duplicateSupplierDisplayName , duplicateSupplierEmail , duplicateSupplierMobile } = settings[0]
      
      
      if (!validateOrganizationTaxCurrency(organizationExists, taxExists, currencyExists, res)) return;
          
      if (!existingSupplier) {
        return res.status(404).json({ message: "Supplier not found" });
      }
  
      if (!validateInputs(cleanedData, currencyExists, taxExists, organizationExists, res)) return;
      
      //Duplication Check
      const errors = [];
      const duplicateCheck = { duplicateSupplierDisplayName, duplicateSupplierEmail, duplicateSupplierMobile };
      
      await checkDuplicateSupplierFieldsEdit( duplicateCheck, supplierDisplayName, supplierEmail, mobile, organizationId,supplierId, errors);  
      if (errors.length) {
        return res.status(409).json({ message: errors }); }
      
      //Opening balance
      editOpeningBalance(existingSupplier, cleanedData);
      await updateOpeningBalance(trialBalance, cleanedData);
      
      //Account Name
      const oldSupplierDisplayName = existingSupplier.supplierDisplayName;
      if(oldSupplierDisplayName !== supplierDisplayName){
        await updateAccount(cleanedData,accountExist);
      }
      cleanedData.lastModifiedDate = new Date();

      // Update customer fields
      const mongooseDocument = Supplier.hydrate(existingSupplier);
      Object.assign(mongooseDocument, cleanedData);
      const savedSupplier = await mongooseDocument.save();
  
      if (!savedSupplier) {
        console.error("Supplier could not be saved.");
        return res.status(500).json({ message: "Failed to Update Supplier." });
      }
  
      // Add entry to Customer History
      const supplierHistoryEntry = new SupplierHistory({
        organizationId,
        operationId: savedSupplier._id,
        supplierId,
        supplierDisplayName: savedSupplier.supplierDisplayName,
        title: "Supplier Data Modified",
        description: `${savedSupplier.supplierDisplayName} Supplier data  Modified by ${userName}`,  
        userId: userId,
        userName: userName,
      });
  
      await supplierHistoryEntry.save();
  
      res.status(200).json({
        message: "supplier updated successfully.",
      });
    } catch (error) {
      console.error("Error updating supplier:", error);
      res.status(500).json({ message: "Internal server error." });
    }
};

exports.getAllSuppliers = async (req, res) => {
    try {
      const organizationId = req.user.organizationId;
  
      const { organizationExists, allSupplier } = await dataExist( organizationId, null );
  
      if (!organizationExists) {
        return res.status(404).json({ message: "Organization not found" });
      }      
  
      if (!allSupplier.length) {
        return res.status(404).json({ message: "No Suppliers found" });
      }

      const formattedObjects = multiCustomDateTime(allSupplier, organizationExists.dateFormatExp, organizationExists.timeZoneExp, organizationExists.dateSplit );    
  
      res.status(200).json(formattedObjects);
    } catch (error) {
      console.error("Error fetching Suppliers:", error);
      res.status(500).json({ message: "Internal server error." });
    }
  };
  
exports.getOneSupplier = async (req, res) => {
  try {
    const { supplierId } = req.params;
    const organizationId = req.user.organizationId;

    const { organizationExists, existingSupplier } = await dataExist( organizationId , supplierId );

    if (!organizationExists) {
      return res.status(404).json({ message: "Organization not found" });
    }
  

    if (!existingSupplier) {
      return res.status(404).json({ message: "Supplier not found" });
    }

    const formattedObjects = singleCustomDateTime(existingSupplier, organizationExists.dateFormatExp, organizationExists.timeZoneExp, organizationExists.dateSplit );    


    res.status(200).json(formattedObjects);
  } catch (error) {
    console.error("Error fetching customer:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};


exports.getSupplierTransactions = async (req, res) => {
  try {
      const { supplierId } = req.params;
      const { organizationId } = req.user;
      
      const { organizationExists, existingSupplier, accountExist } = await dataExist( organizationId, supplierId);


      if (!organizationExists) {
        return res.status(404).json({ message: "Organization not found" });
      }

      if (!existingSupplier) {
          return res.status(404).json({ message: "Supplier not found" });
      }

      if (!accountExist) {
          return res.status(404).json({ message: "Account not found for this supplier" });
      }

      const supplierTransactions = await TrialBalance.find({ accountId: account._id , organizationId });

      // Format each customer after converting to plain object
      const formattedData = supplierTransactions.map(customer => {
        const plainData = customer.toObject();
  
        if (plainData.createdDateTime) {
  
        const formattedObjects = singleCustomDateTime(existingCustomer, organizationExists.dateFormatExp, organizationExists.timeZoneExp, organizationExists.dateSplit );    

        }
  
        return formattedObjects;
      });

      return res.status(200).json({ formattedData });
  } catch (error) {
      console.error("Error fetching customer transactions:", error);
      return res.status(500).json({ message: "Internal server error" });
  }
};


// Status update
exports.updateSupplierStatus = async (req, res) => {
  try {
    const { supplierId } = req.params;
    const {organizationId , userName , userId} = req.user;
    const { status } = req.body; 
    const { organizationExists, existingSupplier } = await dataExist( organizationId, customerId);
    if (!organizationExists) {
      return res.status(404).json({
        message: "Organization not found",
      });
    }

    if (!existingSupplier) {
      return res.status(404).json({
        message: "supplier not found",
      });
    }
    existingSupplier.status = status;

    await existingSupplier.save();
     const supplierHistoryEntry = new SupplierHistory({
      organizationId,
      operationId: existingSupplier._id,
      supplierId,
      supplierDisplayName: existingSupplier.supplierDisplayName,
      title: "supplier Status Modified",
      description: `Supplier status updated to ${status} by ${userName}`,
      userId: userId,
      userName: userName,
    });

    await supplierHistoryEntry.save();
    res.status(200).json({
      message: "Supplier status updated successfully.",
      status: existingSupplier.status,
    });
    console.log("supplier status updated successfully.");
  } catch (error) {
    console.error("Error updating supplier status:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};
  


exports.getSupplierAdditionalData = async (req, res) => {
  const  organizationId  = req.user.organizationId;
  try {

    const { organizationExists, taxExists } = await dataExist( organizationId, null);

    if (!organizationExists) {
      return res.status(404).json({ message: "Organization not found" });
    }

    if (!taxExists) {
      return res.status(404).json({ message: "Tax data not found" })
    }    
    
    const response = {
      taxType: taxExists.taxType,
      gstTreatment: [
        "Registered Business - Regular",
        "Registered Business - Composition",
        "Unregistered Business",
        "Overseas",
        "Special Economic Zone",
        "Deemed Export",
        "Tax Deductor",
        "SEZ Developer",
      ],
      msmeType: [
        "Micro",
        "Small",
        "Medium"
      ],
   tds :
  [
    { "name": "Commission or Brokerage", "value": "5" },
    { "name": "Commission or Brokerage (Reduced)", "value": "3.75" },
    { "name": "Dividend", "value": "10" },
    { "name": "Dividend (Reduced)", "value": "7.5" },
    { "name": "Other Interest than securities", "value": "10" },
    { "name": "Other Interest than securities (Reduced)", "value": "7.5" },
    { "name": "Payment of contractors for Others", "value": "2" },
    { "name": "Payment of contractors for Others (Reduced)", "value": "1.5" },
    { "name": "Payment of contractors HUF/Indiv", "value": "1" },
    { "name": "Payment of contractors HUF/Indiv (Reduced)", "value": "0.75" },
    { "name": "Professional Fees", "value": "10" },
    { "name": "Professional Fees (Reduced)", "value": "7.5" },
    { "name": "Rent on land or furniture etc", "value": "10" },
    { "name": "Rent on land or furniture etc (Reduced)", "value": "7.5" },
    { "name": "Technical Fees (2%)", "value": "2" }
  ]
    };

    // Return the combined response data
    return res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching supplier additional data:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};
  


exports.getOneSupplierHistory = async (req, res) => {
  try {
    const { supplierId } = req.params;
    
    const  organizationId  = req.user.organizationId;

    const { organizationExists, supplierHistory } = await dataExist( organizationId, supplierId );

    if (!organizationExists) {
      return res.status(404).json({ message: "Organization not found" });
    }

    if (!supplierHistory) {
      return res.status(404).json({
        message: "Supplier History not found",
      });
    }

    const formattedObjects = multiCustomDateTime(supplierHistory, organizationExists.dateFormatExp, organizationExists.timeZoneExp, organizationExists.dateSplit, );    


    res.status(200).json(formattedObjects);
  } catch (error) {
    console.error("Error fetching Supplier:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

  
    // Utility Functions
    const validSalutations = ["Mr.", "Mrs.", "Ms.", "Miss.", "Dr."];
    // const validCustomerTypes = ["Individual", "Business"];
    const validCountries = {
      "United Arab Emirates": [
        "Abu Dhabi",
        "Dubai",
        "Sharjah",
        "Ajman",
        "Umm Al-Quwain",
        "Fujairah",
        "Ras Al Khaimah",
      ],
      "India": [
        "Andaman and Nicobar Island",
        "Andhra Pradesh",
        "Arunachal Pradesh",
        "Assam",
        "Bihar",
        "Chandigarh",
        "Chhattisgarh",
        "Dadra and Nagar Haveli and Daman and Diu",
        "Delhi",
        "Goa",
        "Gujarat",
        "Haryana",
        "Himachal Pradesh",
        "Jammu and Kashmir",
        "Jharkhand",
        "Karnataka",
        "Kerala",
        "Ladakh",
        "Lakshadweep",
        "Madhya Pradesh",
        "Maharashtra",
        "Manipur",
        "Meghalaya",
        "Mizoram",
        "Nagaland",
        "Odisha",
        "Puducherry",
        "Punjab",
        "Rajasthan",
        "Sikkim",
        "Tamil Nadu",
        "Telangana",
        "Tripura",
        "Uttar Pradesh",
        "Uttarakhand",
        "West Bengal",
      ],
      "Saudi Arabia": [
        "Asir",
        "Al Bahah",
        "Al Jawf",
        "Al Madinah",
        "Al-Qassim",
        "Eastern Province",
        "Hail",
        "Jazan",
        "Makkah",
        "Medina",
        "Najran",
        "Northern Borders",
        "Riyadh",
        "Tabuk",
      ],
    };
    const validGSTTreatments = [
      "Registered Business - Regular",
      "Registered Business - Composition",
      "Unregistered Business",
      "Consumer",
      "Overseas",
      "Special Economic Zone",
      "Deemed Export",
      "Tax Deductor",
      "SEZ Developer",
    ];
    
    
    
    // Validate Organization Tax Currency
    function validateOrganizationTaxCurrency(organizationExists, taxExists, currencyExists, res) {
      if (!organizationExists) {
        res.status(404).json({ message: "Organization not found" });
        return false;
      }
      if (!taxExists) {
        res.status(404).json({ message: "Tax not found" });
        return false;
      }
      if (!currencyExists.length) {
        res.status(404).json({ message: "Currency not found" });
        return false;
      }
      return true;
    }
    
   
    
  //Duplication check for add item 
  async function checkDuplicateSupplierFields( duplicateCheck, supplierDisplayName, supplierEmail, mobile, organizationId, errors ) {
            const checks = [
              {
                condition: duplicateCheck.duplicateSupplierDisplayName && supplierDisplayName !== undefined,
                field: 'supplierDisplayName',
                value: supplierDisplayName,
                errorMessage: `Supplier with the provided display name already exists: ${supplierDisplayName}`,
              },
              {
                condition: duplicateCheck.duplicateSupplierEmail && supplierEmail !== undefined,
                field: 'supplierEmail',
                value: supplierEmail,
                errorMessage: `Supplier with the provided email already exists: ${supplierEmail}`,
              },
              {
                condition: duplicateCheck.duplicateSupplierMobile && mobile !== undefined,
                field: 'mobile',
                value: mobile,
                errorMessage: `Supplier with the provided phone number already exists: ${mobile}`,
              },
            ];
  
            for (const { condition, field, value, errorMessage } of checks) {
              if (condition) {
                const existingRecord = await Supplier.findOne({ [field]: value, organizationId });
                if (existingRecord) {
                  errors.push(errorMessage);
                }
              }
            }
  
            
          }
          //Duplication check for edit item 
          async function checkDuplicateSupplierFieldsEdit(
            duplicateCheck,
            supplierDisplayName,
            supplierEmail,
            mobile,
            organizationId,
            supplierId, // Added supplierId
            errors
          ) {
            const checks = [
              {
                condition: duplicateCheck.duplicateSupplierDisplayName && supplierDisplayName !== undefined,
                field: 'supplierDisplayName',
                value: supplierDisplayName,
                errorMessage: `Supplier with the provided display name already exists: ${supplierDisplayName}`,
              },
              {
                condition: duplicateCheck.duplicateSupplierEmail && supplierEmail !== undefined,
                field: 'supplierEmail',
                value: supplierEmail,
                errorMessage: `Supplier with the provided email already exists: ${supplierEmail}`,
              },
              {
                condition: duplicateCheck.duplicateSupplierMobile && mobile !== undefined,
                field: 'mobile',
                value: mobile,
                errorMessage: `Supplier with the provided phone number already exists: ${mobile}`,
              },
            ];
          
            for (const { condition, field, value, errorMessage } of checks) {
              if (condition) {
                // Modify query to exclude the supplier with the given supplierId
                const existingRecord = await Supplier.findOne({
                  [field]: value,
                  organizationId,
                  _id: { $ne: supplierId }, // Exclude the document with the same supplierId
                });
                if (existingRecord) {
                  errors.push(errorMessage);
                }
              }
            }
          }
          

  //Validate inputs
    function validateInputs(data, currencyExists, taxExists, organizationExists, res) {
      const validCurrencies = currencyExists.map((currency) => currency.currencyCode);
      const validTaxTypes = [taxExists.taxType];
      const validationErrors = validateSupplierData(data, validCurrencies, validTaxTypes, organizationExists);
    
      if (validationErrors.length > 0) {
        res.status(400).json({ message: validationErrors.join(", ") });
        return false;
      }
      return true;
    }
  
  // Create New Customer
    function createNewSupplier(data, organizationId) {
      const newSupplier = new Supplier({ ...data, organizationId, status: "Active" });
      return newSupplier.save();
    }
    
    
  // Create New Account
    function createNewAccount(supplierDisplayName, organizationId,   allSupplier , savedSupplier) {
      // Count existing organizations to generate the next organizationId

      console.log("savedSupplier",savedSupplier);
      

      const nextIdNumber = allSupplier.length + 1;    
      const count = `SU${nextIdNumber.toString().padStart(4, '0')}`;
      
      const newAccount = new Account({
        organizationId,
        accountName: supplierDisplayName,
        accountCode:   count,
        accountId: savedSupplier._id,
        accountSubhead: "Sundry Creditors",
        accountHead: "Liabilities",
        accountGroup: "Liability",
        description: "Suppliers",
      });
      return newAccount.save();
    }
    
  // TrialBalance And History
  async function saveTrialBalanceAndHistory(savedSupplier, savedAccount, debitOpeningBalance, creditOpeningBalance, userId, userName) {
      const trialEntry = new TrialBalance({
        organizationId: savedSupplier.organizationId,
        operationId: savedSupplier._id,
        accountId: savedAccount._id,
        accountName: savedAccount.accountName,
        action: "Opening Balance",
        debitAmount: debitOpeningBalance,
        creditAmount: creditOpeningBalance,
        remark: savedSupplier.remark,
      });
      await trialEntry.save();
    
      const supplierHistory = createSupplierHistory(savedSupplier, savedAccount, userId,userName);
      await SupplierHistory.insertMany(supplierHistory);
    }
    
  // Create Customer History
  function createSupplierHistory(savedSupplier, savedAccount,userId,userName) {
      const description = getTaxDescription(savedSupplier, userName);
      const description1 = getOpeningBalanceDescription( savedSupplier, userName);
    
      return [
        {
          organizationId: savedSupplier.organizationId,
          operationId: savedSupplier._id,
          supplierId: savedSupplier._id,
          supplierDisplayName: savedSupplier.supplierDisplayName,
          title: "Supplier Added",
          description,
          userId: userId,
          userName: userName,
        },
        {
          organizationId: savedSupplier.organizationId,
          operationId: savedAccount._id,
          supplierId: savedSupplier._id,
          supplierDisplayName: savedSupplier.supplierDisplayName,
          title: "Supplier Account Created",
          description: description1,
          userId: userId,
          userName: userName,
        },
      ];
    }
  
  // Tax Description
   
function getTaxDescription(data, userName) {
  const descriptionBase = `${data.supplierDisplayName || 'Unknown Supplier'} Contact created with `;
  
  const taxDescriptionGenerators = {
    GST: () => createGSTDescription(data),
    VAT: () => createVATDescription(data),
    None: () => createTaxExemptionDescription(),
  };

  const taxDescription = taxDescriptionGenerators[data.taxType]?.();

  // Handle the case where taxType is not recognized or there is no tax description
  if (taxDescription) {
    return descriptionBase + taxDescription + `Created by ${userName || 'Unknown User'}`;
  } else {
    return `${descriptionBase}no tax applicable. Created by ${userName || 'Unknown User'}`;
  }
}

// GST Description
function createGSTDescription({ gstTreatment, gstin_uin, sourceOfSupply }) {
  return gstTreatment && gstin_uin && sourceOfSupply
    ? `GST Treatment : ${gstTreatment} , GSTIN : ${gstin_uin}  &  State : ${sourceOfSupply}. `
    : "Incomplete GST information. "; // Handle incomplete data case
}

// VAT Description
function createVATDescription({ vatNumber, sourceOfSupply }) {
  return vatNumber && sourceOfSupply
    ? `VAT Number '${vatNumber}'. State updated to ${sourceOfSupply}. `
    : "Incomplete VAT information. "; // Handle incomplete data case
}

// Tax Exemption Description
function createTaxExemptionDescription() {
  return "Tax Exemption. ";
}

    
  // Opening Balance Description
  function getOpeningBalanceDescription(data, userName) {
    let balanceType = "";
    console.log(data)
    // Check for debit opening balance
    if (data && data.debitOpeningBalance) {
      balanceType = `Opening Balance (Debit): ${data.debitOpeningBalance}. `;
    } 
    // Check for credit opening balance
    else if (data && data.creditOpeningBalance) {
      balanceType = `Opening Balance (Credit): ${data.creditOpeningBalance}. `;
    } 
    // If neither balance exists
    else {
      return `${data.supplierDisplayName || 'Unknown Supplier'} Account created with  opening balance 0 , Created by ${userName || 'Unknown User'}`;
    }
  
    // Return description if there's a balance
    return `${data.supplierDisplayName || 'Unknown Supplier'} Account created with ${balanceType}, Created by ${userName || 'Unknown User'}`;
  } 
    
 

//Edit Opening Balance
function editOpeningBalance(existingSupplier, cleanedData) {
  if (existingSupplier.debitOpeningBalance && cleanedData.creditOpeningBalance) {
    cleanedData.debitOpeningBalance = undefined;
  } else if (existingSupplier.creditOpeningBalance && cleanedData.debitOpeningBalance) {
    cleanedData.creditOpeningBalance = undefined;
  }
  return
}


// Update Opening Balance
async function updateOpeningBalance(existingTrialBalance, cleanData) {
  try {
    const { debitOpeningBalance, creditOpeningBalance } = existingTrialBalance;
    let trialEntry;

    if (cleanData.debitOpeningBalance) {
      trialEntry = {
        
        debitAmount: cleanData.debitOpeningBalance,
        creditAmount: undefined,
      };
    } else {
      trialEntry = {
        debitAmount: undefined,
        creditAmount: cleanData.creditOpeningBalance,
      };
    }

    const mongooseDocument = TrialBalance.hydrate(existingTrialBalance);
    Object.assign(mongooseDocument, trialEntry);
    const savedTrialBalance = await mongooseDocument.save();

    return savedTrialBalance;
  } catch (error) {
    console.error("Error updating trial balance opening balance:", error);
    throw error;
  }
}

// Update Account Name
async function updateAccount(cleanedData, accountExist) {
  try {
    console.log("Account name update:", accountExist);
    
    let accountName = { accountName: cleanedData.supplierDisplayName };

    const mongooseDocument = Account.hydrate(accountExist);

    Object.assign(mongooseDocument, accountName);
    const savedAccount = await mongooseDocument.save();
    console.log("Account name updated successfully:", savedAccount);
    

    return savedAccount;
  } catch (error) {
    console.error("Error updating account name:", error);
    throw error;
  }
}










  //Validate Data
    function validateSupplierData(data, validCurrencies, validTaxTypes, organization) {
      const errors = [];
  
      //Basic Info
      // validateCustomerType(data.customerType, errors);\
      validateReqFields( data,  errors);
      validateSalutation(data.salutation, errors);
      validateNames(['firstName', 'lastName'], data, errors);
      validateEmail(data.supplierEmail, errors);
      validateWebsite(data.websiteURL, errors);
      validateContactPerson(data.contactPersons, errors);
      validateBankDetails(data.bankDetails, errors);

      validatePhones(['workPhone', 'mobile'], data, errors);
  
      //OtherDetails
      validateAlphanumericFields(['pan','gstin_uin','vatNumber'], data, errors);
      validateIntegerFields(['creditDays', 'creditLimits'], data, errors);
      validateFloatFields(['debitOpeningBalance', 'creditOpeningBalance', 'interestPercentage'], data, errors);
      validateAlphabetsFields(['department', 'designation','billingAttention','shippingAttention'], data, errors);
  
      //Tax Details
      validateTaxType(data.taxType, validTaxTypes, errors);
      validateSourceOfSupply(data.sourceOfSupply, organization, errors);
      validateGSTorVAT(data, errors);
  
      //Currency
      validateCurrency(data.currency, validCurrencies, errors);
  
      //Address
      validateBillingAddress(data, errors);
      validateShippingAddress(data, errors);  
      return errors;
    }
    

    function validateReqFields( data, errors ) {
      if (typeof data.supplierDisplayName === 'undefined' ) {
        errors.push("Supplier Display Name required");
      }
      const interestPercentage = parseFloat(data.interestPercentage);
      if ( interestPercentage > 100 ) {
        errors.push("Interest Percentage cannot exceed 100%");
      }
    }

    // Field validation utility
    function validateField(condition, errorMsg, errors) {
      if (condition) errors.push(errorMsg);
    }
  
  //Validate Salutation
    function validateSalutation(salutation, errors) {
      validateField(salutation && !validSalutations.includes(salutation),
        "Invalid Salutation: " + salutation, errors);
    }
  //Validate Names 
    function validateNames(fields, data, errors) {
      fields.forEach((name) => {
        validateField(data[name] && !isAlphabets(data[name]),
          name.charAt(0).toUpperCase() + name.slice(1) + " should contain only alphabets.", errors);
      });
    }
  //Validate Email
    function validateEmail(email, errors) {
      validateField(email && !isValidEmail(email), "Invalid email: " + email, errors);
    }

    //Validate Website
  function validateWebsite(website, errors) {
    validateField(website && !isValidURL(website), "Invalid Website: " + website, errors);
  }
  //Validate Phones
    function validatePhones(fields, data, errors) {
      fields.forEach((phone) => {
        validateField(data[phone] && !isInteger(data[phone]),
          phone.charAt(0).toUpperCase() + phone.slice(1) + " should contain only digits: " + data[phone], errors);
      });
    }
  //Valid Alphanumeric Fields
    function validateAlphanumericFields(fields, data, errors) {
      fields.forEach((field) => {
        console.log(data)
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
  
  //Validate Tax Type
    function validateTaxType(taxType, validTaxTypes, errors) {
      validateField(taxType && !validTaxTypes.includes(taxType),
        "Invalid Tax Type: " + taxType, errors);
    }
  // Validate Place Of Supply
    function validateSourceOfSupply(sourceOfSupply, organization, errors) {
      if (sourceOfSupply && !validCountries[organization.organizationCountry]?.includes(sourceOfSupply)) {
        errors.push("Invalid Source of Supply: " + sourceOfSupply);
      }
    }
  // Validate GST or VAT details
  function validateGSTorVAT(data, errors) {
    switch (data.taxType) {
      case "GST":
        validateGSTDetails(data, errors);
        break;
      case "VAT":
        validateVATDetails(data, errors);
        break;
      case "None":
        clearTaxFields(data);
        break;
    }
  }
  
  // Validate GST details
  function validateGSTDetails(data, errors) {
    validateField(
      data.gstTreatment && !validGSTTreatments.includes(data.gstTreatment),
      `Invalid GST treatment: ${data.gstTreatment}`, 
      errors
    );
    validateField(
      data.gstin_uin && !isAlphanumeric(data.gstin_uin),
      `Invalid GSTIN/UIN: ${data.gstin_uin}`, 
      errors
    );
  }
  
  // Validate VAT details
  function validateVATDetails(data, errors) {
    validateField(
      data.vatNumber && !isAlphanumeric(data.vatNumber),
      `Invalid VAT number: ${data.vatNumber}`, 
      errors
    );
  }
  
  // Clear tax fields when no tax is applied
  function clearTaxFields(data) {
    ['gstTreatment', 'gstin_uin', 'vatNumber', 'sourceOfSupply'].forEach(field => {
      data[field] = undefined;
    });
  }
  //Validate Currency
  function validateCurrency(currency, validCurrencies, errors) {
    validateField(currency && !validCurrencies.includes(currency), "Invalid Currency: " + currency, errors);
  }
  // Validate billing address
  function validateBillingAddress(data, errors) {
    const country = data.billingCountry, state = data.billingState;
    validateField(country && state && !validCountries[country]?.includes(state),
      `Invalid Billing Country or State: ${country}, ${state}`, errors);
  
    validateAddressFields('billing', data, errors);
  }
  
  // Validate shipping address
  function validateShippingAddress(data, errors) {
    const country = data.shippingCountry, state = data.shippingState;
  
    validateField(country && state && !validCountries[country]?.includes(state),
      `Invalid Shipping Country or State: ${country}, ${state}`, errors);
  
    validateAddressFields('shipping', data, errors);
  }
  
  // Validate common address fields
  function validateAddressFields(type, data, errors) {
    ['PinCode', 'Phone', 'FaxNumber'].forEach(field => {
      const value = data[`${type}${field}`];
      validateField(value && !isInteger(value),
        `Invalid ${capitalize(type)} ${formatCamelCase(field)}: ${value}`, errors);
    });
  }
  function validateContactPerson(contactPersons, errors) {
 
    // Iterate through each item to validate individual fields
    contactPersons.forEach((contactPerson) => {
  
      validateSalutation(contactPerson.salutation, errors);
  
      validateAlphabetsFields(['firstName','lastName'], contactPerson, errors);
  
      validateEmail(contactPerson.email, errors);
  
      validatePhones(['mobile','workPhone'], contactPerson, errors);
  
      });
  }
  
  function validateBankDetails(bankDetails, errors) {
 
    // Iterate through each item to validate individual fields
    bankDetails.forEach((bankDetail) => {
  
      validateAlphanumericFields(['ifscCode'], bankDetail, errors);

      validateAlphabetsFields(['accountHolderName','bankName'], bankDetail, errors);
  
      validateEmail(bankDetail.email, errors);
  
      validatePhones( ['accountNum'], bankDetail, errors);
  
      });
  }


  // Helper functions to handle formatting
  function capitalize(word) {
    return word.charAt(0).toUpperCase() + word.slice(1);
  }
  function formatCamelCase(word) {
    return word.replace(/([A-Z])/g, " $1");
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
  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }
  function isValidURL(value) {
    return /^(https?:\/\/)?([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(\/[^\s]*)?$/.test(value);
  }
  