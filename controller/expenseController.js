const Organization = require("../database/model/organization");
const Expense = require("../database/model/expense");
const Category = require("../database/model/expenseCategory");

// Expense
//add expense
exports.addExpense = async (req, res) => {
    console.log("add expense:", req.body);
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

    try {

        // Validate organizationId
        const organizationExists = await Organization.findOne({
            organizationId: organizationId,
        });
        if (!organizationExists) {
            return res.status(404).json({
            message: "Organization not found",
            });
        }

         // Check if a expense with the same organizationId already exists
        const existingExpense = await Expense.findOne({
            expenseName: expenseName,
            organizationId: organizationId,
          });
          if (existingExpense) {
            return res.status(409).json({
              message: "Expense with the provided organizationId already exists.",
            });
          }   
          
          const currentDate = new Date();
        const day = String(currentDate.getDate()).padStart(2, "0");
        const month = String(currentDate.getMonth() + 1).padStart(2, "0");
        const year = currentDate.getFullYear();
        const formattedDate = `${day}-${month}-${year}`;
        

        // Create a new expense
        const newExpense = new Expense({
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
        });

        // Save the expense to the database
        await newExpense.save();

    } catch (error) {
        console.error("Error adding expense:", error);
        res.status(400).json({ error: error.message });
    }
};

//get all expense
exports.getAllExpense = async (req, res) => {
    try {
        const { organizationId } = req.body;
        console.log(organizationId);

        const expense = await Expense.findOne({organizationId: organizationId});
        console.log(expense);

        if (!expense) {
            return res.status(404).json({
              message: "No expense found for the provided organization ID.",
            });
          }
      
        res.status(200).json(expense);
    } catch (error) {
        console.error("Error fetching expense:", error);
        res.status(500).json({ message: "Internal server error." });
    }
};

//get a expense
exports.getAExpense = async (req, res) => {
    try {
        const expenseId = req.params.id;
        const { organizationId } = req.body;

        // Find the expense by expenseId and organizationId
        const expense = await Expense.findById({
            _id: expenseId,
            organizationId: organizationId,
        });

        if (!expense) {
            return res.status(404).json({ message: "Expense not found for the provided Organization ID." });
        }

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
    console.log("add category:", req.body);
    const {
        organizationId,
        expenseCategory,
        discription,
    } = req.body;

    try {

        // Validate organizationId
        const organizationExists = await Organization.findOne({
            organizationId: organizationId,
        });
        if (!organizationExists) {
            return res.status(404).json({
            message: "Organization not found",
            });
        }

         // Check if a category with the same organizationId already exists
        const existingCategory = await Category.findOne({
            expenseCategory: expenseCategory,
            organizationId: organizationId,
          });
          if (existingCategory) {
            return res.status(409).json({
              message: "Category with the provided organizationId already exists.",
            });
          }      
        

        // Create a new category
        const newCategory = new Category({
            organizationId,
            expenseCategory,
            discription,
        });

        // Save the category to the database
        await newCategory.save();

    } catch (error) {
        console.error("Error adding category:", error);
        res.status(400).json({ error: error.message });
    }
};

//get all category
exports.getAllCategory = async (req, res) => {
    try {
        const { organizationId } = req.body;
        console.log(organizationId);

        const categories = await Category.findOne({organizationId: organizationId});
        console.log(categories);

        if (!categories) {
            return res.status(404).json({
              message: "No categories found for the provided organization ID.",
            });
          }
      
        res.status(200).json(categories);
    } catch (error) {
        console.error("Error fetching categories:", error);
        res.status(500).json({ message: "Internal server error." });
    }
};

//get a category
exports.getACategory = async (req, res) => {
    try {
        const categoryId = req.params.id;
        const { organizationId } = req.body;

        // Find the category by categoryId and organizationId
        const category = await Category.findById({
            _id: categoryId,
            organizationId: organizationId,
        });

        if (!category) {
            return res.status(404).json({ message: "Category not found for the provided Organization ID." });
        }

        res.status(200).json(category);
    } catch (error) {
        console.error("Error fetching category:", error);
        res.status(500).json({ message: "Internal server error." });
    }
};

//update category
exports.updateCategory = async (req, res) => {
    console.log("Update category:", req.body);
    
    try {
        const categoryId = req.params.id;
        const {
            organizationId,
            expenseCategory,
            discription,
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

        // Check if supplierEmail already exists for another supplier
        const existingCategory = await Category.findOne({ expenseCategory });
        if (existingCategory && existingCategory._id.toString() !== categoryId) {
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

        res.status(200).json({ message: "Category updated successfully", category: updatedCategory });
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