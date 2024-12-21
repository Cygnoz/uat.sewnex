// v1.0

const Organization = require("../database/model/organization");
const Account = require("../database/model/account");
const Customer = require("../database/model/customer");
const Tax = require("../database/model/tax");
const Currency = require("../database/model/currency");
const moment = require("moment-timezone");
const TrialBalance = require("../database/model/trialBalance");
const CustomerHistory = require("../database/model/customerHistory");
const Settings = require("../database/model/settings")
  





exports.getCustomerTransactions = async (req, res) => {
  try {
      const { customerId } = req.params;
      const { organizationId } = req.user; 

    console.log(organizationId,customerId)
      // Step 1: Find the customer's account code in the Account collection
      const customer = await Customer.findOne({ _id:customerId, organizationId});
      if (!customer) {
          return res.status(404).json({ message: "Customer not found" });
      }
      //console.log("Customer",customer)

      const account = await Account.findOne({ accountCode: customerId , organizationId });
      if (!account) {
          return res.status(404).json({ message: "Account not found for this customer" });
      }
      //console.log("Account",account)

      // Step 2: Use account _id to find matching transactions in the TrialBalance collection
      const customerTransactions = await TrialBalance.find({ accountId: account._id , organizationId });
      //console.log("Trialbalance ",customerTransactions)

      // Step 3: Send the customer transactions as a response
      return res.status(200).json({ customerTransactions });
  } catch (error) {
      console.error("Error fetching customer transactions:", error);
      return res.status(500).json({ message: "Internal server error" });
  }
};




// Fetch existing data
const dataExist = async ( organizationId, customerId) => {
    const [organizationExists, taxExists, currencyExists, settings, allCustomer, accountExist ] = await Promise.all([
      Organization.findOne({ organizationId },{ timeZoneExp: 1, dateFormatExp: 1, dateSplit: 1, organizationCountry: 1 }),
      Tax.findOne({ organizationId },{ taxType: 1 }),
      Currency.find({ organizationId }, { currencyCode: 1, _id: 1 }),
      Settings.find({ organizationId },{ duplicateCustomerDisplayName: 1, duplicateCustomerEmail: 1, duplicateCustomerMobile: 1 }),
      Customer.find({ organizationId }),
      Account.findOne({ accountId: customerId }),
    ]);
    
    return { organizationExists, taxExists, currencyExists, settings, allCustomer, accountExist };
  };

// Fetch Trial Balance
const trialBalanceExist = async (organizationId,customerId) => {
  const [trailbalance ] = await Promise.all([
    TrialBalance.findOne({ organizationId, operationId: customerId}),
  ]);
  return { trailbalance };
};



// Add Customer
exports.addCustomer = async (req, res) => {
    console.log("Add Customer:", req.body);
    try {
      const { organizationId, id: userId, userName } = req.user; 
      
      //Clean Data
      const cleanedData = cleanCustomerData(req.body);
      cleanedData.contactPerson = cleanedData.contactPerson?.map(person => cleanCustomerData(person)) || [];

      const { customerEmail, debitOpeningBalance, creditOpeningBalance, customerDisplayName, mobile } = cleanedData;
  
      const { organizationExists, taxExists, currencyExists, allCustomer , settings } = await dataExist( organizationId, null );
      
      // checking values from Customer settings
      const { duplicateCustomerDisplayName , duplicateCustomerEmail , duplicateCustomerMobile } = settings[0]
        
      //Data Exist Validation
      if (!validateOrganizationTaxCurrency(organizationExists, taxExists, currencyExists, res)) return;     
  
      //Date & Time
      const openingDate = generateOpeningDate(organizationExists);

      //Validate Inputs  
      if (!validateInputs(cleanedData, currencyExists, taxExists, organizationExists, res)) return;

      //Duplication Check
      const errors = [];
      const duplicateCheck = { duplicateCustomerDisplayName, duplicateCustomerEmail, duplicateCustomerMobile };

      await checkDuplicateCustomerFields( duplicateCheck, customerDisplayName, customerEmail, mobile, organizationId, errors);  
      if (errors.length) {
      return res.status(409).json({ message: errors }); }

      const savedCustomer = await createNewCustomer(cleanedData, organizationId);
      
      const savedAccount = await createNewAccount(customerDisplayName, openingDate, organizationId, allCustomer , savedCustomer );
  
      await saveTrialBalanceAndHistory(savedCustomer, savedAccount, debitOpeningBalance, creditOpeningBalance, userId, userName);
  
      console.log("Customer & Account created successfully");
      res.status(201).json({ message: "Customer created successfully." });
    } catch (error) {
      console.error("Error creating customer:", error);
      res.status(500).json({ message: "Internal server error." });
    }
  };


