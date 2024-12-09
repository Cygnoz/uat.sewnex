
const Organization = require("../../database/model/organization")
const Tax = require('../../database/model/tax')
const Account = require("../../database/model/account")
const TrialBalance = require("../../database/model/trialBalance")
const Item = require("../../database/model/item");
const moment = require("moment-timezone");



const isDuplicateGSTTaxName = async (organizationId, gstTaxRate ) => {
  const taxName = gstTaxRate.taxName ;

  // Check for GST tax name duplicate
  const gstTaxRecord = await Tax.findOne({ organizationId, 'gstTaxRate.taxName': taxName });

  // Return true if duplicate exists in either GST or VAT rates
  return !!gstTaxRecord ;
};

const isDuplicateVATTaxName = async (organizationId, vatTaxRate) => {
  const taxName = vatTaxRate.taxName;

  // Check for VAT tax name duplicate
  const vatTaxRecord = await Tax.findOne({ organizationId, 'vatTaxRate.taxName': taxName });

  // Return true if duplicate exists in either GST or VAT rates
  return !!vatTaxRecord;
};


// Update GST-related fields
const updateGSTFields = (taxRecord, cleanedData) => {
  const {
    gstIn, gstBusinesLegalName, gstBusinessTradeName, gstRegisteredDate, compositionSchema,
    reverseCharge, importExport, digitalServices, compositionPercentage, gstTaxRate
  } = cleanedData;
  

  taxRecord.taxType = "GST";
  if (gstIn) taxRecord.gstIn = gstIn;
  if (gstBusinesLegalName) taxRecord.gstBusinesLegalName = gstBusinesLegalName;
  if (gstBusinessTradeName) taxRecord.gstBusinessTradeName = gstBusinessTradeName;
  if (gstRegisteredDate) taxRecord.gstRegisteredDate = gstRegisteredDate;
  if (compositionSchema) taxRecord.compositionSchema = compositionSchema;
  if (reverseCharge) taxRecord.reverseCharge = reverseCharge;
  if (importExport) taxRecord.importExport = importExport;
  if (digitalServices) taxRecord.digitalServices = digitalServices;
  if (compositionPercentage) taxRecord.compositionPercentage = compositionPercentage;
  if (gstTaxRate) taxRecord.gstTaxRate.push(gstTaxRate);
};

// Update VAT-related fields
const updateVATFields = (taxRecord, cleanedData) => {
  const {
    vatNumber, vatBusinesLegalName, vatBusinessTradeName, vatRegisteredDate,
    tinNumber, vatTaxRate
  } = cleanedData;

  

  taxRecord.taxType = "VAT";
  if (vatNumber) taxRecord.vatNumber = vatNumber;
  if (vatBusinesLegalName) taxRecord.vatBusinesLegalName = vatBusinesLegalName;
  if (vatBusinessTradeName) taxRecord.vatBusinessTradeName = vatBusinessTradeName;
  if (vatRegisteredDate) taxRecord.vatRegisteredDate = vatRegisteredDate;
  if (tinNumber) taxRecord.tinNumber = tinNumber;
  if (vatTaxRate) taxRecord.vatTaxRate.push(vatTaxRate);
};

// Update MSME-related fields
const updateMSMEFields = (taxRecord, cleanedData) => {
  const { msmeType, msmeRegistrationNumber } = cleanedData;
  
  if (msmeType) taxRecord.msmeType = msmeType;
  if (msmeRegistrationNumber) taxRecord.msmeRegistrationNumber = msmeRegistrationNumber;
};

