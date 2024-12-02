const Bills = require('../database/model/bills');
const PurchaseOrder = require('../database/model/purchaseOrder');
const Organization = require('../database/model/organization');
const Supplier = require('../database/model/supplier');
const Item = require('../database/model/item');
const Settings = require("../database/model/settings");
const ItemTrack = require("../database/model/itemTrack");
const Tax = require('../database/model/tax');  
const moment = require("moment-timezone");
const mongoose = require('mongoose');



// Fetch existing data
const dataExist = async ( organizationId, supplierId, purchaseOrderId ) => {
    const [organizationExists, supplierExist, purchaseOrderExist, taxExists, settings] = await Promise.all([
      Organization.findOne({ organizationId }, { organizationId: 1, organizationCountry: 1, state: 1 }),
      Supplier.findOne({ organizationId , _id:supplierId}, { _id: 1, supplierDisplayName: 1, taxType: 1 }),
      PurchaseOrder.findOne({organizationId , _id:purchaseOrderId}),
      Tax.findOne({ organizationId }),
      Settings.findOne({ organizationId })
    ]);    
  return { organizationExists, supplierExist, purchaseOrderExist, taxExists, settings };
};


//Fetch Item Data
const newDataExists = async (organizationId, items) => {
  // Retrieve items with specified fields
  const itemIds = items.map(item => item.itemId);

  const [newItems] = await Promise.all([
    Item.find({ organizationId, _id: { $in: itemIds } }, { _id: 1, itemName: 1, taxPreference: 1, costPrice:1,  taxRate: 1, cgst: 1, sgst: 1, igst: 1, vat: 1 }),
  ]);

  // Aggregate ItemTrack to get the latest entry for each itemId
  const itemTracks = await ItemTrack.aggregate([
    { $match: { itemId: { $in: itemIds } } },
    { $sort: { _id: -1 } },
    { $group: { _id: "$itemId", lastEntry: { $first: "$$ROOT" } } }
  ]);

  // Map itemTracks by itemId for easier lookup
  const itemTrackMap = itemTracks.reduce((acc, itemTrack) => {
    acc[itemTrack._id] = itemTrack.lastEntry;
    return acc;
  }, {});

  // Attach the last entry from ItemTrack to each item in newItems
  const itemTable = newItems.map(item => ({
    ...item._doc, // Copy item fields
    lastEntry: itemTrackMap[item._id] || null, // Attach lastEntry if found
    currentStock: itemTrackMap[item._id.toString()] ? itemTrackMap[item._id.toString()].currentStock : null
  }));

  return { itemTable };
};



const billsDataExist = async ( organizationId, billId ) => {    
    const [organizationExists, allBills, bill ] = await Promise.all([
      Organization.findOne({ organizationId }, { organizationId: 1}),
      Bills.find({ organizationId }),
      Bills.findOne({ organizationId , _id: billId })
    ]);
    return { organizationExists, allBills, bill };
  };