// Edit Customer
exports.editCustomer = async (req, res) => {
    console.log("Edit Customer:", req.body);
    try {
      const { organizationId, id: userId, userName } = req.user;

      const cleanedData = cleanCustomerData(req.body);
      cleanedData.contactPerson = cleanedData.contactPerson?.map(person => cleanCustomerData(person)) || [];

      const { customerId } = req.params;
  
      const { customerDisplayName ,customerEmail ,mobile} = cleanedData;
  
      const { organizationExists, taxExists, currencyExists ,settings, accountExist} = await dataExist( organizationId, customerId );

      const { trailbalance } = await trialBalanceExist(organizationId,customerId);
      
      //Checking values from Customer settings
      const { duplicateCustomerDisplayName , duplicateCustomerEmail , duplicateCustomerMobile } = settings[0]
       
      if (!validateOrganizationTaxCurrency(organizationExists, taxExists, currencyExists, res)) return;
      
      const openingDate = generateOpeningDate(organizationExists);
  
      const existingCustomer = await Customer.findById(customerId);
      if (!existingCustomer) {
        console.log("Customer not found with ID:", customerId);
        return res.status(404).json({ message: "Customer not found" });
      }
  
      
      if (!validateInputs(cleanedData, currencyExists, taxExists, organizationExists, res)) return;
      const errors = [];
      const duplicateCheck = { duplicateCustomerDisplayName, duplicateCustomerEmail, duplicateCustomerMobile };
      
      await checkDuplicateCustomerFieldsEdit( duplicateCheck, customerDisplayName, customerEmail, mobile, organizationId,customerId, errors);  
      if (errors.length) {
        return res.status(409).json({ message: errors }); }
        
      //Opening balance
      editOpeningBalance(existingCustomer, cleanedData);
      await updateOpeningBalance(trailbalance, cleanedData);
        
      //Account Name
      const oldCustomerDisplayName = existingCustomer.customerDisplayName;
      if(oldCustomerDisplayName !== customerDisplayName){
      await updateAccount(cleanedData,accountExist);
      }
        

  
      // Update customer fields
      Object.assign(existingCustomer, cleanedData);
      const savedCustomer = await existingCustomer.save();
  
      if (!savedCustomer) {
        console.error("Customer could not be saved.");
        return res.status(500).json({ message: "Failed to Update Customer." });
      }
  
      
  
      // Add entry to Customer History
      const accountCustomerHistoryEntry = new CustomerHistory({
        organizationId,
        operationId: savedCustomer._id,
        customerId,
        customerDisplayName: savedCustomer.customerDisplayName,
        date: openingDate,
        title: "Customer Data Modified",
        description: `${savedCustomer.customerDisplayName} Account Modified by ${userName}`,

        userId: userId,
        userName: userName,
      });
  
      await accountCustomerHistoryEntry.save();
  
      res.status(200).json({
        message: "Customer updated successfully.",
      });
      console.log("Customer updated successfully:", savedCustomer);
    } catch (error) {
      console.error("Error updating customer:", error);
      res.status(500).json({ message: "Internal server error." });
    }
  };

  // Get All Customer for a given organizationId