// Validation function for GST tax rates
const validateGstTaxRates = (gstTaxRate) => {
  if ( gstTaxRate === undefined ) {
    return { isValid: true };
  } 
  let { taxName, taxRate, cgst, sgst, igst } = gstTaxRate;  

  cgst = parseFloat(cgst);
  sgst = parseFloat(sgst);
  igst = parseFloat(igst);

 

  // Validate for required fields
  if (taxName === undefined ) {
    return { isValid: false, message: "Tax name is required" };
  }
  if (taxRate === undefined ) {
    return { isValid: false, message: "Tax rate is required" };
  }
  if (cgst === undefined ) {
    return { isValid: false, message: "CGST is required" };
  }
  if (sgst === undefined ) {
    return { isValid: false, message: "SGST is required" };
  }
  if (igst === undefined ) {
    return { isValid: false, message: "IGST is required" };
  }

  // Check if CGST equals SGST
  if (cgst !== sgst) {
    return { isValid: false, message: "CGST must be equal to SGST." };
  }

  // Check if the sum of CGST and SGST equals IGST
  if (cgst + sgst !== igst) {
    return { isValid: false, message: "Sum of CGST & SGST must be equal to IGST." };
  }

  return { isValid: true };
};


// Validation function for VAT tax rates
const validateVatTaxRates = (vatTaxRate) => {
  if ( vatTaxRate === undefined ) {
    return { isValid: true };
  }  
  
  const { taxName, taxRate } = vatTaxRate;

  if ( taxName === undefined ) {
    return { isValid: false, message: "Tax name is required" };
  }
  if ( taxRate === undefined ) {
    return { isValid: false, message: "Tax rate is required" };
  }


return { isValid: true };
};


