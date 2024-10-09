const PurchaseOrder = require('../database/model/purchaseOrder');
const Organization = require('../database/model/organization');
const Item = require('../database/model/item');
const Supplier = require('../database/model/supplier');
const Customer = require('../database/model/customer');
const Tax = require('../database/model/tax');
const Prefix = require("../database/model/prefix");



// Fetch existing data
const dataExist = async (organizationId, supplierId, customerId, itemTable) => {
  const [organizationExists, supplierExists, customerExists, items, taxExists] = await Promise.all([
      Organization.findOne({ organizationId }),
      Supplier.findOne({ _id: supplierId }),
      Customer.findOne({ _id: customerId }),
      Promise.all(itemTable.map(item => Item.findOne({ _id: item.itemId }))),
      Tax.find({ organizationId })
  ]);
  return { organizationExists, supplierExists, customerExists, items, taxExists };
};

const shipment_preferences = ['Road', 'Rail', 'Air', 'Sea'];
const payment_modes = ['Cash', 'Credit Card', 'Debit Card', 'Bank Transfer', 'UPI', 'PayPal'];


// Add a new purchase order
exports.addPurchaseOrder = async (req, res) => {
  
  const { organizationId, supplierId, customerId, itemTable, taxType, ...otherDetails } = req.body;

  try {
      // Validate shipmentPreference and paymentMode
      if (!shipment_preferences.includes(shipmentPreference)) {
        return res.status(400).json({ message: "Invalid shipment preference." });
      }
      if (!payment_modes.includes(paymentMode)) {
        return res.status(400).json({ message: "Invalid payment mode." });
      }
    
      // Clean Data
      const cleanedData = cleanPurchaseOrderData(req.body);

      // Fetch existing data
      const { organizationExists, supplierExists, customerExists, items, taxExists } = await dataExist(organizationId, supplierId, customerId, itemTable);

      // Validate Inputs
      if (!validateInputs(organizationExists, supplierExists, customerExists, items, taxExists, res)) return;

      // Verify itemTable fields with Item schema
      if (!validateItemTable(items, itemTable, taxType, res)) return;

      // Check for existing purchase order
      if (await checkExistingPurchaseOrder(cleanedData.purchaseOrder, organizationId, res)) return;

      // Create new purchase order
      const savedPurchaseOrder = await createNewPurchaseOrder(cleanedData, organizationId);

      // Send success response
      res.status(201).json({ message: "Purchase order added successfully.", purchaseOrder: savedPurchaseOrder });
  } catch (error) {
      console.error("Error adding purchase order:", error);
      res.status(500).json({ message: "Internal server error." });
  }
};


// Get Last Journal Prefix
exports.getLastPurchaseOrderPrefix = async (req, res) => {
  try {
      const organizationId = "INDORG0001";

      // Find all accounts where organizationId matches
      const prefix = await Prefix.findOne({ organizationId:organizationId,'series.status': true });

      if (!prefix) {
          return res.status(404).json({
              message: "No Prefix found for the provided organization ID.",
          });
      }
      
      const series = prefix.series[0];     
      const lastPrefix = series.purchaseOrder + series.purchaseOrderNum;

      res.status(200).json(lastPrefix);
  } catch (error) {
      console.error("Error fetching accounts:", error);
      res.status(500).json({ message: "Internal server error." });
  }
};


// Ensure correct fields for taxType
const ensureCorrectFieldsBasedOnTaxType = (itemTable, taxType) => {
  itemTable.forEach(item => {
    if (taxType === 'GST') item.itemVat = undefined;
    else if (taxType === 'VAT') item.itemSgst = item.itemCgst = item.itemIgst = undefined;
  });
};

