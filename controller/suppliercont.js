const Organization = require("../database/model/organization");
const Account = require("../database/model/account");
const Supplier = require("../database/model/supplier");
const Tax = require("../database/model/tax");
const Currency = require("../database/model/currency");
const moment = require("moment-timezone");
const TrialBalance = require("../database/model/trialBalance");
const SupplierHistory = require("../database/model/supplierHistory");
const Settings = require("../database/model/settings")
// Fetch existing data

exports.getSupplierTransactions = async (req, res) => {
  try {
      const { supplierId } = req.params;
      const { organizationId, id: userId, userName } = req.user; 

      const supplier = await Supplier.findOne({ _id:supplierId, organizationId});
      if (!supplier) {
          return res.status(404).json({ message: "Supplier not found" });
      }

      const account = await Account.findOne({ accountId: supplierId , organizationId });
      if (!account) {
          return res.status(404).json({ message: "Account not found for this Supplier" });
      }

      const supplierTransactions = await TrialBalance.find({ accountId: account._id , organizationId });

      return res.status(200).json({ supplierTransactions });
  } catch (error) {
      console.error("Error fetching customer transactions:", error);
      return res.status(500).json({ message: "Internal server error" });
  }
};



const dataExist = async (organizationId) => {
    const [organizationExists, taxExists, currencyExists, allSupplier ,settings] = await Promise.all([
      Organization.findOne({ organizationId },{ timeZoneExp: 1, dateFormatExp: 1, dateSplit: 1, organizationCountry: 1 }),
      Tax.findOne({ organizationId },{ taxType: 1 }),
      Currency.find({ organizationId }, { currencyCode: 1, _id: 0 }),
      Supplier.find({ organizationId }),
      Settings.find({ organizationId },{ duplicateSupplierDisplayName: 1, duplicateSupplierEmail: 1, duplicateSupplierMobile: 1 })
    ]);
    return { organizationExists, taxExists, currencyExists, allSupplier , settings };
  };

