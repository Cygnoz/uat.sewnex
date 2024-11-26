const Organization = require("../database/model/organization");
const Expense = require("../database/model/expense");
const Category = require("../database/model/expenseCategory");
const Account = require("../database/model/account")
const TrialBalance = require("../database/model/trialBalance");
const Supplier = require('../database/model/supplier');
const moment = require("moment-timezone");
const mongoose = require('mongoose');



const dataExist = async (organizationId, supplierId) => {
    const [organizationExists, expenseExists, categoryExists, accountExist, supplierExist] = await Promise.all([
      Organization.findOne({ organizationId },{ timeZoneExp: 1, dateFormatExp: 1, dateSplit: 1, organizationCountry: 1, state: 1 }),
      Expense.find({ organizationId }),
      Category.find({ organizationId }),
      Account.find({ organizationId }),
      Supplier.findOne({ organizationId , _id:supplierId}, { _id: 1, supplierDisplayName: 1, taxType: 1, sourceOfSupply: 1, gstin_uin: 1, gstTreatment: 1 }),
    ]);
    return { organizationExists, expenseExists, categoryExists, accountExist, supplierExist };
  };


  // const expenseDataExist = async ( organizationId, expenseId ) => {    
  //   const [organizationExists, allExpense, expense ] = await Promise.all([
  //     Organization.findOne({ organizationId }, { organizationId: 1}),
  //     Expense.find({ organizationId }),
  //     Expense.findOne({ organizationId , _id: expenseId })
  //   ]);
  //   return { organizationExists, allExpense, expense };
  // };


  // const expenseCategoryDataExist = async ( organizationId, categoryId ) => {    
  //   const [organizationExists, allCategory, category ] = await Promise.all([
  //     Organization.findOne({ organizationId }, { organizationId: 1}),
  //     Category.find({ organizationId }),
  //     Category.findOne({ organizationId , _id: categoryId })
  //   ]);
  //   return { organizationExists, allCategory, category };
  // };



// Expense
//add expense
exports.addExpense = async (req, res) => {
  console.log("Add Expense:", req.body);

  try {
    const { organizationId, id: userId, userName } = req.user;

      //Clean Data
      const cleanedData = cleanExpenseData(req.body);

      const { supplierId } = cleanedData;

      //Validate Supplier
      if (!mongoose.Types.ObjectId.isValid(supplierId) || supplierId.length !== 24) {
        return res.status(400).json({ message: `Invalid supplier ID: ${supplierId}` });
      }

      // Validate organizationId
      const { organizationExists, accountExist, supplierExist } = await dataExist(organizationId, supplierId);

      // Extract all account IDs from accountExist
      // const accountIds = accountExist.map(account => account._id.toString());
      // console.log(accountIds)
      // Check if each expense's expenseAccountId exists in allAccounts
      if(!accountIds.includes(cleanedData))
      for (let expenseItem of cleanedData.expense) {
          if (!accountIds.includes(expenseItem.expenseAccountId)) {
              return res.status(404).json({ message: `Account with ID ${expenseItem.expenseAccountId} not found` });
          }
      }

      //Data Exist Validation
      if (!validateOrganizationSupplierAccount( organizationExists, accountExist, supplierExist, res )) return;

      if (!validateInputs(cleanedData, organizationExists, res)) return;

      //Date & Time
      const openingDate = generateOpeningDate(organizationExists);

      // Create a new expense
      const savedExpense = await createNewExpense(cleanedData, organizationId, openingDate, userId, userName);
      console.log("savedExpense:",savedExpense)
      const savedTrialBalance= await createTrialBalance(savedExpense);
      console.log("savedTrialBalance:",savedTrialBalance)

      res.status(201).json({ message: "Expense created successfully." });
  } catch (error) {
      console.error("Error adding expense:", error);
      res.status(400).json({ error: error.message });
  }
};

//get all expense
exports.getAllExpense = async (req, res) => {
    try {
      const organizationId = req.user.organizationId;
  
      const { organizationExists, expenseExists } = await dataExist(organizationId);
  
      if (!organizationExists) {
        return res.status(404).json({
          message: "Organization not found",
        });
      }
  
      if (!expenseExists.length) {
        return res.status(404).json({
          message: "No expense found",
        });
      }
      const AllExpense = expenseExists.map((history) => {
        const { organizationId, ...rest } = history.toObject(); // Convert to plain object and omit organizationId
        return rest;
      });
  
      res.status(200).json(AllExpense);
    } catch (error) {
      console.error("Error fetching Expense:", error);
      res.status(500).json({ message: "Internal server error." });
    }
  };