// Validate item table based on taxType
const validateItemTable = (items, itemTable, taxType, res) => {
  ensureCorrectFieldsBasedOnTaxType(itemTable, taxType);
  const fieldsToCheck = taxType === 'GST' ? [
    { tableField: 'itemSgst', itemField: 'sgst', error: 'SGST mismatch' },
    { tableField: 'itemCgst', itemField: 'cgst', error: 'CGST mismatch' },
    { tableField: 'itemIgst', itemField: 'igst', error: 'IGST mismatch' }
  ] : [{ tableField: 'itemVat', itemField: 'vat', error: 'VAT mismatch' }];

  for (let i = 0; i < itemTable.length; i++) {
    const tableItem = itemTable[i], dbItem = items[i];

    if (tableItem.itemProduct.trim() !== dbItem.itemName.trim())
      return res.status(400).json({ message: `Item name mismatch for itemId` });

    if (parseFloat(tableItem.itemSellingPrice) !== parseFloat(dbItem.sellingPrice))
      return res.status(400).json({ message: `Selling price mismatch for itemId` });

    for (const { tableField, itemField, error } of fieldsToCheck) {
      if (tableItem[tableField] !== undefined && dbItem[itemField] !== undefined && parseFloat(tableItem[tableField]) !== parseFloat(dbItem[itemField])) {
        return res.status(400).json({ message: `${error} for itemId` });
      }
    }
  }
  return true;
};

   

// Clean data
const cleanPurchaseOrderData = (data, taxType) => {
  const cleanData = value => (value == null || value === "" || value === 0 ? undefined : value);

  const cleanedData = { ...data, itemTable: data.itemTable.map(item => {
    const cleanedItem = Object.keys(item).reduce((acc, key) => (acc[key] = cleanData(item[key]), acc), {});

    if (taxType === 'GST') cleanedItem.itemVat = undefined;
    if (taxType === 'VAT') cleanedItem.itemSgst = cleanedItem.itemCgst = cleanedItem.itemIgst = undefined;
    
    return cleanedItem;
  })};
  return cleanedData;
};

// Validate inputs
const validateInputs = (organizationExists, supplierExists, customerExists, items, taxExists, res) => {
  if (!organizationExists) 
    return res.status(404).json({ message: "Organization not found" });
  if (!supplierExists) 
    return res.status(404).json({ message: "Supplier not found" });
  if (!customerExists) 
    return res.status(404).json({ message: "Customer not found" });
  if (items.some(item => !item)) 
    return res.status(404).json({ message: "Items not found" });
  if (!taxExists.length) 
    return res.status(404).json({ message: "No taxes found for the organization" });
  return true;
};

// Check for existing purchase order
async function checkExistingPurchaseOrder(purchaseOrder, organizationId, res) {
  const existingPurchaseOrder = await PurchaseOrder.findOne({ purchaseOrder, organizationId });
  if (existingPurchaseOrder) {
      res.status(409).json({ message: "Purchase order already exists." });
      return true; // Indicate that a duplicate exists
  }
  return false; // No duplicate found
}

// Create new purchase order
async function createNewPurchaseOrder(data, organizationId) {
  const newPurchaseOrder = new PurchaseOrder({ ...data, organizationId, status: "Open" });
  return newPurchaseOrder.save();
}







// // Add a new purchase order
// exports.addPurchaseOrder = async (req, res) => {
//   console.log("Add purchase order:", req.body);
//   // const { organizationId, id: userId, userName } = req.user;
//   const {
//     organizationId,
//     supplierId,
//     // supplierDisplayName,

//     //supplierBillingAddress
//     supplierBillingCountry,
//     supplierBillingState,

//     taxMode,

//     sourceOfSupply,
//     destinationOfSupply,
    
//     deliveryAddress,
//     customerId,

//     reference,
//     purchaseOrder,
//     shipmentPreference,
//     purchaseOrderDate,
//     expectedShipmentDate,
//     paymentTerms,
//     paymentMode,


//     discountType,
//     taxType,

//     //Item Table
//     itemTable,

//     //Other details
//     otherExpense,
//     otherExpenseReason,
//     freight,
//     vehicleNo,
//     addNotes,
//     termsAndConditions,
//     attachFiles,