//   const dataExistsExclude = async (organizationId, supplierId) => {
//     const allSuppliers = await Supplier.find({ organizationId, _id: { $ne: supplierId } });
//     return allSuppliers;
// };
  
    // Add Customer
    exports.addSupplier = async (req, res) => {
      try {
        const { organizationId, id: userId, userName } = req.user;
  
        //Clean Data
        const cleanedData = cleanSupplierData(req.body);

        cleanedData.contactPersons = cleanedData.contactPersons?.map(person => cleanSupplierData(person)) || [];
        cleanedData.bankDetails = cleanedData.bankDetails?.map(bankDetail => cleanSupplierData(bankDetail)) || [];

  
        const { supplierEmail, debitOpeningBalance, creditOpeningBalance, supplierDisplayName, mobile } = cleanedData;
    
        const { organizationExists, taxExists, currencyExists , allSupplier, settings} = await dataExist(organizationId);
        
        // checking values from supplier settings
        const { duplicateSupplierDisplayName , duplicateSupplierEmail , duplicateSupplierMobile } = settings[0]
        
        //Data Exist Validation
        if (!validateOrganizationTaxCurrency(organizationExists, taxExists, currencyExists, res)) return;     
    
        //Date & Time
        const openingDate = generateOpeningDate(organizationExists);
  
        //Validate Inputs  
        if (!validateInputs(cleanedData, currencyExists, taxExists, organizationExists, res)) return;
  
        //Duplication Check
        const errors = [];
        const duplicateCheck = { duplicateSupplierDisplayName, duplicateSupplierEmail, duplicateSupplierMobile };

        await checkDuplicateSupplierFields( duplicateCheck, supplierDisplayName, supplierEmail, mobile, organizationId, errors);  
        if (errors.length) {
        return res.status(409).json({ message: errors }); }
  
        const savedSupplier = await createNewSupplier(cleanedData, openingDate, organizationId);
        
        const savedAccount = await createNewAccount(supplierDisplayName, openingDate, organizationId, allSupplier , savedSupplier);
    
        await saveTrialBalanceAndHistory(savedSupplier, savedAccount, debitOpeningBalance, creditOpeningBalance, cleanedData, openingDate, userId, userName );
    
        console.log("Supplier & Account created successfully");
        res.status(201).json({ message: "Supplier created successfully." });
      } catch (error) {
        console.error("Error creating Supplier:", error);
        res.status(500).json({ message: "Internal server error." });
      }
    };
  
    // Edit Customer
  exports.updateSupplier = async (req, res) => {
      try {
        const { organizationId, id: userId, userName } = req.user;
        const duplicateSupplierDisplayName = true;
        const duplicateSupplierEmail = false;
        const duplicateSupplierMobile = false;

        const cleanedData = cleanSupplierData(req.body);
  
        const {   supplierId } = req.params;
    
        const { supplierDisplayName, supplierEmail, mobile } = cleanedData;
    
        const { organizationExists, taxExists, currencyExists , settings} = await dataExist(organizationId);
        
         // checking values from supplier settings
        // const { duplicateSupplierDisplayName , duplicateSupplierEmail , duplicateSupplierMobile } = settings[0]
        
        
        if (!validateOrganizationTaxCurrency(organizationExists, taxExists, currencyExists, res)) return;
        
        const openingDate = generateOpeningDate(organizationExists);
    
        const existingSupplier = await Supplier.findById(  supplierId);
        if (!existingSupplier) {
          return res.status(404).json({ message: "Supplier not found" });
        }
    
        const oldsupplierDisplayName = existingSupplier.supplierDisplayName;
  
        if (!validateInputs(cleanedData, currencyExists, taxExists, organizationExists, res)) return;
  
        //Duplication Check
        const errors = [];
        const duplicateCheck = { duplicateSupplierDisplayName, duplicateSupplierEmail, duplicateSupplierMobile };

        await checkDuplicateSupplierFieldsEdit( duplicateCheck, supplierDisplayName, supplierEmail, mobile, organizationId,supplierId, errors);  
        if (errors.length) {
        return res.status(409).json({ message: errors }); }
        // Update customer fields
        Object.assign(existingSupplier, cleanedData);
        const savedSupplier = await existingSupplier.save();
    
        if (!savedSupplier) {
          console.error("Supplier could not be saved.");
          return res.status(500).json({ message: "Failed to Update Supplier." });
        }
    
        // Update supplierDisplayName in associated Account documents
        if (supplierDisplayName && supplierDisplayName !== oldsupplierDisplayName) {
          const updatedAccount = await Account.updateMany(
            {
              accountName: oldsupplierDisplayName,
              organizationId: organizationId,
            },
            { $set: { accountName: supplierDisplayName } }
          );
          console.log(
            `${updatedAccount.modifiedCount} account(s) associated with the accountName have been updated with the new supplierDisplayName.`
          );
        }
    
        // Add entry to Customer History
        const accountSupplierHistoryEntry = new SupplierHistory({
          organizationId,
          operationId: savedSupplier._id,
          supplierId,
          supplierDisplayName: savedSupplier.supplierDisplayName,
          date: openingDate,
          title: "supplier Data Modified",
          description: `Supplier data  Modified by ${userName}`,
  
          userId: userId,
          userName: userName,
        });
    
        await accountSupplierHistoryEntry.save();
    
        res.status(200).json({
          message: "supplier updated successfully.",
        });
      } catch (error) {
        console.error("Error updating supplier:", error);
        res.status(500).json({ message: "Internal server error." });
      }
    };

    // Get All Customer for a given organizationId
  exports.getAllSuppliers = async (req, res) => {
    try {
      const organizationId = req.user.organizationId;
  
      const { organizationExists, allSupplier } = await dataExist(organizationId);
  
      if (!organizationExists) {
        return res.status(404).json({
          message: "Organization not found",
        });
      }
  
      if (!allSupplier.length) {
        return res.status(404).json({
          message: "No Suppliers found",
        });
      }
      const AllSupplier = allSupplier.map((history) => {
        const { organizationId, ...rest } = history.toObject(); // Convert to plain object and omit organizationId
        return rest;
      });
  
      res.status(200).json(AllSupplier);
    } catch (error) {
      console.error("Error fetching Suppliers:", error);
      res.status(500).json({ message: "Internal server error." });
    }
  };
  
  //Get one Customer for a given organizationId
  exports.getOneSupplier = async (req, res) => {
    try {
      const {   supplierId } = req.params;
      const organizationId = req.user.organizationId;
  
      const {organizationExists} = await dataExist(organizationId);
  
      if (!organizationExists) {
        return res.status(404).json({
          message: "Organization not found",
        });
      }
  
      // Find the Customer by   supplierId and organizationId
      const supplier = await Supplier.findOne({
        _id:   supplierId,
        organizationId: organizationId,
      });
  
      if (!supplier) {
        return res.status(404).json({
          message: "supplier not found",
        });
      }
      supplier.organizationId = undefined;
      res.status(200).json(supplier);
    } catch (error) {
      console.error("Error fetching customer:", error);
      res.status(500).json({ message: "Internal server error." });
    }
  };
  
  // Update the status of a Customer based on the provided status value
  exports.updateSupplierStatus = async (req, res) => {
    try {
      const {   supplierId } = req.params;
      const {organizationId , userName , userId} = req.user;
      const { status } = req.body; // Status is now taken from the request body
  
      // Validate organizationId
      const organizationExists = await Organization.findOne({
        organizationId: organizationId,
      });
      if (!organizationExists) {
        return res.status(404).json({
          message: "Organization not found",
        });
      }
  
      // Check if the customer exists
      const supplier = await Supplier.findOne({
        _id:   supplierId,
        organizationId: organizationId,
      });
      if (!supplier) {
        return res.status(404).json({
          message: "supplier not found",
        });
      }
      const openingDate = generateOpeningDate(organizationExists);
      // Update the customer status with the value provided by the frontend
      supplier.status = status;
  
      // Save the updated customer
      await supplier.save();
       // Add entry to Customer History
       const accountSupplierHistoryEntry = new SupplierHistory({
        organizationId,
        operationId: supplier._id,
        supplierId,
        supplierDisplayName: supplier.supplierDisplayName,
        date: openingDate,
        title: "supplier Status Modified",
        description: `Supplier status updated to ${status} by ${userName}`,

        userId: userId,
        userName: userName,
      });
  
      await accountSupplierHistoryEntry.save();
      res.status(200).json({
        message: "Supplier status updated successfully.",
        status: supplier.status,
      });
      console.log("supplier status updated successfully.");
    } catch (error) {
      console.error("Error updating supplier status:", error);
      res.status(500).json({ message: "Internal server error." });
    }
  };
  
  // Customer Additional data
  exports.getSupplierAdditionalData = async (req, res) => {
    const  organizationId  = req.user.organizationId;
    try {
      // Check if an Organization already exists
      const organization = await Organization.findOne({ organizationId });
      if (!organization) {
        return res.status(404).json({
          message: "No Organization Found.",
        });
      }
  
      // Fetch tax data to check tax type
      const taxData = await Tax.findOne({ organizationId });
      if (!taxData) {
        return res.status(404).json({
          message: "No tax data found for the organization.",
        });
      }
      
      
      // Prepare the response object
      const response = {
        taxType: taxData.taxType,
        gstTreatment: [
          "Registered Business - Regular",
          "Registered Business - Composition",
          "Unregistered Business",
          "Consumer",
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
          // Define the data for percentages
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
  
  //Get One Customer History for a given organizationId
  exports.getOneSupplierHistory = async (req, res) => {
    try {
      const { supplierId } = req.params;
      // const { organizationId } = req.body;
      const  organizationId  = req.user.organizationId;
  
      const {organizationExists} = await dataExist(organizationId);
  
      if (!organizationExists) {
        return res.status(404).json({
          message: "Organization not found",
        });
      }
  
      // Find the Customer History by CustomerId and organizationId
      const supplierHistory = await SupplierHistory.find({
        supplierId,
        organizationId,
      });
      // remove sensitive data
      const sanitizedHistory = supplierHistory.map((history) => {
        const { organizationId, ...rest } = history.toObject(); // Convert to plain object and omit organizationId
        return rest;
      });
      if (!supplierHistory) {
        return res.status(404).json({
          message: "Supplier History not found",
        });
      }
  
      res.status(200).json(sanitizedHistory);
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
    
    //Clean Data 
    function cleanSupplierData(data) {
      const cleanData = (value) => (value === null || value === undefined || value === "" || value === 0 ? undefined : value);
      return Object.keys(data).reduce((acc, key) => {
        acc[key] = cleanData(data[key]);
        return acc;
      }, {});
    }
    
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
    
    //Return Date and Time 
    function generateOpeningDate(organizationExists) {
      const date = generateTimeAndDateForDB(
          organizationExists.timeZoneExp,
          organizationExists.dateFormatExp,
          organizationExists.dateSplit
        )
      return date.dateTime;
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
      const validTaxTypes = ["None", taxExists.taxType];
      const validationErrors = validateSupplierData(data, validCurrencies, validTaxTypes, organizationExists);
    
      if (validationErrors.length > 0) {
        res.status(400).json({ message: validationErrors.join(", ") });
        return false;
      }
      return true;
    }
  
  // Create New Customer
    function createNewSupplier(data, openingDate,organizationId) {
      const newSupplier = new Supplier({ ...data, organizationId, status: "Active", createdDate: openingDate, lastModifiedDate: openingDate });
      return newSupplier.save();
    }
    
    
  // Create New Account
    function createNewAccount(supplierDisplayName, openingDate, organizationId,   allSupplier , savedSupplier) {
      // Count existing organizations to generate the next organizationId

      const nextIdNumber = allSupplier.length + 1;    
      const count = `CU${nextIdNumber.toString().padStart(4, '0')}`;
      
      const newAccount = new Account({
        organizationId,
        accountName: supplierDisplayName,
        accountCode:   count,
        accountId: savedSupplier._id,
        accountSubhead: "Sundry Creditors",
        accountHead: "Liabilities",
        accountGroup: "Liability",
        openingDate,
        description: "Suppliers",
      });
      return newAccount.save();
    }
    
  // TrialBalance And History
  async function saveTrialBalanceAndHistory(savedSupplier, savedAccount, debitOpeningBalance, creditOpeningBalance, data, openingDate, userId, userName) {
      const trialEntry = new TrialBalance({
        organizationId: savedSupplier.organizationId,
        operationId: savedSupplier._id,
        date: openingDate,
        accountId: savedAccount._id,
        accountName: savedAccount.accountName,
        action: "Opening Balance",
        debitAmount: debitOpeningBalance,
        creditAmount: creditOpeningBalance,
        remark: data.remark,
      });
      await trialEntry.save();
    
      const supplierHistory = createSupplierHistory(savedSupplier, savedAccount, data, openingDate,userId,userName);
      await SupplierHistory.insertMany(supplierHistory);
    }
    
  // Create Customer History
  function createSupplierHistory(savedSupplier, savedAccount, data, openingDate,userId,userName) {
      const description = getTaxDescription(data, userName);
      const description1 = getOpeningBalanceDescription( data, userName);
    
      return [
        {
          organizationId: savedSupplier.organizationId,
          operationId: savedSupplier._id,
            supplierId: savedSupplier._id,
          supplierDisplayName: data.supplierDisplayName,
          date: openingDate,
          title: "Supplier Added",
          description,
          userId: userId,
          userName: userName,
        },
        {
          organizationId: savedSupplier.organizationId,
          operationId: savedAccount._id,
            supplierId: savedSupplier._id,
          supplierDisplayName: data.supplierDisplayName,
          date: openingDate,
          title: "Supplier Account Created",
          description: description1,
          userId: userId,
          userName: userName,
        },
      ];
    }
  
  // Tax Description
  function getTaxDescription(data, userName) {
      const descriptionBase = `${data.supplierDisplayName} Contact created with `;
      const taxDescriptionGenerators = {
        GST: () => createGSTDescription(data),
        VAT: () => createVATDescription(data),
        None: () => createTaxExemptionDescription(),
      };
    
      return taxDescriptionGenerators[data.taxType]?.() 
        ? descriptionBase + taxDescriptionGenerators[data.taxType]() + `
  Created by ${userName}` 
        : "";
    }
    //GST Description
    function createGSTDescription({ gstTreatment, gstin_uin, sourceOfSupply }) {
      return gstTreatment && gstin_uin && sourceOfSupply
        ? `
  GST Treatment '${gstTreatment}' & GSTIN '${gstin_uin}'. State updated to ${sourceOfSupply}. `
        : "";
    }
    //VAT Description
    function createVATDescription({ vatNumber, sourceOfSupply }) {
      return vatNumber && sourceOfSupply
        ? `VAT Number '${vatNumber}'. State updated to ${sourceOfSupply}. `
        : "";
    }
    //Tax empt Description
    function createTaxExemptionDescription() {
      return "Tax Exemption. ";
    }
    
  // Opening Balance Description
  function getOpeningBalanceDescription( data, userName) {
      const { supplierDisplayName } = data;
      const balanceDescription = data.debitOpeningBalance 
        ? `Opening Balance (Debit): '${data.debitOpeningBalance}'. `
        : data.creditOpeningBalance 
          ? `Opening Balance (Credit): '${data.creditOpeningBalance}'. `
          : "";
    
      return balanceDescription 
        ? `${supplierDisplayName} Account created with ${balanceDescription}Created by ${userName}` 
        : "";
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
      validateIntegerFields(['creditDays', 'creditLimits', 'interestPercentage'], data, errors);
      validateFloatFields(['debitOpeningBalance', 'creditOpeningBalance'], data, errors);
      validateAlphabetsFields(['department', 'designation','billingAttention','shippingAttention'], data, errors);
  
      //Tax Details
      validateTaxType(data.taxType, validTaxTypes, errors);
      validatesourceOfSupply(data.sourceOfSupply, organization, errors);
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
    function validatesourceOfSupply(sourceOfSupply, organization, errors) {
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
  