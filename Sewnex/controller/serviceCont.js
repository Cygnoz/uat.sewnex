const Organization = require("../../database/model/organization");
const Settings = require("../../database/model/settings");
const Tax = require("../../database/model/tax");
const Account = require("../../database/model/account")

const Service = require('../model/service');

const { cleanData } = require("../../services/cleanData");
const mongoose = require('mongoose');



const dataExist = async ( organizationId, salesAccountId = null, serviceId ) => {  
    const [ organizationExists, taxExists, settingsExist, salesAccount, allService, service ] = await Promise.all([
      Organization.findOne({ organizationId }),
      Tax.findOne({ organizationId }),
      Settings.findOne({ organizationId }),
      Account.findOne({ organizationId , _id : salesAccountId}),
      Service.find({organizationId})
      .populate('categoryId', 'categoryName')
      .populate('parameter.parameterId', 'parameterName')    
      .populate('style.styleId', 'styleName')    
      .lean(),
      Service.findOne({ organizationId, _id: serviceId })
      .populate('categoryId', 'categoryName')
      .populate('parameter.parameterId', 'parameterName')    
      .populate('style.styleId', 'styleName')    
      .lean(),
    ]);
    return { organizationExists, taxExists, settingsExist,  salesAccount, allService, service };
  };



// Add Service
exports.addService = async (req, res) => {
    console.log("Add Service:", req.body);
    try {
        const cleanedData = cleanData(req.body);

        const organizationId = req.user.organizationId;

        const { salesAccountId, taxRate } = cleanedData;

        const { organizationExists, taxExists, salesAccount } = await dataExist( organizationId, salesAccountId );

        if (!validateOrganizationTaxCurrency(organizationExists, taxExists, null, res)) return;     

        // Validate inputs
        if (!validateServiceData(cleanedData, salesAccount, res)) return;

        if (await isDuplicateName(cleanData.serviceName, organizationId, res)) return;

         //Tax Type
        taxType( cleanedData, taxExists, taxRate );    
        
        // Calculate Service
        if (!calculateService( cleanedData, taxExists, res )) return;

        const newService = new Service({ ...cleanedData });
        const savedService = await newService.save();

        res.status(201).json({ message: "Service created successfully.", service: savedService });
    } catch (error) {
        console.error("Error creating service:", error);
        res.status(500).json({ message: "Internal server error." });
    }
};

// Edit Service
exports.editService = async (req, res) => {
    console.log("Edit Service:", req.body);
    try {
        const { serviceId } = req.params;

        const cleanedData = cleanData(req.body);

        const organizationId = req.user.organizationId;

        const { salesAccountId, taxRate } = cleanedData;

        const { organizationExists, taxExists, salesAccount } = await dataExist( organizationId, salesAccountId );

        if (!validateOrganizationTaxCurrency(organizationExists, taxExists, null, res)) return;

        // Validate inputs
        if (!validateServiceData(cleanedData, salesAccount, res)) return;

        if (!await isDuplicateNameExist(cleanData.serviceName, organizationId, res)) return;

         //Tax Type
        taxType( cleanedData, taxExists, taxRate );   
        
        // Calculate Service
        if (!calculateService( cleanedData, taxExists, res )) return;

        const updatedService = await Service.findByIdAndUpdate(serviceId, cleanedData, { new: true });
        if (!updatedService) return res.status(404).json({ message: "Service not found." });

        res.status(200).json({ message: "Service updated successfully.", service: updatedService });
    } catch (error) {
        console.error("Error updating service:", error);
        res.status(500).json({ message: "Internal server error." });
    }
};

// Get All Services
exports.getAllServices = async (req, res) => {
    try {
        const organizationId = req.user.organizationId;

        const { organizationExists, allService } = await dataExist( organizationId, null );
    
        if (!organizationExists) return res.status(404).json({ message: "No Organization Found." });

        if (!allService) return res.status(404).json({ message: "No Service Found." });

        res.status(200).json(allService);
    } catch (error) {
        console.error("Error fetching services:", error);
        res.status(500).json({ message: "Internal server error." });
    }
};