//get a expense
exports.getOneExpense = async (req, res) => {
    try {
      const {   id } = req.params;
      const organizationId = req.user.organizationId;
  
      const {organizationExists} = await dataExist(organizationId);
  
      if (!organizationExists) {
        return res.status(404).json({
          message: "Organization not found",
        });
      }
  
      // Find the Customer by   supplierId and organizationId
      const expense = await Expense.findOne({
        _id:   id,
        organizationId: organizationId,
      });
  
      if (!expense) {
        return res.status(404).json({
          message: "expense not found",
        });
      }
    //   expense.organizationId = undefined;
    delete expense.organizationId;
      res.status(200).json(expense);
    } catch (error) {
      console.error("Error fetching expense:", error);
      res.status(500).json({ message: "Internal server error." });
    }
  };

// //update expense
// exports.updateExpense = async (req, res) => {
//     console.log("Update expense:", req.body);
    
//     try {
//         const expenseId = req.params.id;
//         const {
//             organizationId,
//             expenseDate,
//             expenseCategory,
//             expenseName,
//             amount,
//             paymentMethod,
//             expenseAccount, 
//             expenseType, 
//             hsnCode, 
//             sacCode, 
//             vendor, 
//             gstTreatment, 
//             vendorGSTIN, 
//             source, 
//             destination, 
//             reverseCharge, 
//             currency, 
//             tax, 
//             invoiceNo, 
//             notes, 
//             uploadFiles, 
//             defaultMileageCategory, 
//             defaultUnit, 
//             startDate, 
//             mileageRate, 
//             date, 
//             employee, 
//             calculateMileageUsing, 
//             distance
//         } = req.body;

//         // Validate organizationId
//         const organizationExists = await Organization.findOne({
//             organizationId: organizationId,
//         });
//         if (!organizationExists) {
//             return res.status(404).json({
//             message: "Organization not found",
//             });
//         }

//         // Check if expenseName already exists for another expense
//         const existingExpense = await Expense.findOne({ expenseName });
//         if (existingExpense && existingExpense._id.toString() !== expenseId) {
//             return res.status(400).json({ message: "expenseName already exists for another Expense" });
//         }

//         const currentDate = new Date();
//         const day = String(currentDate.getDate()).padStart(2, "0");
//         const month = String(currentDate.getMonth() + 1).padStart(2, "0");
//         const year = currentDate.getFullYear();
//         const formattedDate = `${day}-${month}-${year}`;

//         const updatedExpense = await Expense.findByIdAndUpdate(
//             expenseId,
//             {
//                 organizationId,
//                 expenseDate: formattedDate,
//                 expenseCategory,
//                 expenseName,
//                 amount,
//                 paymentMethod,
//                 expenseAccount, 
//                 expenseType, 
//                 hsnCode, 
//                 sacCode, 
//                 vendor, 
//                 gstTreatment, 
//                 vendorGSTIN, 
//                 source, 
//                 destination, 
//                 reverseCharge, 
//                 currency, 
//                 tax, 
//                 invoiceNo, 
//                 notes, 
//                 uploadFiles, 
//                 defaultMileageCategory, 
//                 defaultUnit, 
//                 startDate, 
//                 mileageRate, 
//                 date, 
//                 employee, 
//                 calculateMileageUsing, 
//                 distance
//             },
//             { new: true, runValidators: true }
//         );

//         if (!updatedExpense) {
//             console.log("Expense not found with ID:", expenseId);
//             return res.status(404).json({ message: "Expense not found" });
//         }

//         res.status(200).json({ message: "Expense updated successfully", expense: updatedExpense });
//         console.log("Expense updated successfully:", updatedExpense);
//     } catch (error) {
//         console.error("Error updating expense:", error);
//         res.status(500).json({ message: "Internal server error" });
//     }
// };

// //delete expense
// exports.deleteExpense = async (req, res) => {
//     console.log("Delete expense:", req.body);
//     try {
//         const { id } = req.params;
//         const { organizationId } = req.body;

