// const PurchaseBill = require('../database/model/bills');
// const Organization = require('../database/model/organization');
// const Item = require('../database/model/item');
// const Supplier = require('../database/model/supplier');
// const Customer = require('../database/model/customer');

// // Add a new purchase bill
// exports.addPurchaseBill = async (req, res) => {
//   console.log("Add purchase bill:", req.body);
//   const {
//     organizationId,
//     supplierId,
//     supplierDisplayName,
//     billNumber,
//     billDate,
//     dueDate,
//     orderNumber,

//     supplierBillingCountry,
//     supplierBillingState,

//     taxMode,

//     sourceOfSupply,
//     destinationOfSupply,

//     paymentTerms,
//     paymentMode,

//     sgst,
//     cgst,
//     igst,
//     vat,

//     itemTable,

//     otherExpense,
//     otherExpenseReason,
//     freight,
//     vehicleNo,
//     transportationMode,
//     addNotes,
//     termsAndConditions,
//     attachFiles,

//     subTotal,
//     totalItem,
//     transactionDiscount,
//     totalTaxAmount,
//     roundOff,
//     grandTotal,
//     paidStatus,
//   } = req.body;

//   try {
//     // Validate organizationId
//     const organizationExists = await Organization.findOne({ organizationId });
//     if (!organizationExists) {
//       return res.status(404).json({ message: "Organization not found" });
//     }

//     // Check if the purchase bill already exists for the organization
//     const existingPurchaseBill = await PurchaseBill.findOne({ billNumber, organizationId });
//     if (existingPurchaseBill) {
//       return res.status(409).json({ message: "Purchase bill already exists." });
//     }

//     // Validate supplierId
//     const supplier = await Supplier.findOne({ _id: supplierId });
//     if (!supplier) {
//       return res.status(404).json({ message: "Supplier not found" });
//     }

//     // Validate each item in the itemTable
//     for (const item of itemTable) {
//       const itemExists = await Item.findOne({ _id: item.itemId });
//       if (!itemExists) {
//         return res.status(404).json({ message: `Item with ID ${item.itemId} not found` });
//       }
//     }

//     // Create a new purchase bill
//     const newPurchaseBill = new PurchaseBill({
//       organizationId,
//       supplierId,
//       supplierDisplayName,
//       billNumber,
//       billDate,
//       dueDate,
//       orderNumber,

 
//     supplierBillingCountry,
//     supplierBillingState,
    

//       taxMode,

//       sourceOfSupply,
//       destinationOfSupply,

//       sgst,
//       cgst,
//       igst,
//       vat,

//       paymentTerms,
//       paymentMode,

//       itemTable,

//       otherExpense,
//       otherExpenseReason,
//       freight,
//       vehicleNo,
//       transportationMode,
//       addNotes,
//       termsAndConditions,
//       attachFiles,

//       subTotal,
//       totalItem,
//       transactionDiscount,
//       totalTaxAmount,
//       roundOff,
//       grandTotal,
//       paidStatus
//     });

//     // Save the purchase bill to the database
//     const savedPurchaseBill = await newPurchaseBill.save();

//     // Send response
//     res.status(201).json({ message: "Purchase bill added successfully." });
//   } catch (error) {
//     console.error("Error adding purchase bill:", error);
//     res.status(400).json({ error: error.message });
//   }
// };

// // Get all purchase bills for a given organizationId
// exports.getAllPurchaseBills = async (req, res) => {
//   const { organizationId } = req.body;
//   try {
//     // Check if the Organization exists
//     const existingOrganization = await Organization.findOne({ organizationId });

//     if (!existingOrganization) {
//       return res.status(404).json({
//         message: "No Organization Found.",
//       });
//     }

//     // Find all purchase bills where organizationId matches
//     const purchaseBills = await PurchaseBill.find({ organizationId });
//     if (!purchaseBills.length) {
//       return res.status(404).json({ message: "No purchase bills found for the provided organization ID." });
//     }