//     //transaction details
//     subTotal,
//     totalItem,
//     sgst,
//     cgst,
//     igst,
//     vat,
//     transactionDiscount,
//     totalTaxAmount,
//     roundOff,
//     grandTotal,
//   } = req.body;

//   try {
//     // Validate organizationId
//     const organizationExists = await Organization.findOne({ organizationId });
//     if (!organizationExists) {
//       return res.status(404).json({ message: "Organization not found" });
//     }

//     // Check if a purchase order in this organizationId already exists
//     const existingPurchaseOrder = await PurchaseOrder.findOne({ purchaseOrder, organizationId });
//     if (existingPurchaseOrder) {
//       return res.status(409).json({ message: "Purchase order already exists." });
//     }

//     // Validate supplierId 
//     const supplier = await Supplier.findOne({ _id: supplierId });
//     if (!supplier) {
//       return res.status(404).json({ message: "Supplier not found" });
//     }

//     // Validate customerId
//     const customer = await Customer.findOne({ _id: customerId});
//     if (!customer) {
//       return res.status(404).json({ message: "customer not found" });
//     }

//     // Validate each item in the itemTable
//     for (const item of itemTable) {
//       const itemExists = await Item.findOne({ _id: item.itemId });
//       if (!itemExists) {
//         return res.status(404).json({ message: `Item with ID not found` });
//       }
//     }

//     // Create a new purchase order
//     const newPurchaseOrder = new PurchaseOrder({
//       organizationId,
//       supplierId,
//       // supplierDisplayName,

//       //supplierBillingAddress
//       supplierBillingCountry,
//       supplierBillingState,

//       taxMode,

//       sourceOfSupply,
//       destinationOfSupply,
      
//       deliveryAddress,
//       customerId,

//       reference,
//       purchaseOrder,
//       shipmentPreference,
//       purchaseOrderDate,
//       expectedShipmentDate,
//       paymentTerms,
//       paymentMode,

//       discountType,
//       taxType,

//       //Item Table
//       itemTable,

//       //Other details
//       otherExpense,
//       otherExpenseReason,
//       freight,
//       vehicleNo,
//       addNotes,
//       termsAndConditions,
//       attachFiles,

//       //transaction details
//       subTotal,
//       totalItem,
//       sgst,
//       cgst,
//       igst,
//       vat,
//       transactionDiscount,
//       totalTaxAmount,
//       roundOff,
//       grandTotal,
//       status: "Open"  // Set status to "Open" by default
//     });

//     // Save the purchase order to the database
//     const savedPurchaseOrder = await newPurchaseOrder.save();

//     // Send response
//     res.status(201).json({message: "Purchase order added successfully."});
//   } catch (error) {
//     console.error("Error adding purchase order:", error);
//     res.status(400).json({ error: error.message });
//   }
// };


// // Get all purchase orders for a given organizationId
// exports.getAllPurchaseOrders = async (req, res) => {
//   const {organizationId} = req.body;
//   try {
//     // Check if the Organization exists
//     const existingOrganization = await Organization.findOne({ organizationId });

//     if (!existingOrganization) {
//         return res.status(404).json({
//             message: "No Organization Found.",
//         });
//     }

//     // Find all purchase orders where organizationId matches
//     const purchaseOrders = await PurchaseOrder.find({ organizationId });
//     if (!purchaseOrders.length) {
//       return res.status(404).json({ message: "No purchase orders found for the provided organization ID." });
//     }
      
//     res.status(200).json(purchaseOrders);
//   } catch (error) {
//     console.error("Error fetching purchase orders:", error); 
//     res.status(500).json({ message: "Internal server error." });
//   }
// };

// // Get a single purchase order by ID
// exports.getPurchaseOrder = async (req, res) => {
//   try {
//     const purchaseOrderId = req.params.id;
//     const purchaseOrder = await PurchaseOrder.findById(purchaseOrderId);

//     if (!purchaseOrder) {
//       return res.status(404).json({ message: "Purchase order not found" });
//     }

//     res.status(200).json(purchaseOrder);
//   } catch (error) {
//     console.error("Error fetching purchase order:", error);
//     res.status(500).json({ message: "Internal server error." });
//   }
// };

