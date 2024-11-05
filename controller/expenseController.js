const Organization = require("../database/model/organization");
const Expense = require("../database/model/expense");
const Category = require("../database/model/expenseCategory");
const Account = require("../database/model/account")
const TrialBalance = require("../database/model/trialBalance");

const moment = require("moment-timezone");


const dataExist = async (organizationId) => {
    const [organizationExists, expenseExists,categoryExists,allAccounts] = await Promise.all([
      Organization.findOne({ organizationId },{ timeZoneExp: 1, dateFormatExp: 1, dateSplit: 1, organizationCountry: 1 }),
      Expense.find({ organizationId }),
      Category.find({ organizationId }),
      Account.find({ organizationId })
    ]);
    return { organizationExists, expenseExists, categoryExists,allAccounts};
  };
// Expense

//add expense
exports.addExpense = async (req, res) => {
  try {
      const { organizationId} = req.user;
      const cleanedData = cleanExpenseData(req.body);

      // Validate organizationId
      const { organizationExists, allAccounts } = await dataExist(organizationId);

      if (!organizationExists) {
          return res.status(404).json({ message: "Organization not found" });
      }

      if (!validateInputs(cleanedData, res)) return;

      // Extract all account IDs from allAccounts
      const accountIds = allAccounts.map(account => account._id.toString());
      // console.log(accountIds)
      // Check if each expense's expenseAccountId exists in allAccounts
      if(!accountIds.includes(cleanedData))
      for (let expenseItem of cleanedData.expense) {
          if (!accountIds.includes(expenseItem.expenseAccountId)) {
              return res.status(404).json({ message: `Account with ID ${expenseItem.expenseAccountId} not found` });
          }
      }

      // Create a new expense
      const savedExpense = await createNewExpense(cleanedData, organizationId);
      console.log(savedExpense)
      const savedTrialBalance= await createTrialBalance(savedExpense);


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

//update expense
exports.updateExpense = async (req, res) => {
    console.log("Update expense:", req.body);
    
    try {
        const expenseId = req.params.id;
        const {
            organizationId,
            expenseDate,
            expenseCategory,
            expenseName,
            amount,
            paymentMethod,
            expenseAccount, 
            expenseType, 
            hsnCode, 
            sacCode, 
            vendor, 
            gstTreatment, 
            vendorGSTIN, 
            source, 
            destination, 
            reverseCharge, 
            currency, 
            tax, 
            invoiceNo, 
            notes, 
            uploadFiles, 
            defaultMileageCategory, 
            defaultUnit, 
            startDate, 
            mileageRate, 
            date, 
            employee, 
            calculateMileageUsing, 
            distance
        } = req.body;

        // Validate organizationId
        const organizationExists = await Organization.findOne({
            organizationId: organizationId,
        });
        if (!organizationExists) {
            return res.status(404).json({
            message: "Organization not found",
            });
        }

        // Check if expenseName already exists for another expense
        const existingExpense = await Expense.findOne({ expenseName });
        if (existingExpense && existingExpense._id.toString() !== expenseId) {
            return res.status(400).json({ message: "expenseName already exists for another Expense" });
        }

        const currentDate = new Date();
        const day = String(currentDate.getDate()).padStart(2, "0");
        const month = String(currentDate.getMonth() + 1).padStart(2, "0");
        const year = currentDate.getFullYear();
        const formattedDate = `${day}-${month}-${year}`;

        const updatedExpense = await Expense.findByIdAndUpdate(
            expenseId,
            {
                organizationId,
                expenseDate: formattedDate,
                expenseCategory,
                expenseName,
                amount,
                paymentMethod,
                expenseAccount, 
                expenseType, 
                hsnCode, 
                sacCode, 
                vendor, 
                gstTreatment, 
                vendorGSTIN, 
                source, 
                destination, 
                reverseCharge, 
                currency, 
                tax, 
                invoiceNo, 
                notes, 
                uploadFiles, 
                defaultMileageCategory, 
                defaultUnit, 
                startDate, 
                mileageRate, 
                date, 
                employee, 
                calculateMileageUsing, 
                distance
            },
            { new: true, runValidators: true }
        );

        if (!updatedExpense) {
            console.log("Expense not found with ID:", expenseId);
            return res.status(404).json({ message: "Expense not found" });
        }

        res.status(200).json({ message: "Expense updated successfully", expense: updatedExpense });
        console.log("Expense updated successfully:", updatedExpense);
    } catch (error) {
        console.error("Error updating expense:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

//delete expense
exports.deleteExpense = async (req, res) => {
    console.log("Delete expense:", req.body);
    try {
        const { id } = req.params;
        const { organizationId } = req.body;

        // Validate organizationId
        const organizationExists = await Organization.findOne({
            organizationId: organizationId,
        });
        if (!organizationExists) {
            return res.status(404).json({
            message: "Organization not found",
            });
        }

        const expense = await Expense.findById(id);

        if (!expense) {
            return res.status(404).json({ message: "Expense not found." });
        }

        await Expense.findByIdAndDelete(id);

        res.status(200).json({ message: "Expense deleted successfully." });
        console.log("Expense deleted successfully:", id);
    } catch (error) {
        console.error("Error deleting expense:", error);
        res.status(500).json({ message: "Internal server error." });
    }
};



// Expense Category
//add category
exports.addCategory = async (req, res) => {

    try {
        const { organizationId } = req.user;
        console.log(organizationId);
        
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
        const newCategory = new Category({ organizationId, expenseCategory, description });
        await newCategory.save();

        res.status(201).json({ message: "Category created successfully"});
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
      const {   id } = req.params;
      const { organizationId } = req.user;

      const {organizationExists} = await dataExist(organizationId);
  
      if (!organizationExists) {
        return res.status(404).json({
          message: "Organization not found",
        });
      }
  
      // Find the Customer by   supplierId and organizationId
      const category = await Category.findOne({
        _id:   id,
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
        const categoryId = req.params.id;
        const cleanBody = removeSpaces(req.body)
        const { organizationId } = req.user;

        const {
            
            expenseCategory,
            discription,
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
                discription,
            },
            { new: true, runValidators: true }
        );

        if (!updatedCategory) {
            console.log("Category not found with ID:", categoryId);
            return res.status(404).json({ message: "Category not found" });
        }

        res.status(200).json({ message: "Category updated successfully"});
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
        const { id } = req.params;
        const { organizationId } = req.body;

        // Validate organizationId
        const organizationExists = await Organization.findOne({
            organizationId: organizationId,
        });
        if (!organizationExists) {
            return res.status(404).json({
            message: "Organization not found",
            });
        }

        const category = await Category.findById(id);

        if (!category) {
            return res.status(404).json({ message: "Category not found." });
        }

        await Category.findByIdAndDelete(id);

        res.status(200).json({ message: "Category deleted successfully." });
        console.log("Category deleted successfully:", id);
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
  
  function createNewExpense(data,organizationId) {
    const newExpense = new Expense({ ...data, organizationId,});
    return newExpense.save();
  }

  async function createTrialBalance(savedExpense) {
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

   


  function validateInputs(data,  res) {
    // const validCurrencies = currencyExists.map((currency) => currency.currencyCode);
    // const validTaxTypes = ["None", taxExists.taxType];
    const validationErrors = validateExpenseData(data);
  
    if (validationErrors.length > 0) {
      res.status(400).json({ message: validationErrors.join(", ") });
      return false;
    }
    return true;
  }

  function validateExpenseData(data) {
    const errors = [];

    //Basic Info
    
    // validateReqFields( data,  errors);
    // validateIntegerFields(['distance', 'ratePerKm'], data, errors);
    validateFloatFields(['distance', 'ratePerKm'], data, errors);
    // validateAlphabetsFields(['department', 'designation','billingAttention','shippingAttention'], data, errors); 
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

 //Valid Float Fields  
 function validateFloatFields(fields, data, errors) {
  fields.forEach((balance) => {
    validateField(data[balance] && !isFloat(data[balance]),
      "Invalid " + balance.replace(/([A-Z])/g, " $1") + ": " + data[balance], errors);
  });
}

  // Field validation utility
  function validateField(condition, errorMsg, errors) {
    if (condition) errors.push(errorMsg);
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