// Add Tax
exports.addTax = async (req, res) => {
  try {
    console.log("Add Tax :",req.body);
    const organizationId = req.user.organizationId;
    const gst = req.body.gstTaxRate
    const vat = req.body.vatTaxRate   

    const cleanedData = cleanCustomerData(req.body);
    cleanedData.gstTaxRate = gst ? cleanCustomerData(gst) : undefined;
    cleanedData.vatTaxRate = vat ? cleanCustomerData(vat) : undefined; 

    const { taxType } = cleanedData;  
        

    // Validate organization existence
    const existingOrganization = await Organization.findOne({ organizationId });
    if (!existingOrganization) {
      return res.status(404).json({ message: "No Organization Found." });
    }
    


    // Validate GST tax rate for duplicates
    if (cleanedData.gstTaxRate && await isDuplicateGSTTaxName(organizationId, cleanedData.gstTaxRate)) {
      return res.status(400).json({ message: `GST Tax record with tax name ${gstTaxRate.taxName} already exists.` });
    }

    if (cleanedData.vatTaxRate && await isDuplicateVATTaxName(organizationId, cleanedData.vatTaxRate)) {
      return res.status(400).json({ message: `VAT Tax record with tax name ${vatTaxRate.taxName} already exists.` });
    }

    const gstValidation = validateGstTaxRates(cleanedData.gstTaxRate);
    if (!gstValidation.isValid) { return res.status(400).json({ message: gstValidation.message }); }

    const vatValidation = validateVatTaxRates(cleanedData.vatTaxRate);
      if (!vatValidation.isValid) { return res.status(400).json({ message: vatValidation.message }); }


    let taxRecord = await Tax.findOne({ organizationId });
    if (!taxRecord) {
      return res.status(404).json({ message: "Tax record not found for the given organization." });
    }
    
    const acctype = taxRecord.taxType;

    const generatedDateTime = generateTimeAndDateForDB( existingOrganization.timeZoneExp, existingOrganization.dateFormatExp, existingOrganization.dateSplit );
    const createdDateAndTime = generatedDateTime.dateTime;

    if (taxType === 'GST') {
        updateGSTFields( taxRecord, cleanedData );
    } else if (taxType === 'VAT') {
        updateVATFields( taxRecord, cleanedData );
    }

    updateMSMEFields(taxRecord, cleanedData);    

    const updatedTaxRecord = await taxRecord.save();   

    if (!acctype) {
      if (taxType === 'GST') {
        await insertAccounts(gstAccounts, organizationId, createdDateAndTime);
        await defaultAccounts(organizationId,taxType);
      }else if (taxType === 'VAT') {
        await insertAccounts(vatAccounts, organizationId, createdDateAndTime);
        await defaultAccounts(organizationId,taxType);
      }
      
    }


    res.status(200).json({ message: "Tax record updated successfully", updatedTaxRecord });
  } catch (error) {
    console.error("Error updating tax record:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};


//Edit Tax
exports.editTaxRate = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const { taxType, taxRateId, updatedRate } = req.body;
    

    // Validate the taxType
    if (taxType !== 'GST' && taxType !== 'VAT') {
      return res.status(400).json({ message: "Invalid tax type. Must be 'GST' or 'VAT'." });
    }

    // Find the tax record by organizationId and taxType
    let taxRecord = await Tax.findOne({ organizationId });    

    if (!taxRecord) {
      return res.status(404).json({ message: "Tax record not found for the given organization." });
    }

    // Validate GST tax rate for duplicates
    if (taxType == 'GST' &&  await isDuplicateGSTTaxName(organizationId, updatedRate)) {
      return res.status(400).json({ message: `GST Tax record with tax name already exists.` });
    }

    if (taxType == 'VAT' &&  await isDuplicateVATTaxName(organizationId, updatedRate)) {
      return res.status(400).json({ message: `VAT Tax record with tax name already exists.` });
    }

    const gstValidation = validateGstTaxRates(updatedRate);
    if (!gstValidation.isValid && taxType == 'GST') { return res.status(400).json({ message: gstValidation.message }); }

    const vatValidation = validateVatTaxRates(updatedRate);
      if (!vatValidation.isValid && taxType == 'VAT' ) { return res.status(400).json({ message: vatValidation.message }); }



    let rateIndex;
    let prevTaxName;

    // Update the relevant tax rate within the GST or VAT array
    if (taxType === 'GST') {
      rateIndex = taxRecord.gstTaxRate.findIndex(rate => rate._id.toString() === taxRateId);

      if (rateIndex === -1) {
        return res.status(404).json({ message: "GST tax rate not found." });
      }

      prevTaxName = taxRecord.gstTaxRate[rateIndex].taxName;

      // Update the GST tax rate with the provided details
      taxRecord.gstTaxRate[rateIndex] = { ...taxRecord.gstTaxRate[rateIndex], ...updatedRate };

    } else if (taxType === 'VAT') {
      rateIndex = taxRecord.vatTaxRate.findIndex(rate => rate._id.toString() === taxRateId);

      if (rateIndex === -1) {
        return res.status(404).json({ message: "VAT tax rate not found." });
      }

      prevTaxName = taxRecord.vatTaxRate[rateIndex].taxName;


      // Update the VAT tax rate with the provided details
      taxRecord.vatTaxRate[rateIndex] = { ...taxRecord.vatTaxRate[rateIndex], ...updatedRate };
    }

    // Save the updated tax record
    const updatedTaxRecord = await taxRecord.save();


    // Find all items associated with the updated tax rate and update their tax details
    const itemsToUpdate = await Item.find({ taxRate : prevTaxName, organizationId });    

    if (itemsToUpdate.length > 0) {
      for (const item of itemsToUpdate) {
        // Update the relevant tax details based on taxType
        if (taxType === 'GST') {
          item.taxRate = updatedRate.taxName;
          item.cgst = updatedRate.cgst;
          item.sgst = updatedRate.sgst;
          item.igst = updatedRate.igst;
        } else if (taxType === 'VAT') {
          item.taxRate = updatedRate.taxRate;
          item.vat = updatedRate.vat;
        }

        // Save the updated item
        await item.save();
      }
    }

    res.status(200).json({ message: "Tax rate updated successfully", updatedTaxRecord });
  } catch (error) {
    console.error("Error updating tax rate:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};


// Get Tax 
exports.getTax = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;

    const tax = await Tax.findOne({organizationId:organizationId},{organizationId:0});

    if (tax) {
      res.status(200).json(tax);
    } else {
      res.status(404).json({ message: "Tax not found" });
    }
  } catch (error) {
    console.error("Error fetching Tax:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};













const gstAccounts = [
  {
    accountName: "Input SGST",
    accountSubhead: "Current Asset",
    accountHead: "Asset",
    accountGroup: "Asset",
    accountCode: "TX-01",
    description: "Input SGST",
  },
  {
    accountName: "Input CGST",
    accountSubhead: "Current Asset",
    accountHead: "Asset",
    accountGroup: "Asset",
    accountCode: "TX-02",
    description: "Input CGST",
  },
  {
    accountName: "Input IGST",
    accountSubhead: "Current Asset",
    accountHead: "Asset",
    accountGroup: "Asset",
    accountCode: "TX-03",
    description: "Input IGST",
  },{
    accountName: "Output SGST",
    accountSubhead: "Current Liability",
    accountHead: "Liabilities",
    accountGroup: "Liability",
    accountCode: "TX-04",
    description: "Output SGST",
  },
  {
    accountName: "Output CGST",
    accountSubhead: "Current Liability",
    accountHead: "Liabilities",
    accountGroup: "Liability",
    accountCode: "TX-05",
    description: "Output CGST",
  },
  {
    accountName: "Output IGST",
    accountSubhead: "Current Liability",
    accountHead: "Liabilities",
    accountGroup: "Liability",
    accountCode: "TX-06",
    description: "Output IGST",
  },];

const vatAccounts = [
    {
      accountName: "Input VAT",
      accountSubhead: "Current Asset",
      accountHead: "Asset",
      accountGroup: "Asset",
      accountCode: "TX-01",
      description: "Input VAT",
    },    
    {
      accountName: "Output VAT",
      accountSubhead: "Current Liability",
      accountHead: "Liabilities",
      accountGroup: "Liability",
      accountCode: "TX-02",
      description: "Output VAT",
    },];

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
    const debitOpeningBalance = 0;  
    const creditOpeningBalance = 0; 


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





















  // Fetch existing data
const dataExist = async (organizationId) => {
  const [ outputCgst, outputSgst, outputIgst, inputCgst, inputSgst, inputIgst, outputVat, inputVat] = await Promise.all([
    
    Account.findOne({ organizationId, accountName:'Output CGST' }, { _id: 1 }),
    Account.findOne({ organizationId, accountName:'Output SGST' }, { _id: 1 }),
    Account.findOne({ organizationId, accountName:'Output IGST' }, { _id: 1 }),
    
    Account.findOne({ organizationId, accountName:'Input CGST' }, { _id: 1 }),
    Account.findOne({ organizationId, accountName:'Input SGST' }, { _id: 1 }),
    Account.findOne({ organizationId, accountName:'Input IGST' }, { _id: 1 }),
    
    Account.findOne({ organizationId, accountName:'Output VAT' }, { _id: 1 }),
    Account.findOne({ organizationId, accountName:'Input VAT' }, { _id: 1 }),

  ]);
  return { outputCgst, outputSgst, outputIgst, inputCgst, inputSgst, inputIgst, outputVat, inputVat };
};











async function defaultAccounts(organizationId,taxType) {
  try {
    
    let defaultAccountData;
    
    const accountData = await dataExist(organizationId);

    if (taxType === "GST") {
      const {
        outputCgst, outputSgst, outputIgst,
        inputCgst, inputSgst, inputIgst
      } = accountData;

      defaultAccountData = {
        organizationId,
        outputCgst:outputCgst._id, 
        outputSgst:outputSgst._id, 
        outputIgst:outputIgst._id,
        inputCgst:inputCgst._id, 
        inputSgst:inputSgst._id,
        inputIgst:inputIgst._id,
      };

    } else if (taxType === "VAT") {
      const { outputVat, inputVat } = accountData;

      defaultAccountData = {
        organizationId,
        outputVat:outputVat._id,
        inputVat:inputVat._id,
      };
    }
    
    await DefAcc.updateOne({ organizationId }, defaultAccountData);
  } catch (error) {
    console.error("Error adding Default Account:", error);
  }
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









//Clean Data 
function cleanCustomerData(data) {
    const cleanData = (value) => (value === null || value === undefined || value === "" || value === 0 ? undefined : value);
    return Object.keys(data).reduce((acc, key) => {
      acc[key] = cleanData(data[key]);
      return acc;
    }, {});
}