// Get One Service
exports.getService = async (req, res) => {
    try {
        const { serviceId } = req.params;
        
        const organizationId = req.user.organizationId;
        
        const { organizationExists, service } = await dataExist( organizationId, null, serviceId );
        
        if (!organizationExists) return res.status(404).json({ message: "No Organization Found." });
                
        if (!service) return res.status(404).json({ message: "Service not found." });

        res.status(200).json(service);
    } catch (error) {
        console.error("Error fetching service:", error);
        res.status(500).json({ message: "Internal server error." });
    }
};


// Delete Service
exports.deleteService = async (req, res) => {
    try {
        const { serviceId } = req.params;
        const deletedService = await Service.findByIdAndDelete(serviceId);
        if (!deletedService) return res.status(404).json({ message: "Service not found." });
        res.status(200).json({ message: "Service deleted successfully." });
    } catch (error) {
        console.error("Error deleting service:", error);
        res.status(500).json({ message: "Internal server error." });
    }
};







// Check for duplicate item name - ADD
const isDuplicateName = async (serviceName, organizationId, res) => {
    const existingServiceName = await Service.findOne({ serviceName, organizationId });
    if (existingServiceName) {
        console.error("Service with this name already exists.");
        res.status(400).json({ message: "Service with this name already exists" });
        return true;
    }
    return false;
  };

// Check for duplicate item name - EDIT
const isDuplicateNameExist = async (serviceName, organizationId, itemId, res) => { 
    const existingServiceName = await Service.findOne({
        serviceName,
        organizationId,
        _id: { $ne: itemId }
    });
    
    if (existingServiceName) {
        console.error("Service with this name already exists.");
        res.status(400).json({ message: "Service with this name already exists" });
        return true;
    }
    
    return false;
  };


// Validate Organization Tax Currency
function validateOrganizationTaxCurrency(organizationExists, taxExists, itemId, res) {
    if (!organizationExists) {
      res.status(404).json({ message: "Organization not found" });
      return false;
    }
    if (!taxExists) {
      res.status(404).json({ message: "Tax not found" });
      return false;
    }
    // if (!itemId) {
    //   res.status(404).json({ message: "Currency not found" });
    //   return false;
    // }
    // if (!settingsExist) {
    //   res.status(404).json({ message: "Settings not found" });
    //   return false;
    // }
    return true;
  }