exports.getAllCustomer = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;

    const { organizationExists, allCustomer } = await dataExist( organizationId, null);

    if (!organizationExists) {
      return res.status(404).json({
        message: "Organization not found",
      });
    }

    if (!allCustomer.length) {
      return res.status(404).json({
        message: "No Customer found",
      });
    }

  
    allCustomer.forEach(customer => {
      if (customer.createdDateTime ) {   
        let dateTime = moment(customer.createdDateTime).tz(organizationExists.timeZoneExp);
        customer.createdDate = dateTime.format(organizationExists.dateFormatExp); 
        customer.createdDate = customer.createdDate.replace(/\//g, organizationExists.dateSplit); 
        customer.createdTime = dateTime.format('hh:mm:ss A');  
      }
    });
    

    res.status(200).json(allCustomer);
  } catch (error) {
    console.error("Error fetching customer:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};


// exports.getAllCustomer = async (req, res) => {
//   try {
//     const organizationId = req.user.organizationId;
//     const { page = 1, limit = 10 } = req.query;

//     const { organizationExists, allCustomer } = await dataExist(organizationId);

//     if (!organizationExists) {
//       return res.status(404).json({
//         message: "Organization not found",
//       });
//     }

//     if (!allCustomer.length) {
//       return res.status(404).json({
//         message: "No customers found",
//       });
//     }

//     // Pagination calculation
//     const startIndex = (parseInt(page, 10) - 1) * parseInt(limit, 10);
//     const paginatedCustomers = allCustomer.slice(startIndex, startIndex + parseInt(limit, 10));

//     res.status(200).json({
//       success: true,
//       data: paginatedCustomers,
//       totalCustomers: allCustomer.length,
//       currentPage: parseInt(page, 10),
//       totalPages: Math.ceil(allCustomer.length / limit)
//     });
//   } catch (error) {
//     console.error("Error fetching customers:", error);
//     res.status(500).json({ message: "Internal server error." });
//   }
// };  



//Get one Customer for a given organizationId
exports.getOneCustomer = async (req, res) => {
  try {
    const { customerId } = req.params;
    const organizationId = req.user.organizationId;

    const {organizationExists} = await dataExist( organizationId, null);

    if (!organizationExists) {
      return res.status(404).json({
        message: "Organization not found",
      });
    }

    // Find the Customer by CustomerId and organizationId
    const customers = await Customer.findOne({
      _id: customerId,
      organizationId: organizationId},{organizationId : 0}
    );

    if (!customers) {
      return res.status(404).json({
        message: "Customer not found",
      });
    }

    res.status(200).json(customers);
  } catch (error) {
    console.error("Error fetching customer:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

// Update the status of a Customer based on the provided status value
exports.updateCustomerStatus = async (req, res) => {
  console.log("Update Customer Status:", req.body);
  try {
    const { customerId } = req.params;
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
    const customer = await Customer.findOne({
      _id: customerId,
      organizationId: organizationId,
    });
    if (!customer) {
      return res.status(404).json({
        message: "Customer not found",
      });
    }
    const openingDate = generateOpeningDate(organizationExists);
    // Update the customer status with the value provided by the frontend
    customer.status = status;

    // Save the updated customer
    await customer.save();
    // Add entry to Customer History
       const accountCustomerHistoryEntry = new CustomerHistory({
        organizationId,
        operationId: customer._id,
        customerId,
        customerDisplayName: customer.customerDisplayName,
        date: openingDate,
        title: "customer Status Modified",
        description: `customer status updated to ${status} by ${userName}`,

        userId: userId,
        userName: userName,
      });
  
      await accountCustomerHistoryEntry.save();

    res.status(200).json({
      message: "Customer status updated successfully.",
      status: customer.status,
    });
    console.log("Customer status updated successfully.");
  } catch (error) {
    console.error("Error updating customer status:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

// Customer Additional data
exports.getCustomerAdditionalData = async (req, res) => {
  const organizationId = req.user.organizationId;
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
    };

    // Return the combined response data
    return res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching customer additional data:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

//Get One Customer History for a given organizationId
exports.getOneCustomerHistory = async (req, res) => {
  try {
    const { customerId } = req.params;
    const organizationId = req.user.organizationId;
    const {organizationExists} = await dataExist( organizationId, null );

    if (!organizationExists) {
      return res.status(404).json({
        message: "Organization not found",
      });
    }

    // Find the Customer History by CustomerId and organizationId
    const customersHistory = await CustomerHistory.find({
      customerId,
      organizationId,
    });

    if (!customersHistory) {
      return res.status(404).json({
        message: "Customer History not found",
      });
    }

    res.status(200).json(customersHistory);
  } catch (error) {
    console.error("Error fetching customer:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};









  // Utility Functions
  const validSalutations = ["Mr.", "Mrs.", "Ms.", "Miss.", "Dr."];
  const validCustomerTypes = ["Individual", "Business"];
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
  function cleanCustomerData(data) {
    const cleanData = (value) => (value === null || value === undefined || value === "" ? undefined : value);
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
async function checkDuplicateCustomerFields( duplicateCheck, customerDisplayName, customerEmail, mobile, organizationId, errors ) {
          const checks = [
            {
              condition: duplicateCheck.duplicateCustomerDisplayName && customerDisplayName !== undefined,
              field: 'customerDisplayName',
              value: customerDisplayName,
              errorMessage: `Customer with the provided display name already exists: ${customerDisplayName}`,
            },
            {
              condition: duplicateCheck.duplicateCustomerEmail && customerEmail !== undefined,
              field: 'customerEmail',
              value: customerEmail,
              errorMessage: `Customer with the provided email already exists: ${customerEmail}`,
            },
            {
              condition: duplicateCheck.duplicateCustomerMobile && mobile !== undefined,
              field: 'mobile',
              value: mobile,
              errorMessage: `Customer with the provided phone number already exists: ${mobile}`,
            },
          ];

          for (const { condition, field, value, errorMessage } of checks) {
            if (condition) {
              const existingRecord = await Customer.findOne({ [field]: value, organizationId });
              if (existingRecord) {
                errors.push(errorMessage);
              }
            }
          }

          
        }

//Duplication check for edit item 
async function checkDuplicateCustomerFieldsEdit(duplicateCheck,customerDisplayName, customerEmail, mobile, organizationId,customerId, errors ) {
          const checks = [
            {
              condition: duplicateCheck.duplicateCustomerDisplayName && customerDisplayName !== undefined,
              field: 'customerDisplayName',
              value: customerDisplayName,
              errorMessage: `Customer with the provided display name already exists: ${customerDisplayName}`,
            },
            {
              condition: duplicateCheck.duplicateCustomerEmail && customerEmail !== undefined,
              field: 'customerEmail',
              value: customerEmail,
              errorMessage: `Customer with the provided email already exists: ${customerEmail}`,
            },
            {
              condition: duplicateCheck.duplicateCustomerMobile && mobile !== undefined,
              field: 'mobile',
              value: mobile,
              errorMessage: `Customer with the provided phone number already exists: ${mobile}`,
            },
          ];
        
          for (const { condition, field, value, errorMessage } of checks) {
            if (condition) {
              // Modify query to exclude the supplier with the given supplierId
              const existingRecord = await Customer.findOne({
                [field]: value,
                organizationId,
                _id: { $ne: customerId }, // Exclude the document with the same supplierId
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
    const validationErrors = validateCustomerData(data, validCurrencies, validTaxTypes, organizationExists,taxExists.taxType);
  
    if (validationErrors.length > 0) {
      res.status(400).json({ message: validationErrors.join(", ") });
      return false;
    }
    return true;
  }

// Create New Customer
  function createNewCustomer(data,organizationId) {
    const newCustomer = new Customer({ ...data, organizationId, status: "Active" });
    return newCustomer.save();
  }
  
// Create New Account
  function createNewAccount( customerDisplayName, openingDate, organizationId, allCustomer ,savedCustomer ) {

    // Count existing organizations to generate the next organizationId

    const nextIdNumber = allCustomer.length + 1;    
    const count = `CU${nextIdNumber.toString().padStart(4, '0')}`;


    const newAccount = new Account({
      organizationId,
      accountName: customerDisplayName,
      accountCode: count,
      accountId: savedCustomer._id,
      accountSubhead: "Sundry Debtors",
      accountHead: "Asset",
      accountGroup: "Asset",
      openingDate,
      description: "Customer",
    });
    return newAccount.save();
  }
  
// TrialBalance And History
async function saveTrialBalanceAndHistory(savedCustomer, savedAccount, debitOpeningBalance, creditOpeningBalance,userId, userName) {
    const trialEntry = new TrialBalance({
      organizationId: savedCustomer.organizationId,
      operationId: savedCustomer._id,
      date: savedCustomer.createdDate,
      accountId: savedAccount._id,
      accountName: savedAccount.accountName,
      action: "Opening Balance",
      debitAmount: debitOpeningBalance,
      creditAmount: creditOpeningBalance,
      remark: savedCustomer.remark,
    });
    await trialEntry.save();
  
    const customerHistory = createCustomerHistory(savedCustomer, savedAccount,userId, userName);
    await CustomerHistory.insertMany(customerHistory);
  }
  
  
// Create Customer History
function createCustomerHistory(savedCustomer, savedAccount,userId, userName) {
    const taxDescription = getTaxDescription(savedCustomer, userName);
    const openingBalanceDescription = getOpeningBalanceDescription( savedCustomer, userName);
  
    return [
      {
        organizationId: savedCustomer.organizationId,
        operationId: savedCustomer._id,
        customerId: savedCustomer._id,
        customerDisplayName: savedCustomer.customerDisplayName,
        date: savedCustomer.createdDate,
        title: "Customer Added",
        description: taxDescription,
        userId: userId,
        userName: userName,
      },
      {
        organizationId: savedCustomer.organizationId,
        operationId: savedAccount._id,
        customerId: savedCustomer._id,
        customerDisplayName: savedCustomer.customerDisplayName,
        date: savedCustomer.createdDate,
        title: "Customer Account Created",
        description: openingBalanceDescription,
        userId: userId,
        userName: userName,
      },
    ];
  }
  

// Tax Description  
function getTaxDescription(data, userName) {
  const descriptionBase = `${data.customerDisplayName || 'Unknown Customer'} Contact created with `;
  
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
    return `${descriptionBase}No Tax applicable. Created by ${userName || 'Unknown User'}`;
  }
}

// GST Description
function createGSTDescription({ gstTreatment, gstin_uin, placeOfSupply }) {
  const details = {
    'GST Treatment': gstTreatment,
    'GSTIN': gstin_uin,
    'State': placeOfSupply
  };

  const description = Object.entries(details)
    .filter(([, value]) => value)
    .map(([key, value]) => `${key}: ${value}`)
    .join(' , ');

  return description ? `${description}.` : "Incomplete GST information.";
}

// VAT Description
function createVATDescription({ vatNumber }) {
  return vatNumber 
    ? `VAT Number '${vatNumber}'. `
    : "Incomplete VAT information. "; // Handle incomplete data case
}

// Tax Exemption Description
function createTaxExemptionDescription() {
  return "Tax Exemption. ";
}


// Opening Balance Description
function getOpeningBalanceDescription(data, userName) {
  let balanceType = "";
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
    balanceType = `Opening Balance : 0`;
  }

  // Return description if there's a balance
  return `${data.customerDisplayName || 'Unknown Customer'} Account created with ${balanceType}, Created by ${userName || 'Unknown User'}`;
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


//Edit Opening Balance
function editOpeningBalance(existingCustomer, cleanedData) {
  if (existingCustomer.debitOpeningBalance && cleanedData.creditOpeningBalance) {
    cleanedData.debitOpeningBalance = undefined;
  } else if (existingCustomer.creditOpeningBalance && cleanedData.debitOpeningBalance) {
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

    Object.assign(existingTrialBalance, trialEntry);
    const savedTrialBalance = await existingTrialBalance.save();

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
    
    let accountName = { accountName: cleanedData.customerDisplayName };

    Object.assign(accountExist, accountName);
    const savedAccount = await accountExist.save();
    console.log("Account name updated successfully:", savedAccount);
    

    return savedAccount;
  } catch (error) {
    console.error("Error updating account name:", error);
    throw error;
  }
}















  





//Validate Data
  function validateCustomerData(data, validCurrencies, validTaxTypes, organization,taxType) {
    const errors = [];

    //Basic Info
    validateReqFields( data, taxType, organization, errors);
    validInterestPercentage ( data.interestPercentage,  errors);
    validateCustomerType(data.customerType, errors);
    validateSalutation(data.salutation, errors);
    validateNames(['firstName', 'lastName'], data, errors);
    validateEmail(data.customerEmail, errors);
    validateWebsite(data.websiteURL, errors);
    validateContactPerson(data.contactPerson, errors);
    validatePhones(['workPhone', 'mobile', 'cardNumber','billingFaxNumber','shippingFaxNumber'], data, errors);
    validateOpeningBalance(data,  errors);

    //OtherDetails
    validateAlphanumericFields(['pan','gstin_uin','vatNumber'], data, errors);
    validateIntegerFields(['creditDays', 'creditLimits'], data, errors);
    validateFloatFields(['debitOpeningBalance', 'creditOpeningBalance', 'interestPercentage'], data, errors);
    validateAlphabetsFields(['department', 'designation','billingAttention','shippingAttention'], data, errors);

    //Tax Details
    validateTaxType(data.taxType, validTaxTypes, errors);
    validatePlaceOfSupply(data.placeOfSupply, organization, errors);
    validateGSTorVAT(data, errors);

    //Currency
    validateCurrency(data.currency, validCurrencies, errors);

    //Address
    validateBillingAddress(data, errors);
    validateShippingAddress(data, errors);  
    return errors;
  }
  
// Field validation utility
function validateField(condition, errorMsg, errors) {
    if (condition) errors.push(errorMsg);
}
//Valid Req Fields
function validateReqFields( data, taxType, organization, errors ) {
  validateField( typeof data.customerDisplayName === 'undefined', `Customer Display Name required`, errors );  
  validateField( typeof taxType === 'undefined' || taxType === '' , `Please setup tax`, errors );  
  validateField( data.billingCountry !== organization.organizationCountry , `Invalid Billing Country`, errors );    
}
//Valid Opening Balance
function validateOpeningBalance( data, errors ) {
  validateField( typeof data.debitOpeningBalance !== 'undefined' && typeof data.creditOpeningBalance !== 'undefined' , `Select Credit or Debit Opening Balance`, errors );  
}
//Valid interest percentage
function validInterestPercentage( interestPercentage, errors ) {
  interestPercentage = parseFloat(interestPercentage);
  validateField( interestPercentage > 100, `Interest Percentage cannot exceed 100%`, errors );  
}


//Valid Customer Type
  function validateCustomerType(customerType, errors) {
    validateField(customerType && !validCustomerTypes.includes(customerType),"Invalid Customer type: " + customerType, errors);
  }
//Validate Salutation
  function validateSalutation(salutation, errors) {
    validateField(salutation && !validSalutations.includes(salutation),"Invalid Salutation: " + salutation, errors);
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
    validateField(taxType && !validTaxTypes.includes(taxType),"Invalid Tax Type: " + taxType, errors);
  }
// Validate Place Of Supply
  function validatePlaceOfSupply(placeOfSupply, organization, errors) {
    validateField(placeOfSupply && !validCountries[organization.organizationCountry]?.includes(placeOfSupply),"Invalid Place of Supply: " + placeOfSupply, errors);
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
  }
}

// Validate GST details
function validateGSTDetails(data, errors) {
  validateField( typeof data.gstTreatment === 'undefined', `Select a GST Treatment`, errors );
  validateField( typeof data.placeOfSupply === 'undefined', `Place Of Supply required`, errors );  
  validateField( data.gstTreatment && !validGSTTreatments.includes(data.gstTreatment), `Invalid GST treatment: ${data.gstTreatment}`, errors );
  validateField( data.gstin_uin && !isAlphanumeric(data.gstin_uin), `Invalid GSTIN/UIN: ${data.gstin_uin}`, errors );
  

  validateField( data.gstTreatment ==="Registered Business - Regular" && typeof data.gstin_uin === 'undefined', `Enter GSTIN/UIN Number`, errors );
  validateField( data.gstTreatment ==='Registered Business - Composition' && typeof data.gstin_uin === 'undefined' , `Enter GSTIN/UIN Number`, errors );
  validateField( data.gstTreatment ==='Special Economic Zone' && typeof data.gstin_uin === 'undefined' , `Enter GSTIN/UIN Number`, errors );
  validateField( data.gstTreatment ==='Deemed Export' && typeof data.gstin_uin === 'undefined' , `Enter GSTIN/UIN Number`, errors );
  validateField( data.gstTreatment ==='Tax Deductor' && typeof data.gstin_uin === 'undefined' , `Enter GSTIN/UIN Number`, errors );
  validateField( data.gstTreatment ==='SEZ Developer' && typeof data.gstin_uin === 'undefined' , `Enter GSTIN/UIN Number`, errors );

}

// Validate VAT details
function validateVATDetails(data, errors) {
  validateField( data.vatNumber && !isAlphanumeric(data.vatNumber), `Invalid VAT number: ${data.vatNumber}`, errors );
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

// Function to Validate Item Table 
function validateContactPerson(contactPerson, errors) {
 
  // Iterate through each item to validate individual fields
   contactPerson.forEach((contactPerson) => {

    validateSalutation(contactPerson.salutation, errors);

    validateAlphabetsFields(['firstName','lastName'], contactPerson, errors);

    validateEmail(contactPerson.email, errors);

    validatePhones(['mobile'], contactPerson, errors);

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
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/i.test(value);
}
function isValidURL(value) {
  return /^(https?:\/\/)?([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(\/[^\s]*)?$/.test(value);
}
