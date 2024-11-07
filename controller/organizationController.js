// v1.0

const Organization = require("../database/model/organization");
const Account = require("../database/model/account");
const Currency = require("../database/model/currency");
const TrialBalance = require("../database/model/trialBalance")
const moment = require("moment-timezone");





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



// Get all organizations - Internal
exports.getAllOrganization = async (req, res) => {
  try {
    const allOrganizations = await Organization.find();

    if (allOrganizations.length > 0) {
      //allOrganizations.organizationId = undefined;
      res.status(200).json(allOrganizations);
    } else {
      res.status(404).json("No organizations found");
    }
  } catch (error) {
    console.error(error);
    res.status(500).json("Internal server error");
  }
};

// get One organization
exports.getOneOrganization = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;

    const existingOrganization = await Organization.findOne({ organizationId });

    if (existingOrganization) {
      res.status(200).json(existingOrganization);
    } else {
      res.status(404).json({ message: "Organization not found" });
    }
  } catch (error) {
    console.error("Error fetching organization:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Delete Organization - Internal
exports.deleteOrganization = async (req, res) => {
  try {
    const { organizationId } = req.body;

    // Check if the organization exists
    const organization = await Organization.findOne({ organizationId });

    if (!organization) {
      return res.status(404).json({
        message: "Organization not found.",
      });
    }

    // Delete the organization
    await Organization.findByIdAndDelete({ organizationId });

    res.status(200).json({
      message: "Organization deleted successfully.",
    });
    console.log("Organization deleted successfully:", id);
  } catch (error) {
    console.error("Error deleting Organization:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

// Additional data
exports.getAdditionalData = (req, res) => {
  try {
    const additionalData = [
      {
        industry,
        financialYear,
        dateFormats,
        dateSplit,
        timezones,
        countriesData
      },
    ];

    if (additionalData.length > 0) {
      res.status(200).json(additionalData);
    } else {
      res.status(404).json("No Additional Data found");
    }
  } catch (error) {
    console.error(error);
    res.status(500).json("Internal server error");
  }
};

// Countries Data
exports.getCountriesData = (req, res) => {
  try {
    const countriesData = [
      {
        countries: [
          // {
          //   name: "United States",
          //   states: ["Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware", "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota", "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming"],
          //   phoneNumberCode: "+1",
          //   taxType:"GST"
          // },
          // {
          //   name: "Canada",
          //   states: ["Alberta", "British Columbia", "Manitoba", "New Brunswick", "Newfoundland and Labrador", "Northwest Territories", "Nova Scotia", "Nunavut", "Ontario", "Prince Edward Island", "Quebec", "Saskatchewan", "Yukon"],
          //   phoneNumberCode: "+1"
          // },
          {
            name: "India",
            states: ["Andaman and Nicobar Island", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chandigarh", "Chhattisgarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir", "Jharkhand", "Karnataka", "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal"],
            phoneNumberCode: "+91",
            flag:"https://flagicons.lipis.dev/flags/1x1/in.svg",
            phoneNumberLimit:10,
            taxType:"GST"
          },
          {
            name: "Saudi Arabia",
            states: ["Asir","Al Bahah", "Al Jawf", "Al Madinah", "Al-Qassim", "Eastern Province", "Hail", "Jazan", "Makkah","Medina", "Najran", "Northern Borders", "Riyadh", "Tabuk"],
            phoneNumberCode: "+966",
            flag:"https://flagicons.lipis.dev/flags/1x1/sa.svg",
            phoneNumberLimit:9,
            taxType:"VAT"
          },
          {
            name: "United Arab Emirates",
            states: ["Abu Dhabi", "Dubai", "Sharjah", "Ajman", "Umm Al-Quwain", "Fujairah", "Ras Al Khaimah"],
            phoneNumberCode: "+971",
            flag:"https://flagicons.lipis.dev/flags/1x1/ae.svg",
            phoneNumberLimit:9,
            taxType:"VAT"
          },
        ]
      }
    ];
    if (countriesData.length > 0) {
      res.status(200).json(countriesData);
    } else {
      res.status(404).json("No Additional Data found");
    }
  } catch (error) {
    console.error(error);
    res.status(500).json("Internal server error");
  }
};


// Setup organization
exports.setupOrganization = async (req, res) => {
  console.log("Setup Organization:", req.body);
  try {
    const organizationId = req.user.organizationId;

    //Clean Data
    const cleanedData = cleanCustomerData(req.body);

    const { timeZoneExp, dateFormatExp, dateSplit, baseCurrency } = cleanedData;


    const existingOrganization = await Organization.findOne({ organizationId });

    if (!existingOrganization) {
      return res.status(404).json({
        message: "No Organization Found.",
      });
    }

    const generatedDateTime = generateTimeAndDateForDB( timeZoneExp, dateFormatExp, dateSplit );

    const createdDateAndTime = generatedDateTime.dateTime;

    const currencyExists = await Currency.find({ organizationId }, { currencyCode: 1, _id: 0 });
    if (!currencyExists.length) {
      return res.status(404).json({
        message: "Currency not found",
      });
    }  
    
    //Validate data
    if (!validateInputs(cleanedData, currencyExists, existingOrganization, res)) return;


    // Update customer fields
    Object.assign(existingOrganization, cleanedData);
    const savedOrganization = await existingOrganization.save();

    if (!savedOrganization) {
      console.error("Organization could not be saved.");
      return res
        .status(500)
        .json({ message: "Failed to update organization." });
    }

    // Check and update baseCurrency in the currencies collection
    if (baseCurrency) {
      // Set all other currencies' baseCurrency to false for the same organizationId
      await Currency.updateMany(
        { organizationId, baseCurrency: true },
        { baseCurrency: false }
      );

      // Set the specific currency's baseCurrency to true
      await Currency.updateOne(
        { organizationId, currencyCode: baseCurrency },
        { baseCurrency: true }
      );
    }

    res.status(200).json({
      message: "Organization updated successfully.",
    });
    console.log("Organization updated successfully");

    const account = await Account.findOne({ organizationId });
    if (!account) {
      insertAccounts(accounts, organizationId, createdDateAndTime);
    }
  } catch (error) {
    console.error("Error updating Organization:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};





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

  //Clean Data 
  function cleanCustomerData(data) {
    const cleanData = (value) => (value === null || value === undefined || value === "" || value === 0 ? undefined : value);
    return Object.keys(data).reduce((acc, key) => {
      acc[key] = cleanData(data[key]);
      return acc;
    }, {});
  }

const countriesData = [
  {
    countries: [
      // {
      //   name: "United States",
      //   states: ["Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware", "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota", "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming"],
      //   phoneNumberCode: "+1",
      //   taxType:"GST"
      // },
      // {
      //   name: "Canada",
      //   states: ["Alberta", "British Columbia", "Manitoba", "New Brunswick", "Newfoundland and Labrador", "Northwest Territories", "Nova Scotia", "Nunavut", "Ontario", "Prince Edward Island", "Quebec", "Saskatchewan", "Yukon"],
      //   phoneNumberCode: "+1"
      // },
      {
        name: "India",
        states: ["Andaman and Nicobar Island", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chandigarh", "Chhattisgarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir", "Jharkhand", "Karnataka", "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal"],
        phoneNumberCode: "+91",
        taxType:"GST"
      },
      {
        name: "Saudi Arabia",
        states: ["Asir","Al Bahah", "Al Jawf", "Al Madinah", "Al-Qassim", "Eastern Province", "Hail", "Jazan", "Makkah","Medina", "Najran", "Northern Borders", "Riyadh", "Tabuk"],
        phoneNumberCode: "+966",
        taxType:"VAT"
      },
      {
        name: "United Arab Emirates",
        states: ["Abu Dhabi", "Dubai", "Sharjah", "Ajman", "Umm Al-Quwain", "Fujairah", "Ras Al Khaimah"],
        phoneNumberCode: "+971",
        taxType:"VAT"
      },
    ]
  }
];
const industry = [
  "Agency or sales house",
  "Agriculture",
  "Art & Design",
  "Automotive",
  "Construction",
  "Consulting",
  "Consumer Packaged Goods",
  "Education",
  "Engineering",
  "Entertainment",
  "Financial Services",
  "Food Services (Restaurants/Fast Food)",
  "Gaming",
  "Government",
  "Health Care",
  "Interior Design",
  "Internal",
  "Legal",
  "Manufacturing",
  "Marketing",
  "Mining and Logistics",
  "Non-Profit",
  "Publishing and Web Media",
  "Real Estate",
  "Retail (E-Commerce and Offline)",
  "Services",
  "Technology",
  "Telecommunications",
  "Travel/Hospitality",
  "Web Designing",
  "Web Development",
  "Writers",
];
const financialYear = [
  "January - December",
  "February - January ",
  "March - February ",
  "April - March",
  "May - April ",
  "June - May ",
  "July - June ",
  "August - July ",
  "September - August ",
  "October - September ",
  "November -October ",
  "December - November ",
];
const dateFormats = {
  short: [
    { format: "mm/dd/yy", example: "08/19/24", dateFormat: "MM/DD/YY" },
    { format: "dd/mm/yy", example: "19/08/24", dateFormat: "DD/MM/YY" },
    { format: "yy/mm/dd", example: "24/08/19", dateFormat: "YY/MM/DD" },
  ],
  medium: [
    { format: "mm/dd/yyyy", example: "08/19/2024", dateFormat: "MM/DD/YYYY" },
    { format: "dd/mm/yyyy", example: "19/08/2024", dateFormat: "DD/MM/YYYY" },
    { format: "yyyy/mm/dd", example: "2024/08/19", dateFormat: "YYYY/MM/DD" },
  ],
  long: [
    {
      format: "dd/mmm/yyyy",
      example: "19 December 2024",
      dateFormat: "DD/MMMM/YYYY",
    },
    {
      format: "mmm/dd/yyyy",
      example: "December 19 2024",
      dateFormat: "MMMM/DD/YYYY",
    },
    {
      format: "yyyy/mmm/dd",
      example: "2024 December 19",
      dateFormat: "YYYY/MMMM/DD",
    },
  ],
};
const dateSplit = ["-", "/", "."];
const timezones = [
  // { "zone": "GMT-12:00", "description": "Baker Island (no permanent population)", "timeZone": "Etc/GMT+12" },
  // { "zone": "GMT-11:00", "description": "Niue, Samoa", "timeZone": "Pacific/Pago_Pago" },
  // { "zone": "GMT-10:00", "description": "Hawaii-Aleutian Standard Time (Hawaii)", "timeZone": "Pacific/Honolulu" },
  // { "zone": "GMT-09:30", "description": "Marquesas Islands (French Polynesia)", "timeZone": "Pacific/Marquesas" },
  // { "zone": "GMT-09:00", "description": "Alaska Time (Alaska)", "timeZone": "America/Anchorage" },
  // { "zone": "GMT-08:00", "description": "Pacific Time (Los Angeles, Vancouver)", "timeZone": "America/Los_Angeles" },
  // { "zone": "GMT-07:00", "description": "Mountain Time (Denver, Calgary)", "timeZone": "America/Denver" },
  // { "zone": "GMT-06:00", "description": "Central Time (Chicago, Mexico City)", "timeZone": "America/Chicago" },
  // { "zone": "GMT-05:00", "description": "Eastern Time (New York, Toronto)", "timeZone": "America/New_York" },
  // { "zone": "GMT-04:00", "description": "Atlantic Time (Halifax, Caracas)", "timeZone": "America/Halifax" },
  // { "zone": "GMT-03:30", "description": "Newfoundland Time (Newfoundland)", "timeZone": "America/St_Johns" },
  // { "zone": "GMT-03:00", "description": "Argentina Time, Brasília Time", "timeZone": "America/Argentina/Buenos_Aires" },
  // { "zone": "GMT-02:00", "description": "South Georgia and the South Sandwich Islands", "timeZone": "Atlantic/South_Georgia" },
  // { "zone": "GMT-01:00", "description": "Azores, Cape Verde", "timeZone": "Atlantic/Azores" },
  // { "zone": "GMT+00:00", "description": "Greenwich Mean Time (GMT), Western European Time (WET)", "timeZone": "Etc/GMT" },
  // { "zone": "GMT+01:00", "description": "Central European Time (CET), West Africa Time (WAT)", "timeZone": "Europe/Paris" },
  {
    zone: "GMT+02:00",
    description: "Eastern European Time (EET), Central Africa Time (CAT)",
    timeZone: "Europe/Kiev",
  },
  {
    zone: "GMT+03:00",
    description: "Arabia Standard Time (AST)",
    timeZone: "Europe/Moscow",
  },
  {
    zone: "GMT+03:30",
    description: "Iran Standard Time (IRST)",
    timeZone: "Asia/Tehran",
  },
  {
    zone: "GMT+04:00",
    description: "Gulf Standard Time (GST), Azerbaijan Time (AZT)",
    timeZone: "Asia/Dubai",
  },
  // { "zone": "GMT+04:30", "description": "Afghanistan Time (AFT)", "timeZone": "Asia/Kabul" },
  // { "zone": "GMT+05:00", "description": "Pakistan Standard Time (PKT), Yekaterinburg Time (YEKT)", "timeZone": "Asia/Karachi" },
  {
    zone: "GMT+05:30",
    description: "Indian Standard Time (IST), Sri Lanka Time (SLT)",
    timeZone: "Asia/Kolkata",
  },
  // { "zone": "GMT+06:00", "description": "Bangladesh Standard Time (BST), Novosibirsk Time (NOVT)", "timeZone": "Asia/Dhaka" },
  // { "zone": "GMT+06:30", "description": "Cocos Islands Time (CCT)", "timeZone": "Indian/Cocos" },
  // { "zone": "GMT+07:00", "description": "Indochina Time (ICT), Krasnoyarsk Time (KRAT)", "timeZone": "Asia/Bangkok" },
  // { "zone": "GMT+08:00", "description": "China Standard Time (CST), Singapore Time (SGT)", "timeZone": "Asia/Shanghai" },
  // { "zone": "GMT+08:45", "description": "Australian Central Western Standard Time (ACWST)", "timeZone": "Australia/Eucla" },
  // { "zone": "GMT+09:00", "description": "Japan Standard Time (JST), Korea Standard Time (KST)", "timeZone": "Asia/Tokyo" },
  // { "zone": "GMT+09:30", "description": "Australian Central Standard Time (ACST)", "timeZone": "Australia/Darwin" },
  // { "zone": "GMT+10:00", "description": "Australian Eastern Standard Time (AEST), Papua New Guinea Time (PGT)", "timeZone": "Australia/Sydney" },
  // { "zone": "GMT+10:30", "description": "Lord Howe Island Time (LHST)", "timeZone": "Australia/Lord_Howe" },
  // { "zone": "GMT+11:00", "description": "Solomon Islands Time (SBT), Vanuatu Time (VUT)", "timeZone": "Pacific/Guadalcanal" },
  // { "zone": "GMT+12:00", "description": "Fiji Time (FJT), New Zealand Standard Time (NZST)", "timeZone": "Pacific/Auckland" }
];
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
const validTimezone ={
"GMT+02:00": "Europe/Kiev",
"GMT+03:00": "Europe/Moscow",
"GMT+03:30": "Asia/Tehran",
"GMT+04:00": "Asia/Dubai",
"GMT+05:30": "Asia/Kolkata",
};
const validDateFormats = {
  "mm/dd/yy": "MM/DD/YY",
  "dd/mm/yy": "DD/MM/YY",
  "yy/mm/dd": "YY/MM/DD",
  "mm/dd/yyyy":"MM/DD/YYYY",
  "dd/mm/yyyy":"DD/MM/YYYY",
  "yyyy/mm/dd": "YYYY/MM/DD",
  "dd/mmm/yyyy": "DD/MMMM/YYYY",
  "mmm/dd/yyyy": "MMMM/DD/YYYY",
  "yyyy/mmm/dd": "YYYY/MMMM/DD"
 };





//Validate inputs
function validateInputs(data, currencyExists, organizationExists, res) {
  const validCurrencies = currencyExists.map((currency) => currency.currencyCode);
  const validationErrors = validateOrganizationData(data, validCurrencies, organizationExists);

  if (validationErrors.length > 0) {
    res.status(400).json({ message: validationErrors.join(", ") });
    return false;
  }
  return true;
}



//Validate Data
function validateOrganizationData(data, validCurrencies, organization ) {
  const errors = [];

  //Basic Info
  validateReqFields( data, errors);
  validateIndustry(data.organizationIndustry, errors);
  validateFiscalYear(data.fiscalYear, errors);

  //Date and Time
  validateTimeZone( data.timeZone, data.timeZoneExp, errors );
  validateDateFormat( data.dateFormat, data.dateFormatExp, errors );
  validateDateSplit(data.dateSplit, errors);


  //OtherDetails
  validateIntegerFields(['pincode',], data, errors);


  //Currency
  validateCurrency(data.baseCurrency, validCurrencies, errors);

  //Address
  validateAddress(data, errors);

  return errors;
}




// Field validation utility
function validateField(condition, errorMsg, errors) {
    if (condition) errors.push(errorMsg);
}
//Valid Req Fields
function validateReqFields( data, errors ) {
  if (typeof data.organizationCountry === 'undefined' ) {
    errors.push("Please select a Country");
  }
  if (typeof data.state === 'undefined' ) {
  errors.push("Please select a State");
  }
  if (typeof data.organizationPhNum === 'undefined' ) {
    errors.push("Please enter Phone Number");
  }
  if (typeof data.baseCurrency === 'undefined' ) {
  errors.push("Please select a Currency");
  }
  if (typeof data.timeZone === 'undefined' ) {
  errors.push("Please select a Time Zone");
  }
  if (typeof data.dateFormat === 'undefined' ) {
  errors.push("Please select a Date Format");
  }
  if (typeof data.dateSplit === 'undefined' ) {
  errors.push("Please select a Date Split");
  }  
}
// Validate address
function validateAddress(data, errors) {
  const country = data.organizationCountry, state = data.state;

  validateField(country && state && !validCountries[country]?.includes(state),
    `Invalid Country or State: ${country}, ${state}`, errors);
}
//Validate Industry
function validateIndustry(organizationIndustry, errors) {
  validateField(organizationIndustry && !industry.includes(organizationIndustry),
    "Invalid Industry: " + organizationIndustry, errors);
}
// Validate Integer Fields
function validateIntegerFields(fields, data, errors) {
  fields.forEach(field => {
    validateField(data[field] && !isInteger(data[field]), `Invalid ${field}: ${data[field]}`, errors);
  });
}
//Validate Fiscal Year
function validateFiscalYear(fiscalYear, errors) {
  validateField(fiscalYear && !financialYear.includes(fiscalYear),
    "Invalid Fiscal Year: " + fiscalYear, errors);
}
//Validate Date Split
function validateDateSplit(organizationDateSplit, errors) {
  validateField(organizationDateSplit && !dateSplit.includes(organizationDateSplit),
    "Invalid Date Split: " + organizationDateSplit, errors);
}
//Validate Currency
function validateCurrency(currency, validCurrencies, errors) {
  validateField(currency && !validCurrencies.includes(currency), "Invalid Currency: " + currency, errors);
}
//Validate Time Zone
function validateTimeZone(timeZone, timeZoneExp, errors) {
  validateField(timeZone !== undefined && timeZoneExp !== undefined && !validTimezone[timeZone]?.includes(timeZoneExp), "Invalid Time Zone:" + timeZone, errors);
}
//Validate Date Format
function validateDateFormat(dateFormat, dateFormatExp, errors) {
  validateField( dateFormat !== undefined && dateFormatExp !== undefined && !validDateFormats[dateFormat]?.includes(dateFormatExp) , "Invalid Date Format" + dateFormat, errors);
}













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