//     res.status(200).json(purchaseBills);
//   } catch (error) {
//     console.error("Error fetching purchase bills:", error);
//     res.status(500).json({ message: "Internal server error." });
//   }
// };

// // Get a single purchase bill by ID
// exports.getPurchaseBill = async (req, res) => {
//   try {
//     const purchaseBillId = req.params.id;
//     const purchaseBill = await PurchaseBill.findById(purchaseBillId);

//     if (!purchaseBill) {
//       return res.status(404).json({ message: "Purchase bill not found" });
//     }

//     res.status(200).json(purchaseBill);
//   } catch (error) {
//     console.error("Error fetching purchase bill:", error);
//     res.status(500).json({ message: "Internal server error." });
//   }
// };

// // Update a purchase bill
// exports.updatePurchaseBill = async (req, res) => {
//   console.log("Update purchase bill:", req.body);

//   try {
//     const purchaseBillId = req.params.id;
//     const {
//       organizationId,
//       supplierId,
//       supplierDisplayName,
//       billNumber,
//       billDate,
//       dueDate,
//       orderNumber,

//       supplierBillingCountry,
//       supplierBillingState,

//       taxMode,

//       sourceOfSupply,
//       destinationOfSupply,

//       sgst,
//       cgst,
//       igst,
//       vat,

//       itemTable,

//       otherExpense,
//       otherExpenseReason,
//       freight,
//       vehicleNo,
//       transportationMode,
//       addNotes,
//       termsAndConditions,
//       attachFiles,

//       subTotal,
//       totalItem,
//       transactionDiscount,
//       totalTaxAmount,
//       roundOff,
//       grandTotal,
//       paidStatus,
//     } = req.body;

//     const currentDate = new Date();
//     const day = String(currentDate.getDate()).padStart(2, "0");
//     const month = String(currentDate.getMonth() + 1).padStart(2, "0");
//     const year = currentDate.getFullYear();
//     const formattedDate = `${day}-${month}-${year}`;

//     // Find and update the purchase bill
//     const updatedPurchaseBill = await PurchaseBill.findByIdAndUpdate(
//       purchaseBillId,
//       {
//         organizationId,
//         supplierId,
//         supplierDisplayName,
//         billNumber,
//         billDate,
//         dueDate,
//         orderNumber,


//         supplierBillingCountry,
//         supplierBillingState,


//         taxMode,

//         sourceOfSupply,
//         destinationOfSupply,

//         sgst,
//         cgst,
//         igst,
//         vat,

//         itemTable,

//         otherExpense,
//         otherExpenseReason,
//         freight,
//         vehicleNo,
//         transportationMode,
//         addNotes,
//         termsAndConditions,
//         attachFiles,

//         subTotal,
//         totalItem,
//         transactionDiscount,
//         totalTaxAmount,
//         roundOff,
//         grandTotal,
//         paidStatus,
//         updatedDate: formattedDate,
//       },
//       { new: true, runValidators: true }
//     );

//     if (!updatedPurchaseBill) {
//       return res.status(404).json({ message: "Purchase bill not found" });
//     }

//     res.status(200).json({ message: "Purchase bill updated successfully", purchaseBill: updatedPurchaseBill });
//   } catch (error) {
//     console.error("Error updating purchase bill:", error);
//     res.status(500).json({ message: "Internal server error" });
//   }
// };

// // Delete a purchase bill
// exports.deletePurchaseBill = async (req, res) => {
//   const purchaseBillId = req.params.id;

//   try {
//     const deletedPurchaseBill = await PurchaseBill.findByIdAndDelete(purchaseBillId);

//     if (!deletedPurchaseBill) {
//       return res.status(404).json({ error: 'Purchase bill not found' });
//     }

//     res.status(200).json({ message: 'Purchase bill deleted successfully' });
//   } catch (error) {
//     console.error("Error deleting purchase bill:", error);
//     res.status(500).json({ error: 'Server error' });
//   }
// };