// Add Bills
exports.addBills = async (req, res) => {
    console.log("Add bills:", req.body);
  
    try {
      const { organizationId, id: userId, userName } = req.user;
  
      //Clean Data
      const cleanedData = cleanBillsData(req.body);
  
      const { items, purchaseOrderId } = cleanedData;
      const { supplierId } = cleanedData;
    //   const { orderNumber } = cleanedData;
      
        const itemIds = items.map(item => item.itemId);      
      
      // Check for duplicate itemIds
      const uniqueItemIds = new Set(itemIds);
      if (uniqueItemIds.size !== itemIds.length) {
        return res.status(400).json({ message: "Duplicate Item found" });
      }
  
      //Validate Supplier
      if (!mongoose.Types.ObjectId.isValid(supplierId) || supplierId.length !== 24) {
        return res.status(400).json({ message: `Invalid supplier ID: ${supplierId}` });
      }
  
      // Validate purchase order only if `purchaseOrderId` exists
      if (purchaseOrderId) {
        if (!mongoose.Types.ObjectId.isValid(purchaseOrderId) || purchaseOrderId.length !== 24) {
            return res.status(400).json({ message: `Invalid Purchase Order ID: ${purchaseOrderId}` });
        }
      }
  
      // Validate ItemIds
      const invalidItemIds = itemIds.filter(itemId => !mongoose.Types.ObjectId.isValid(itemId) || itemId.length !== 24);
      if (invalidItemIds.length > 0) {
        return res.status(400).json({ message: `Invalid item IDs: ${invalidItemIds.join(', ')}` });
      }   
  
      const { organizationExists, supplierExist, purchaseOrderExist, taxExists, settings } = await dataExist( organizationId, supplierId, purchaseOrderId );
  
      const { itemTable } = await newDataExists( organizationId, items );
  
      //Data Exist Validation
      if (!validateOrganizationSupplierOrder( organizationExists, supplierExist,  res )) return;
  
      //Validate Inputs  
      if (!validateInputs( cleanedData, supplierExist, purchaseOrderExist, items, itemTable, organizationExists, res)) return;

      //Check Bill Exist
      if (await checkExistingBill(cleanedData.billNumber, organizationId, res)) return;
  
      //Date & Time
      const openingDate = generateOpeningDate(organizationExists);
  
      //Tax Type
      taxtype(cleanedData, supplierExist );
      
      // Calculate Sales 
      if (!calculateBills( cleanedData, itemTable, res )) return;
  
      const savedBills = await createNewBills(cleanedData, organizationId, openingDate, userId, userName );
  
      //Item Track
      await itemTrack( savedBills, itemTable );

      // Delete the associated purchase order if purchaseOrderId is provided
      if (purchaseOrderId) {
        await deletePurchaseOrder(purchaseOrderId, organizationId, res);
      }

      // savedBills.organizationId = undefined;
      Object.assign(savedBills, { organizationId: undefined, purchaseOrderId: undefined });
        
      res.status(201).json({ message: "Bills created successfully", savedBills });
      // console.log( "Bills created successfully:", savedBills );
    } catch (error) {
      console.error("Error Creating Bills:", error);
      res.status(500).json({ message: "Internal server error." });
    }
  }
  
  
  
  // Get All Bills
  exports.getAllBills = async (req, res) => {
    try {
      const organizationId = req.user.organizationId;
  
      const { organizationExists, allBills } = await billsDataExist(organizationId);
  
      if (!organizationExists) {
        return res.status(404).json({
          message: "Organization not found",
        });
      }
  
      if (!allBills.length) {
        return res.status(404).json({
          message: "No Bills Note found",
        });
      }

        // Get current date for comparison
        const currentDate = new Date();

        // Array to store purchase bills with updated status
        const updatedBills = [];

        // Map through purchase bills and update paidStatus if needed
        for (const bill of allBills) {
        const { organizationId, balanceAmount, dueDate, paidStatus: currentStatus, ...rest } = bill.toObject();
        
        // Determine the correct paidStatus based on balanceAmount and dueDate
        let newStatus;
        if (balanceAmount === 0) {
            newStatus = 'Completed';
        } else if (dueDate && new Date(dueDate) < currentDate) {
            newStatus = 'Overdue';
        } else {
            newStatus = 'Pending';
        }

        // Update the bill's status only if it differs from the current status in the database
        if (newStatus !== currentStatus) {
            await Bills.updateOne({ _id: bill._id }, { paidStatus: newStatus });
        }

        // Push the bill object with the updated status to the result array
        updatedBills.push({ ...rest, balanceAmount , dueDate , paidStatus: newStatus });
        }

        // Map over all purchaseOrder to remove the organizationId from each object
        const sanitizedBills = updatedBills.map(order => {
          const { organizationId, ...rest } = order; 
          return rest;
        });
  
      res.status(200).json({allBills: sanitizedBills});
    } catch (error) {
      console.error("Error fetching bills:", error);
      res.status(500).json({ message: "Internal server error." });
    }
  };
  
  
  // Get One Bill
  exports.getOneBill = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const billId = req.params.billId;
  
    const { organizationExists, bill } = await billsDataExist(organizationId, billId);
  
    if (!organizationExists) {
      return res.status(404).json({
        message: "Organization not found",
      });
    }
  
    if (!bill) {
      return res.status(404).json({
        message: "No bill found",
      });
    }

    
    // Fetch item details associated with the bill
    const itemIds = bill.items.map(item => item.itemId);

    // Retrieve items including itemImage
    const itemsWithImages = await Item.find(
      { _id: { $in: itemIds }, organizationId },
      { _id: 1, itemName: 1, itemImage: 1 } 
    );

    // Map the items to include item details
    const updatedItems = bill.items.map(billItem => {
      const itemDetails = itemsWithImages.find(item => item._id.toString() === billItem.itemId.toString());
      return {
        ...billItem.toObject(),
        itemName: itemDetails ? itemDetails.itemName : null,
        itemImage: itemDetails ? itemDetails.itemImage : null,
      };
    });

    // Attach updated items back to the bill
    const updatedBill = {
      ...bill.toObject(),
      items: updatedItems,
    };

    updatedBill.organizationId = undefined;

    res.status(200).json(updatedBill);
  } catch (error) {
    console.error("Error fetching bill:", error);
    res.status(500).json({ message: "Internal server error." });
  }
  };


  // Delete Purchase Order
  async function deletePurchaseOrder(purchaseOrderId, organizationId, res) {
    try {
      const deletedOrder = await PurchaseOrder.findOneAndDelete({ _id: purchaseOrderId, organizationId });
      if (!deletedOrder) {
        console.warn(`Purchase Order with ID: ${purchaseOrderId} not found for Organization: ${organizationId}`);
      }
      return deletedOrder;      
    } catch (error) {
      console.error(`Error deleting Purchase Order: ${error}`);
      res.status(500).json({ message: "Error deleting the Purchase Order." });
      return null;
    }
  }








  // Create New Debit Note
  function createNewBills( data, organizationId, openingDate, userId, userName ) {
    const newBill = new Bills({ ...data, organizationId, createdDate: openingDate, userId, userName });
    return newBill.save();
  }


  // Check for existing bill
  async function checkExistingBill(billNumber, organizationId, res) {
    const existingBill = await Bills.findOne({ billNumber, organizationId });
    if (existingBill) {
      res.status(409).json({ message: "Bill already exists." });
      return true;
    }
    return false;
  }
  
  
  //Clean Data 
  function cleanBillsData(data) {
    const cleanData = (value) => (value === null || value === undefined || value === "" ? undefined : value);
    return Object.keys(data).reduce((acc, key) => {
      acc[key] = cleanData(data[key]);
      return acc;
    }, {});
  }
  
  
  // Validate Organization Tax Currency
  function validateOrganizationSupplierOrder( organizationExists, supplierExist, res ) {
    if (!organizationExists) {
      res.status(404).json({ message: "Organization not found" });
      return false;
    }
    if (!supplierExist) {
      res.status(404).json({ message: "Supplier not found." });
      return false;
    }
    return true;
  }
  
  
  
  // Tax Type
  function taxtype( cleanedData, supplierExist ) {
    if(supplierExist.taxType === 'GST' ){
      if(cleanedData.sourceOfSupply === cleanedData.destinationOfSupply){
        cleanedData.taxMode ='Intra';
      }
      else{
        cleanedData.taxMode ='Inter';
      }
    }
    if(supplierExist.taxType === 'VAT' ){
      cleanedData.taxMode ='VAT'; 
    }
    return   
  }





  function calculateBills(cleanedData, itemTable, res) {
    const errors = [];
  
    let otherExpense = (cleanedData.otherExpense || 0);
    let freightAmount = (cleanedData.freight || 0);
    let roundOffAmount = (cleanedData.roundOff || 0);
    let subTotal = 0;
    let totalTaxAmount = 0;
    let itemTotalDiscount= 0;
    let totalItem = 0;
    let transactionDiscountAmount = 0;
    let grandTotal = 0;
    let balanceAmount = 0;
    let paidAmount = (cleanedData.paidAmount || 0);
  
    // Utility function to round values to two decimal places
    const roundToTwoDecimals = (value) => Number(value.toFixed(2));  
  
    cleanedData.items.forEach(item => {
  
      let calculatedItemCgstAmount = 0;
      let calculatedItemSgstAmount = 0;
      let calculatedItemIgstAmount = 0;
      let calculatedItemVatAmount = 0;
      let calculatedItemTaxAmount = 0;
      let itemAmount = 0;
      let taxMode = cleanedData.taxMode;
  
      // Calculate item line discount 
      const itemDiscAmt = calculateItemDiscount(item);
  
      itemTotalDiscount +=  parseFloat(itemDiscAmt);
      totalItem +=  parseInt(item.itemQuantity);
      subTotal += parseFloat(item.itemQuantity * item.itemCostPrice);
  
      itemAmount = (item.itemCostPrice * item.itemQuantity - itemDiscAmt);
  
      // Handle tax calculation only for taxable items
      if (item.taxPreference === 'Taxable') {
        switch (taxMode) {
          
          case 'Intra':
            calculatedItemCgstAmount = ((item.itemCgst / 100) * itemAmount);
            calculatedItemSgstAmount = roundToTwoDecimals((item.itemSgst / 100) * itemAmount);
          break;
  
          case 'Inter':
            calculatedItemIgstAmount = roundToTwoDecimals((item.itemIgst / 100) * itemAmount);
          break;
          
          case 'VAT':
            calculatedItemVatAmount = roundToTwoDecimals((item.itemVat / 100) * itemAmount);
          break;
  
        }
  
        calculatedItemTaxAmount =  calculatedItemCgstAmount + calculatedItemSgstAmount + calculatedItemIgstAmount + calculatedItemVatAmount;
        
        // Check tax amounts
        checkAmount(calculatedItemCgstAmount, item.itemCgstAmount, item.itemName, 'CGST',errors);
        checkAmount(calculatedItemSgstAmount, item.itemSgstAmount, item.itemName, 'SGST',errors);
        checkAmount(calculatedItemIgstAmount, item.itemIgstAmount, item.itemName, 'IGST',errors);
        checkAmount(calculatedItemVatAmount, item.itemVatAmount, item.itemName, 'VAT',errors);
        checkAmount(calculatedItemTaxAmount, item.itemTax, item.itemName, 'Item tax',errors);
  
        totalTaxAmount += calculatedItemTaxAmount;
  
      } else {
        console.log(`Skipping Tax for Non-Taxable item: ${item.itemName}`);
        console.log(`Item: ${item.itemName}, Calculated Discount: ${itemDiscAmt}`);
      }
  
      checkAmount(itemAmount, item.itemAmount, item.itemName, 'Item Total',errors);
  
      console.log(`${item.itemName} Item Total: ${itemAmount} , Provided ${item.itemAmount}`);
      console.log(`${item.itemName} Total Tax: ${calculatedItemTaxAmount} , Provided ${item.itemTax || 0 }`);
      console.log("");
    });
  
    const total = (
        (subTotal + totalTaxAmount + otherExpense + freightAmount - roundOffAmount) - itemTotalDiscount
    );
  
    console.log(`SubTotal: ${subTotal} , Provided ${cleanedData.subTotal}`);
    console.log(`Total: ${total} , Provided ${total}`);
    console.log(`subTotal: ${subTotal} , Provided ${cleanedData.subTotal}`);
    console.log(`totalTaxAmount: ${totalTaxAmount} , Provided ${cleanedData.totalTaxAmount}`);
    console.log(`otherExpense: ${otherExpense} , Provided ${cleanedData.otherExpense}`);
    console.log(`freightAmount: ${freightAmount} , Provided ${cleanedData.freightAmount}`);
    console.log(`roundOffAmount: ${roundOffAmount} , Provided ${cleanedData.roundOffAmount}`);
    console.log(`itemTotalDiscount: ${itemTotalDiscount} , Provided ${cleanedData.itemTotalDiscount}`);
  
    // Transaction Discount
    let transDisAmt = calculateTransactionDiscount(cleanedData, total, transactionDiscountAmount); 
  
    // grandTotal amount calculation with including transactionDiscount
    grandTotal = total - transDisAmt; 
    console.log(`Grand Total: ${grandTotal} , Provided ${cleanedData.grandTotal}`);

    // Calculate balanceAmount
    balanceAmount = grandTotal - parseFloat(paidAmount)
  
    // Round the totals for comparison
    const roundedSubTotal = roundToTwoDecimals(subTotal); 
    const roundedTotalTaxAmount = roundToTwoDecimals(totalTaxAmount);
    const roundedGrandTotalAmount = roundToTwoDecimals(grandTotal);
    const roundedTotalItemDiscount = roundToTwoDecimals(itemTotalDiscount);
    const roundedBalanceAmount = roundToTwoDecimals(balanceAmount); 
  
    console.log(`Final Sub Total: ${roundedSubTotal} , Provided ${cleanedData.subTotal}` );
    console.log(`Final Total Tax Amount: ${roundedTotalTaxAmount} , Provided ${cleanedData.totalTaxAmount}` );
    console.log(`Final Total Amount: ${roundedGrandTotalAmount} , Provided ${cleanedData.grandTotal}` );
    console.log(`Final Total Item Discount Amount: ${roundedTotalItemDiscount} , Provided ${cleanedData.itemTotalDiscount}` );
    console.log(`Final Balance Amount: ${roundedBalanceAmount} , Provided ${cleanedData.balanceAmount}` );
  
    validateAmount(roundedSubTotal, cleanedData.subTotal, 'SubTotal', errors);
    validateAmount(roundedTotalTaxAmount, cleanedData.totalTaxAmount, 'Total Tax Amount', errors);
    validateAmount(roundedGrandTotalAmount, cleanedData.grandTotal, 'Grand Total', errors);
    validateAmount(roundedTotalItemDiscount, cleanedData.itemTotalDiscount, 'Total Item Discount Amount', errors);
    validateAmount(roundedBalanceAmount, cleanedData.balanceAmount, 'Balance Amount', errors);
    validateAmount(totalItem, cleanedData.totalItem, 'Total Item count', errors);
  
    if (errors.length > 0) {
      res.status(400).json({ message: errors.join(", ") });
      return false;
    }
  
    return true;
  }
  
  
  // Calculate item discount
  function calculateItemDiscount(item) {
    return item.itemDiscountType === 'currency'
      ? item.itemDiscount || 0
      : (item.itemCostPrice * item.itemQuantity * (item.itemDiscount || 0)) / 100;    //if percentage
  }
  
  
  //TransactionDiscount
  function calculateTransactionDiscount(cleanedData, total, transactionDiscountAmount) {
    transactionDiscountAmount = cleanedData.transactionDiscount || 0;
  
    return cleanedData.transactionDiscountType === 'currency'
      ? transactionDiscountAmount
      : (total * cleanedData.transactionDiscount) / 100;    //if percentage
  }
  
  
  //Mismatch Check
  function checkAmount(calculatedAmount, providedAmount, itemName, taxMode, errors) {
    const roundToTwoDecimals = (value) => Number(value.toFixed(2)); // Round to two decimal places
    const roundedAmount = roundToTwoDecimals(calculatedAmount);
    console.log(`Item: ${itemName}, Calculated ${taxMode}: ${roundedAmount}, Provided data: ${providedAmount}`);
  
    if (Math.abs(roundedAmount - providedAmount) > 0.01) {
      const errorMessage = `Mismatch in ${taxMode} for item ${itemName}: Calculated ${calculatedAmount}, Provided ${providedAmount}`;
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





  //Validate inputs
function validateInputs( data, supplierExist, purchaseOrderExist, items, itemExists, organizationExists, res) {
    const validationErrors = validateBillsData(data, supplierExist, purchaseOrderExist, items, itemExists, organizationExists);  
  
    if (validationErrors.length > 0) {
      res.status(400).json({ message: validationErrors.join(", ") })
      ;
      return false;
    }
    return true;
  }
  
  //Validate Data
  function validateBillsData( data, supplierExist, purchaseOrderExist, items, itemTable, organizationExists ) {
    const errors = [];
  
    // console.log("Item Request :",items);
    // console.log("Item Fetched :",itemTable);
  
    //Basic Info
    validateReqFields( data, supplierExist, errors );
    validateItemTable(items, itemTable, errors);
    // Activate `validatePurchaseOrderData` only when `purchaseOrderId` is present
    if (data.purchaseOrderId) {
      validatePurchaseOrderData(data, purchaseOrderExist, items, errors);
    }
    validateShipmentPreferences(data.shipmentPreference, errors)
    validateTransactionDiscountType(data.transactionDiscountType, errors);
    // console.log("billExist Data:", billExist.billNumber, billExist.billDate, billExist.orderNumber)
  
    //OtherDetails
    validateIntegerFields(['totalItem'], data, errors);
    validateFloatFields(['transactionDiscountAmount','subTotal','cgst','sgst','igst','vat','totalTaxAmount','grandTotal'], data, errors);
    //validateAlphabetsFields(['department', 'designation'], data, errors);
  
    //Tax Details
    //validateTaxType(data.taxType, validTaxTypes, errors);
    validateSourceOfSupply(data.sourceOfSupply, organizationExists, errors);
    validateDestinationOfSupply(data.destinationOfSupply, organizationExists, errors);
    validatePaymentTerms(data.paymentTerms, errors);
    validatePaymentMode(data.paymentMode, errors);
    //validateGSTorVAT(data, errors);
  
    //Currency
    //validateCurrency(data.currency, validCurrencies, errors);
  
    //Address
    //validateBillingAddress(data, errors);
    //validateShippingAddress(data, errors);  
    return errors;
  }
  
  
  
  // Field validation utility
  function validateField(condition, errorMsg, errors) {
    if (condition) errors.push(errorMsg);
  }
  
  
  //Valid Req Fields
  function validateReqFields( data, supplierExist, errors ) {
  validateField( typeof data.supplierId === 'undefined' || typeof data.supplierDisplayName === 'undefined', "Please select a Supplier", errors  );
  validateField( supplierExist.taxtype == 'GST' && typeof data.sourceOfSupply === 'undefined', "Source of supply required", errors  );
  validateField( supplierExist.taxtype == 'GST' && typeof data.destinationOfSupply === 'undefined', "Destination of supply required", errors  );
  validateField( typeof data.items === 'undefined', "Select an item", errors  );
  validateField( typeof data.billNumber === 'undefined', "Select an bill number", errors  );
  }
  
  
  // Function to Validate Item Table 
  function validateItemTable(items, itemTable, errors) {
  // Check for item count mismatch
  validateField( items.length !== itemTable.length, "Mismatch in item count between request and database.", errors  );
  
  // Iterate through each item to validate individual fields
  items.forEach((item) => {
    const fetchedItem = itemTable.find(it => it._id.toString() === item.itemId);
  
    // Check if item exists in the item table
    validateField( !fetchedItem, `Item with ID ${item.itemId} was not found.`, errors );
    if (!fetchedItem) return; 
  
    // Validate item name
    validateField( item.itemName !== fetchedItem.itemName, `Item Name Mismatch : ${item.itemName}`, errors );
  
    // Validate cost price
    validateField( item.itemCostPrice !== fetchedItem.costPrice, `Cost price Mismatch for ${item.itemName}:  ${item.itemCostPrice}`, errors );
  
    // Validate CGST
    validateField( item.itemCgst !== fetchedItem.cgst, `CGST Mismatch for ${item.itemName}: ${item.itemCgst}`, errors );
  
    // Validate SGST
    validateField( item.itemSgst !== fetchedItem.sgst, `SGST Mismatch for ${item.itemName}: ${item.itemSgst}`, errors );
  
    // Validate IGST
    validateField( item.itemIgst !== fetchedItem.igst, `IGST Mismatch for ${item.itemName}: ${item.itemIgst}`, errors );

    // Validate tax preference
    validateField( item.taxPreference !== fetchedItem.taxPreference, `Tax Preference mismatch for ${item.itemName}: ${item.taxPreference}`, errors );
  
    // Validate discount type
    validateItemDiscountType(item.itemDiscountType, errors);
  
    // Validate integer fields
    validateIntegerFields(['itemQuantity'], item, errors);
  
    // Validate float fields
    validateFloatFields(['itemCostPrice', 'itemTotaltax', 'itemAmount'], item, errors);
  });
  }
  
  
  // valiadate purchase order data
  function validatePurchaseOrderData(data, purchaseOrderExist, items, errors) {  
    // console.log("data:", data);
    // console.log("purchaseOrderExist:", purchaseOrderExist);
    // console.log("items:", items);
  
     // Initialize `billExist.items` to an empty array if undefined
     purchaseOrderExist.items = Array.isArray(purchaseOrderExist.items) ? purchaseOrderExist.items : [];
  
    // Validate basic fields
    validateField( purchaseOrderExist.purchaseOrder !== data.orderNumber, `Order Number mismatch for ${purchaseOrderExist.purchaseOrder}`, errors  );
  
    // Loop through each item in billExist.items
    purchaseOrderExist.items.forEach(orderItem => {
      const bItem = items.find(dataItem => dataItem.itemId === orderItem.itemId);
  
      if (!bItem) {
        errors.push(`Item ID ${orderItem.itemId} not found in provided items`);
      } else {
        
        validateField(bItem.itemName !== orderItem.itemName, 
                      `Item Name mismatch for ${orderItem.itemId}: Expected ${orderItem.itemName}, got ${bItem.itemName}`, 
                      errors);
        validateField(bItem.itemCostPrice !== orderItem.itemCostPrice, 
                      `Item Cost Price mismatch for ${orderItem.itemId}: Expected ${orderItem.itemCostPrice}, got ${bItem.itemCostPrice}`, 
                      errors);
        validateField(bItem.itemCgst !== orderItem.itemCgst, 
                      `Item CGST mismatch for ${orderItem.itemId}: Expected ${orderItem.itemCgst}, got ${bItem.itemCgst}`, 
                      errors);
        validateField(bItem.itemSgst !== orderItem.itemSgst, 
                      `Item SGST mismatch for ${orderItem.itemId}: Expected ${orderItem.itemSgst}, got ${bItem.itemSgst}`, 
                      errors);
        validateField(bItem.itemIgst !== orderItem.itemIgst, 
                      `Item IGST mismatch for ${orderItem.itemId}: Expected ${orderItem.itemIgst}, got ${bItem.itemIgst}`, 
                      errors);
      }
    });
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

   // Validate Payment Terms
   function validateShipmentPreferences(shipmentPreference, errors) {
    validateField(
        shipmentPreference && !validShipmentPreferences.includes(shipmentPreference),
      "Invalid Shipment Preference: " + shipmentPreference, errors );
  }
  
  //Validate Discount Transaction Type
  function validateTransactionDiscountType(transactionDiscountType, errors) {
  validateField(transactionDiscountType && !validTransactionDiscountType.includes(transactionDiscountType),
    "Invalid Transaction Discount: " + transactionDiscountType, errors);
  } 
  
  //Validate Item Discount Transaction Type
  function validateItemDiscountType(itemDiscountType, errors) {
    validateField(itemDiscountType && !validItemDiscountType.includes(itemDiscountType),
      "Invalid Item Discount: " + itemDiscountType, errors);
  }
  
  // Validate Payment Terms
  function validatePaymentTerms(paymentTerms, errors) {
    validateField(
       paymentTerms && !validPaymentTerms.includes(paymentTerms),
      "Invalid Payment Terms: " + paymentTerms, errors );
  }
  
  // Validate Payment Mode
  function validatePaymentMode(paymentMode, errors) {
    validateField(
      paymentMode && !validPaymentMode.includes(paymentMode),
      "Invalid Payment Mode: " + paymentMode, errors );
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
  
  function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }
  
  
  
  
  // Item Track Function
  async function itemTrack(savedBills, itemTable) {
    const { items } = savedBills;
  
    for (const item of items) {
      // Find the matching item in itemTable by itemId
      const matchingItem = itemTable.find((entry) => entry._id.toString() === item.itemId);
  
      if (!matchingItem) {
        console.error(`Item with ID ${item.itemId} not found in itemTable`);
        continue; // Skip this entry if not found
      }
  
      // Calculate the new stock level after the purchase
      const newStock = matchingItem.currentStock + item.itemQuantity;
  
  
      // Create a new entry for item tracking
      const newTrialEntry = new ItemTrack({
        organizationId: savedBills.organizationId,
        operationId: savedBills._id,
        transactionId: savedBills.bill,
        action: "Bills",
        date: savedBills.billDate,
        itemId: matchingItem._id,
        itemName: matchingItem.itemName,
        sellingPrice: matchingItem.itemSellingPrice,
        costPrice: matchingItem.itemCostPrice || 0, // Assuming cost price is in itemTable
        creditQuantity: item.itemQuantity, // Quantity sold
        currentStock: newStock,
        remark: `Sold to ${savedBills.supplierDisplayName}`,
      });
  
      // Save the tracking entry and update the item's stock in the item table
      await newTrialEntry.save();
  
      // console.log("1",newTrialEntry);
    }
  }
  
  
  
  
  
  // Utility functions
  const validShipmentPreferences = ["Road", "Rail", "Air", "Sea", "Courier", "Hand Delivery", "Pickup"];
  const validItemDiscountType = ["percentage", "currency"];
  const validTransactionDiscountType = ["percentage", "currency"];
  const validPaymentMode = [ "Cash", "Credit" ]
  const validPaymentTerms = [
    "Net 15", 
    "Net 30", 
    "Net 45", 
    "Net 60", 
    "Pay Now", 
    "due on receipt", 
    "End of This Month", 
    "End of Next Month",
    "Custom"
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
  
  