// // Update a purchase order
// exports.updatePurchaseOrder = async (req, res) => {
//   console.log("Update purchase order:", req.body);

//   try {
//     const purchaseOrderId = req.params.id;
//     const {
//       organizationId,
//       supplierId,
//       // supplierDisplayName,

//       //supplierBillingAddress
//       supplierBillingCountry,
//       supplierBillingState,

//       taxMode,

//       sourceOfSupply,
//       destinationOfSupply,
      
//       deliveryAddress,
//       customerId,

//       sgst,
//       cgst,
//       igst,
//       vat,

//       reference,
//       purchaseOrder,
//       shipmentPreference,
//       purchaseOrderDate,
//       expectedShipmentDate,
//       paymentTerms,
//       paymentMode,

//       discountType,
//       taxType,

//       //Item Table
//       itemTable,

//       //Other details
//       otherExpense,
//       otherExpenseReason,
//       freight,
//       vehicleNo,
//       transportationMode,
//       addNotes,
//       termsAndConditions,
//       attachFiles,

//       //transaction details
//       subTotal,
//       totalItem,
//       transactionDiscount,
//       totalTaxAmount,
//       roundOff,
//       grandTotal,
//     } = req.body;

//     const currentDate = new Date();
//     const day = String(currentDate.getDate()).padStart(2, "0");
//     const month = String(currentDate.getMonth() + 1).padStart(2, "0");
//     const year = currentDate.getFullYear();
//     const formattedDate = `${day}-${month}-${year}`;

//     // Validate organizationId
//     const organizationExists = await Organization.findOne({ organizationId });
//     if (!organizationExists) {
//       return res.status(404).json({ message: "Organization not found" });
//     }

//     // Find and update the purchase order
//     const updatedPurchaseOrder = await PurchaseOrder.findByIdAndUpdate(
//       purchaseOrderId,
//       {
//         organizationId,
//         updatedDate: formattedDate,
//         supplierId,
//         // supplierDisplayName,

//         //supplierBillingAddress
//         supplierBillingCountry,
//         supplierBillingState,

//         taxMode,

//         sourceOfSupply,
//         destinationOfSupply,
        
//         deliveryAddress,
//         customerId,

//         sgst,
//         cgst,
//         igst,
//         vat,

//         reference,
//         purchaseOrder,
//         shipmentPreference,
//         purchaseOrderDate,
//         expectedShipmentDate,
//         paymentTerms,
//         paymentMode,

//         discountType,
//         taxType,

//         //Item Table
//         itemTable,

//         //Other details
//         otherExpense,
//         otherExpenseReason,
//         freight,
//         vehicleNo,
//         transportationMode,
//         addNotes,
//         termsAndConditions,
//         attachFiles,

//         //transaction details
//         subTotal,
//         totalItem,
//         transactionDiscount,
//         totalTaxAmount,
//         roundOff,
//         grandTotal,
//       },
//       { new: true, runValidators: true }
//     );

//     if (!updatedPurchaseOrder) {
//       return res.status(404).json({ message: "Purchase order not found" });
//     }

//     res.status(200).json({ message: "Purchase order updated successfully", purchaseOrder: updatedPurchaseOrder });
//   } catch (error) {
//     console.error("Error updating purchase order:", error);
//     res.status(500).json({ message: "Internal server error" });
//   }
// };



// // Delete a purchase order
// exports.deletePurchaseOrder = async (req, res) => {
//   const purchaseOrderId = req.params.id;

//   try {
//     const deletedPurchaseOrder = await PurchaseOrder.findByIdAndDelete(purchaseOrderId);

//     if (!deletedPurchaseOrder) {
//       return res.status(404).json({ error: 'Purchase order not found' });
//     }

//     res.status(200).json({ message: 'Purchase order deleted successfully' });
//   } catch (error) {
//     console.error("Error deleting purchase order:", error);
//     res.status(500).json({ error: 'Server error' });
//   }
// };




// validate item table fields