//Tax type
function taxType( cleanedData, taxExists, taxRate ) {
    if (taxExists.taxType === 'GST') {
      taxExists.gstTaxRate.forEach((tax) => {
        if (tax.taxName === taxRate) {
          cleanedData.igst = tax.igst;
          cleanedData.cgst = tax.cgst; 
          cleanedData.sgst = tax.sgst;           
        }
      });
    }
  
    // Check if taxType is VAT
    if (taxExists.taxType === 'VAT') {
      taxExists.vatTaxRate.forEach((tax) => {
        if (tax.taxName === taxRate) {
          cleanedData.vat = tax.vat; 
        }
      });
    }
    
  }






  


  function calculateService(cleanedData, taxExists, res) {
    const errors = [];

    let styleTotal = 0;
    let serviceCharge = (cleanedData.serviceCharge || 0);
    let sellingPrice = 0;
    let grandTotal = 0;

    let calculatedIgstAmount = 0;
    let calculatedVatAmount = 0;

    // Utility function to round values to two decimal places
    const roundToTwoDecimals = (value) => Number(value.toFixed(2));

    cleanedData.style.forEach((data, index) => {    
      let styleRate = parseFloat(data.styleRate) || 0;
      styleTotal += styleRate;  

      console.log(`Row..................... ${index + 1}:`);
      console.log("calculatedStyleTotal:",styleTotal);
    });

    sellingPrice = styleTotal + serviceCharge;

    // Handle tax calculation
    if (cleanedData.taxType === "Inclusive") {
      if (taxExists.taxType === 'GST') {
        calculatedIgstAmount = roundToTwoDecimals((cleanedData.igst / 100) * sellingPrice);
      } else {
        calculatedVatAmount = roundToTwoDecimals((cleanedData.vat / 100) * sellingPrice);
      }
      grandTotal = (sellingPrice + calculatedIgstAmount + calculatedVatAmount);
    } else {
      console.log('Skipping Tax');
      grandTotal = sellingPrice;
    }

    console.log("calculatedServiceCharge:",serviceCharge);
    console.log("calculatedSellingPrice:",sellingPrice);
    console.log("calculatedIgstAmount:",calculatedIgstAmount);
    console.log("calculatedVatAmount:",calculatedVatAmount);
    console.log("calculatedGrandTotal:",grandTotal);

    checkAmount(styleTotal, cleanedData.styleTotal, 'Style Total',errors);
    checkAmount(serviceCharge, cleanedData.serviceCharge, 'Service Charge',errors);
    checkAmount(sellingPrice, cleanedData.sellingPrice, 'Selling Price',errors);
    checkAmount(grandTotal, cleanedData.grandTotal, 'Grand Total',errors);

    // Round the totals for comparison
    const roundedStyleTotal = roundToTwoDecimals(styleTotal); 
    const roundedSellingPrice = roundToTwoDecimals(sellingPrice);
    const roundedGrandTotal = roundToTwoDecimals(grandTotal);
  
    console.log(`Final Style Total: ${roundedStyleTotal} , Provided ${cleanedData.styleTotal}` );
    console.log(`Final Selling Price: ${roundedSellingPrice} , Provided ${cleanedData.sellingPrice}` );
    console.log(`Final Grand Total: ${roundedGrandTotal} , Provided ${cleanedData.grandTotal}` );
  
    validateAmount(roundedStyleTotal, cleanedData.styleTotal, 'Style Total', errors);
    validateAmount(roundedSellingPrice, cleanedData.sellingPrice, 'Selling Price', errors);
    validateAmount(roundedGrandTotal, cleanedData.grandTotal, 'Grand Total', errors);
  
    if (errors.length > 0) {
      res.status(400).json({ message: errors.join(", ") });
      return false;
    }
  
    return true;

  }






  //Mismatch Check
  function checkAmount(calculatedAmount, providedAmount, itemName, errors) {
    const roundToTwoDecimals = (value) => Number(value.toFixed(2)); // Round to two decimal places
    const roundedAmount = roundToTwoDecimals(calculatedAmount);
    console.log(`${itemName}, Calculated: ${roundedAmount}, Provided data: ${providedAmount}`);
  
    if (Math.abs(roundedAmount - providedAmount) > 0.01) {
      const errorMessage = `Mismatch for item ${itemName}: Calculated ${calculatedAmount}, Provided ${providedAmount}`;
      errors.push(errorMessage);
      console.log(errorMessage);
    }
  }
  
  
  //Final Item Amount check
  const validateAmount = ( calculatedValue, cleanedValue, label, errors ) => {
    const isCorrect = calculatedValue === parseFloat(cleanedValue);
    if (!isCorrect) {
      const errorMessage = `${label} is incorrect: ${cleanedValue}`;
      errors.push(errorMessage);
      console.log(errorMessage);
    }
  };




















// Field validation utility
function validateField(condition, errorMsg, errors) {
    if (condition) {
      console.log(errorMsg);      
      errors.push(errorMsg)};
}


// Validate Service Data
function validateServiceData(data, salesAccount, res) {
    const errors = [];

    validateReqFields( data, errors );
    // validateAccountStructure( data, salesAccount, errors);
    validateTaxType(data.taxType, errors)

    // validateAlphanumericFields([''], data, errors);
    // validateIntegerFields([''], data, errors);
    validateFloatFields(['sellingPrice'], data, errors);
    //validateAlphabetsFields([''], data, errors);


    if (errors.length > 0) {
        res.status(400).json({ message: errors.join(", ") });
        return false;
    }
    return true;
}


function validateReqFields( data, errors ) {
    validateField(typeof data.serviceName === 'undefined',"Service name is required.", errors);
    validateField(typeof data.sellingPrice === 'undefined',"Service rate is required.", errors);
    validateField(typeof data.salesAccountId === 'undefined',"Select Sales Account", errors);
    validateField(typeof data.taxRate === 'undefined',"Select tax rate", errors);    
  }

  // Validation function for account structure
function validateAccountStructure( data, salesAccount, errors ) {
    if(data.salesAccountId) {
      validateField( salesAccount.accountGroup !== "Asset" || salesAccount.accountHead !== "Income" || salesAccount.accountSubhead !== "Sales" , "Invalid Sales Account.", errors);
    }
}


// Validate Tax Type
function validateTaxType(taxType, errors) {
  validateField(
    taxType && !validTaxType.includes(taxType),
    "Invalid Tax Type: " + taxType, errors );
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
    
  



  // Utility Functions
  const validTaxType = ["Inclusive", "Exclusive"];    