//         // Validate organizationId
//         const organizationExists = await Organization.findOne({
//             organizationId: organizationId,
//         });
//         if (!organizationExists) {
//             return res.status(404).json({
//             message: "Organization not found",
//             });
//         }

//         const expense = await Expense.findById(id);

//         if (!expense) {
//             return res.status(404).json({ message: "Expense not found." });
//         }

//         await Expense.findByIdAndDelete(id);

//         res.status(200).json({ message: "Expense deleted successfully." });
//         console.log("Expense deleted successfully:", id);
//     } catch (error) {
//         console.error("Error deleting expense:", error);
//         res.status(500).json({ message: "Internal server error." });
//     }
// };





// Expense Category
//add category
exports.addCategory = async (req, res) => {
  console.log("req:",req.body);
    try {
      const { organizationId, id: userId, userName } = req.user;
        
        const cleanBody = removeSpaces(req.body)

        const {  expenseCategory, description } = cleanBody;

        const { organizationExists, categoryExists } = await dataExist(organizationId);

        // Check if organization exists
        if (!organizationExists) {
            return res.status(404).json({ message: "Organization not found" });
        }

        // Check if any category in categoryExists has the same expenseCategory
        const duplicateCategory = categoryExists.some(
            (category) => category.expenseCategory.toLowerCase().replace(/\s+/g, "") === expenseCategory.toLowerCase().replace(/\s+/g, "")
        );

        if (duplicateCategory) {
            return res.status(409).json({
                message: "Category  already exists ",
            });
        }

        // Create and save new category
        const newCategory = new Category({ organizationId, expenseCategory, description, userId, userName });
        await newCategory.save();

        newCategory.organizationId = undefined;

        res.status(201).json({ message: "Category created successfully", newCategory});
    } catch (error) {
        console.error("Error adding category:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};


exports.getAllCategory = async (req, res) => {
    try {
        const  organizationId  = req.user.organizationId;

        const { organizationExists, categoryExists } = await dataExist(organizationId);

        if (!organizationExists) {
            return res.status(404).json({
                message: "Organization not found",
            });
        }

        if (!categoryExists.length) {
            return res.status(404).json({
                message: "No category found",
            });
        }

        // Map over all categories to remove the organizationId from each object
        const AllCategories = categoryExists.map((history) => {
            const { organizationId, ...rest } = history.toObject(); // Convert to plain object and omit organizationId
            return rest;
        });

        res.status(200).json(AllCategories);
    } catch (error) {
        console.error("Error fetching category:", error);
        res.status(500).json({ message: "Internal server error." });
    }
};

//get a category
exports.getACategory = async (req, res) => {
    try {
      const organizationId = req.user.organizationId;
      const categoryId = req.params.categoryId;

      const {organizationExists} = await dataExist(organizationId);
  
      if (!organizationExists) {
        return res.status(404).json({
          message: "Organization not found",
        });
      }
  
      // Find the Customer by   supplierId and organizationId
      const category = await Category.findOne({
        _id: categoryId,
        organizationId: organizationId,
      });
  
      if (!category) {
        return res.status(404).json({
          message: "category not found",
        });
      }
      category.organizationId = undefined;
      res.status(200).json(category);
    } catch (error) {
      console.error("Error fetching category:", error);
      res.status(500).json({ message: "Internal server error." });
    }
  };

//update category
exports.updateCategory = async (req, res) => {
    
    try {
        const organizationId = req.user.organizationId;
        const categoryId = req.params.categoryId;

        const cleanBody = removeSpaces(req.body)

        const {
            expenseCategory,
            description,
        } = cleanBody;

        // Validate organizationId
        const { organizationExists } = await dataExist(organizationId);

        if (!organizationExists) {
            return res.status(404).json({
            message: "Organization not found",
            });
        }

        // Check if supplierEmail already exists for another supplier
        const existingCategory = await Category.findOne({ expenseCategory });
        if (existingCategory && existingCategory._id.toString().trim() !== categoryId.trim()) {
            return res.status(400).json({ message: "expenseCategory already exists for another category" });
        }

        const updatedCategory = await Category.findByIdAndUpdate(
            categoryId,
            {
                organizationId,
                expenseCategory,
                description,
            },
            { new: true, runValidators: true }
        );

        if (!updatedCategory) {
            console.log("Category not found with ID:", categoryId);
            return res.status(404).json({ message: "Category not found" });
        }

        updatedCategory.organizationId = undefined;

        res.status(200).json({ message: "Category updated successfully", updatedCategory});
        console.log("Category updated successfully:", updatedCategory);
    } catch (error) {
        console.error("Error updating category:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

//delete category
exports.deleteCategory = async (req, res) => {
    console.log("Delete category:", req.body);
    try {
      const organizationId = req.user.organizationId;
      const categoryId = req.params.categoryId;

        // Validate organizationId
        const organizationExists = await Organization.findOne({
            organizationId: organizationId,
        });
        if (!organizationExists) {
            return res.status(404).json({
            message: "Organization not found",
            });
        }

        const category = await Category.findById(categoryId);

        if (!category) {
            return res.status(404).json({ message: "Category not found." });
        }

        await Category.findByIdAndDelete(categoryId);
        
        res.status(200).json({ message: "Category deleted successfully." });
        console.log("Category deleted successfully:", categoryId);
    } catch (error) {
        console.error("Error deleting category:", error);
        res.status(500).json({ message: "Internal server error." });
    }
};



function removeSpaces(body) {
    const cleanedBody = {};

    for (const key in body) {
        if (typeof body[key] === 'string') {
            // Trim the string and normalize spaces for string values
            cleanedBody[key] = body[key].trim();
        } else {
            // Copy non-string values directly
            cleanedBody[key] = body[key];
        }
    }

    return cleanedBody;
}



  //Clean Data 
  function cleanExpenseData(data) {
    const cleanData = (value) => (value === null || value === undefined || value === "" ? undefined : value);
    return Object.keys(data).reduce((acc, key) => {
      acc[key] = cleanData(data[key]);
      return acc;
    }, {});
  }
  

  // Create New Expense
  function createNewExpense(data, organizationId, openingDate, userId, userName) {
    const newExpense = new Expense({ ...data, organizationId, createdDate: openingDate, userId, userName });
    return newExpense.save();
  }



  // Validate Organization Supplier Account
  function validateOrganizationSupplierAccount( organizationExists, accountExist, supplierExist, res ) {
    if (!organizationExists) {
      res.status(404).json({ message: "Organization not found" });
      return false;
    }
    if (!accountExist) {
      res.status(404).json({ message: "Accounts not found" });
      return false;
    }
    if (!supplierExist) {
      res.status(404).json({ message: "Supplier not found." });
      return false;
    }
    return true;
  }





  async function createTrialBalance (savedExpense) {

    const { organizationId, paidThrough, paidThroughId, expenseDate, expense } = savedExpense;

    // Calculate the total credit amount by summing up the amount for all expense items
    const totalCreditAmount = expense.reduce((sum, expenseItem) => sum + parseFloat(expenseItem.amount), 0);

    // Create a single credit entry for the paidThrough account
    const creditEntry = new TrialBalance({
        organizationId,
        operationId: savedExpense._id,
        transactionId: savedExpense._id,
        date: expenseDate,
        accountId: paidThroughId,
        accountName: paidThrough,
        action: "Expense",
        creditAmount: totalCreditAmount,
        remark: "Total credit for expenses"
    });

    await creditEntry.save();
    console.log("Credit Entry:", creditEntry);

    // Loop through each expense item to create individual debit entries
    for (const expenseItem of expense) {
        const { expenseAccountId, expenseAccount, note, amount } = expenseItem;

        // Create a debit entry for the expense account
        const debitEntry = new TrialBalance({
            organizationId,
            operationId: savedExpense._id,
            transactionId: savedExpense._id,
            date: expenseDate,
            accountId: expenseAccountId,
            accountName: expenseAccount,
            action: "Expense",
            debitAmount: parseFloat(amount),
            remark: note
        });

        await debitEntry.save();
        console.log("Debit Entry:", debitEntry);
    }
}






  
   

  //Validate inputs
  function validateInputs(data, organizationExists, res) {
    const validationErrors = validateExpenseData(data, organizationExists);

    // Additional tab-specific validation
    if (isExpenseMileage(data)) {
      validateExpenseMileageFields(data, validationErrors);
    } else {
      validateRecordExpenseFields(data, validationErrors);
    }
  
    if (validationErrors.length > 0) {
      res.status(400).json({ message: validationErrors.join(", ") });
      return false;
    }
    return true;
  }



  // Helper to identify Expense Mileage
  function isExpenseMileage(data) {
    return data.distance !== undefined && data.ratePerKm !== undefined;
  }



  //Validate Data
  function validateExpenseData(data, organizationExists) {
    const errors = [];

    //Basic Info
    validateReqFields( data, errors);
    validateFloatFields(['distance', 'ratePerKm'], data, errors);
    // validateIntegerFields(['distance', 'ratePerKm'], data, errors);
    //validateAlphabetsFields(['department', 'designation'], data, errors);

    validateExpenseType(data.expenseType, errors);
    validateSourceOfSupply(data.sourceOfSupply, organizationExists, errors);
    validateDestinationOfSupply(data.destinationOfSupply, organizationExists, errors);
    validateGSTorVAT(data, errors);
   
    return errors;
  }


  // Field validation utility
  function validateField(condition, errorMsg, errors) {
    if (condition) errors.push(errorMsg);
  }

  //Valid Req Fields
  function validateReqFields( data, errors ) {
    validateField( typeof data.expenseDate === 'undefined', "Please select Date", errors  );
    validateField( typeof data.paidThrough === 'undefined', "Please select paid through", errors  );
    validateField( typeof data.expenseAccount === 'undefined', "Please select expense account", errors  );

    // Determine if it is Expense Mileage or Record Expense
    const isMileage = data.distance !== undefined && data.ratePerKm !== undefined;

    if (isMileage) {
      // Fields specific to Expense Mileage
      validateField(typeof data.distance === "undefined", "Please enter distance", errors);
      validateField(typeof data.ratePerKm === "undefined", "Please enter rate per kilometer", errors);

      // Ensure distance and rate are valid numbers
      validateField(data.distance && !isFloat(data.distance), "Invalid distance value", errors);
      validateField(data.ratePerKm && !isFloat(data.ratePerKm), "Invalid rate per kilometer value", errors);
    } else {
      // Fields specific to Record Expense
      validateField(typeof data.expenseAccount === "undefined", "Please select expense account", errors);
      validateField(
        data.expenseCategory === undefined || data.expenseCategory === "",
        "Please select an expense category",
        errors
      );
      validateField(typeof data.amount === "undefined", "Please enter amount", errors);
    }

    // const interestPercentage = parseFloat(data.interestPercentage);
    // if ( interestPercentage > 100 ) {
    //   errors.push("Interest Percentage cannot exceed 100%");
    // }
  }


  // Validate Expense Type
  function validateExpenseType(expenseType, errors) {
    validateField(
      expenseType && !validExpenseType.includes(expenseType),
      "Invalid Expense Type: " + expenseType, errors );
  }

  // Validate source Of Supply
function validateSourceOfSupply(sourceOfSupply, organization, errors) {
  validateField(
    sourceOfSupply && !validCountries[organization.organizationCountry]?.includes(sourceOfSupply),
    "Invalid Source of Supply: " + sourceOfSupply, errors );
}

// Validate destination Of Supply
function validateDestinationOfSupply(destinationOfSupply, organization, errors) {
  validateField(
    destinationOfSupply && !validCountries[organization.organizationCountry]?.includes(destinationOfSupply),
    "Invalid Destination of Supply: " + destinationOfSupply, errors );
}

 // Validate GST or VAT details
 function validateGSTorVAT(data, errors) {
  data.expense.forEach((data) => {
    const taxRate = data.taxRate; 

    switch (taxRate) {
      case "GST":
        validateGSTDetails(data, errors);
        break;

      case "VAT":
        validateVATDetails(data, errors);
        break;

      case "None":
        clearTaxFields(data);
        break;

      default:
        // Handle unexpected taxType values
        errors.push(`Invalid taxRate: ${taxRate}`);
        break;
    }
  });
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




 //Valid Float Fields  
 function validateFloatFields(fields, data, errors) {
  fields.forEach((balance) => {
    validateField(data[balance] && !isFloat(data[balance]),
      "Invalid " + balance.replace(/([A-Z])/g, " $1") + ": " + data[balance], errors);
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



  //Return Date and Time 
function generateOpeningDate(organizationExists) {
  const date = generateTimeAndDateForDB(
      organizationExists.timeZoneExp,
      organizationExists.dateFormatExp,
      organizationExists.dateSplit
    )
  return date.dateTime;
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






// Utility Functions
const validExpenseType = [ "Goods", "Service" ];
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