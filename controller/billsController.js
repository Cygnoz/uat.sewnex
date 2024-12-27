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
const Prefix = require("../database/model/prefix");
const DefAcc  = require("../database/model/defaultAccount");
const TrialBalance = require("../database/model/trialBalance");
const Account = require("../database/model/account");

// Fetch existing data
const dataExist = async ( organizationId, supplierId, supplierDisplayName, purchaseOrderId ) => {
    const [organizationExists, supplierExist, purchaseOrderExist, taxExists, existingPrefix, settings, defaultAccount , supplierAccount] = await Promise.all([
      Organization.findOne({ organizationId }, { organizationId: 1, organizationCountry: 1, state: 1 }),
      Supplier.findOne({ organizationId , _id:supplierId}, { _id: 1, supplierDisplayName: 1, taxType: 1 }),
      PurchaseOrder.findOne({organizationId , _id:purchaseOrderId}),
      Tax.findOne({ organizationId }),
      Prefix.findOne({ organizationId }),
      Settings.findOne({ organizationId }),
      DefAcc.findOne({ organizationId },{ purchaseAccount: 1, purchaseDiscountAccount: 1, inputCgst: 1, inputSgst: 1, inputIgst: 1 ,inputVat: 1 }),
      Account.findOne({ organizationId , accountName:supplierDisplayName },{ _id:1, accountName:1 })
    ]);    
  return { organizationExists, supplierExist, purchaseOrderExist, taxExists, existingPrefix, settings, defaultAccount, supplierAccount };
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



// Fetch Acc existing data
const accDataExists = async ( defaultAccount, organizationId, otherExpenseAccountId, freightAccountId, paidAccountId ) => {
  const [ purchaseAccountName, purchaseDiscountAccountName , inputCgstName, inputSgstName, inputIgstName, inputVatName, otherExpenseAcc, freightAcc, paidAcc ] = await Promise.all([
    Account.findOne({ organizationId , _id: defaultAccount.purchaseAccount }, { accountName: 1 }),
    Account.findOne({ organizationId , _id: defaultAccount.purchaseDiscountAccount}, { accountName: 1 }),

    Account.findOne({ organizationId , _id: defaultAccount.inputCgst}, { accountName: 1 }),
    Account.findOne({ organizationId , _id: defaultAccount.inputSgst}, { accountName: 1 }),
    Account.findOne({ organizationId , _id: defaultAccount.inputIgst}, { accountName: 1 }),

    Account.findOne({ organizationId , _id: defaultAccount.inputVat}, { accountName: 1 }),

    Account.findOne({ organizationId , _id: otherExpenseAccountId, accountHead: "Expenses" }, { _id:1, accountName: 1 }),
    Account.findOne({ organizationId , _id: freightAccountId, accountHead: "Expenses" }, { _id:1, accountName: 1 }),

    Account.findOne({ organizationId , _id: paidAccountId, accountHead: "Asset" }, { _id:1, accountName: 1 }),

  ]);
  return { purchaseAccountName, purchaseDiscountAccountName , inputCgstName, inputSgstName, inputIgstName, inputVatName, otherExpenseAcc, freightAcc, paidAcc };
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
      cleanedData.items = cleanedData.items?.map(person => cleanBillsData(person)) || [];
      // console.log("cleanedData",cleanedData);

  
      const { items, supplierId, purchaseOrderId } = cleanedData;
      const { supplierDisplayName, otherExpenseAccountId, freightAccountId, paidAccountId } = cleanedData;

    //   const { orderNumber } = cleanedData;
    
      
      const itemIds = items.map(item => item.itemId);      
      
      // Check for duplicate itemIds
      const uniqueItemIds = new Set(itemIds);
      if (uniqueItemIds.size !== itemIds.length) {
        return res.status(400).json({ message: "Duplicate Item found" });
      }
      
      if ( typeof itemIds[0] === 'undefined' ) {
        return res.status(400).json({ message: "Select an Item" });
      }
  
      //Validate Supplier
      if (!mongoose.Types.ObjectId.isValid(supplierId) || supplierId.length !== 24) {
        return res.status(400).json({ message: `Invalid supplier ID: ${supplierId}` });
      }

      if ((!mongoose.Types.ObjectId.isValid(otherExpenseAccountId) || otherExpenseAccountId.length !== 24) && cleanedData.otherExpenseAmount !== undefined ) {
        return res.status(400).json({ message: `Select other expense account` });
      }

      if ((!mongoose.Types.ObjectId.isValid(freightAccountId) || freightAccountId.length !== 24) && cleanedData.freightAmount !== undefined ) {
        return res.status(400).json({ message: `Select freight account` });
      }

      if ((!mongoose.Types.ObjectId.isValid(paidAccountId) || paidAccountId.length !== 24) && cleanedData.paidAmount !== undefined ) {
        return res.status(400).json({ message: `Select paid through account` });
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
      
      const { organizationExists, supplierExist, purchaseOrderExist, taxExists, existingPrefix, settings, defaultAccount, supplierAccount } = await dataExist( organizationId, supplierId, supplierDisplayName, purchaseOrderId );
      
      const { itemTable } = await newDataExists( organizationId, items );
      
      //Data Exist Validation
      if (!validateOrganizationSupplierOrder( purchaseOrderId, organizationExists, supplierExist, purchaseOrderExist, existingPrefix, defaultAccount, res )) return;
      
      //Validate Inputs  
      if (!validateInputs( cleanedData, supplierExist, purchaseOrderExist, items, itemTable, organizationExists, defaultAccount, res)) return;
      
      //Check Bill Exist
      // if (await checkExistingBill(cleanedData.billNumber, organizationId, res)) return;
      
      //Date & Time
      const openingDate = generateOpeningDate(organizationExists);
  
      //Tax Type
      taxtype(cleanedData, supplierExist );

      //Default Account
      const { defAcc, error } = await defaultAccounting( cleanedData, defaultAccount, organizationExists );
      if (error) { 
        res.status(400).json({ message: error }); 
        return false; 
      }

      // Calculate Sales 
      if (!calculateBills( cleanedData, itemTable, res )) return;      

      //Prefix
      await billsPrefix(cleanedData, existingPrefix );
  
      const savedBills = await createNewBills(cleanedData, organizationId, openingDate, userId, userName );
  
      //Jornal      
      await journal( savedBills, defAcc, supplierAccount );

      //Item Track
      await itemTrack( savedBills, itemTable );

      // Delete the associated purchase order if purchaseOrderId is provided
      if (purchaseOrderId) {
        await deletePurchaseOrder(purchaseOrderId, organizationId, res);
      }

      // savedBills.organizationId = undefined;
      // Object.assign(savedBills, { organizationId: undefined, purchaseOrderId: undefined });
        
      res.status(201).json({ message: "Bills created successfully", savedBills });
      console.log( "Bills created successfully:", savedBills );
    } catch (error) {
      console.error("Error Creating Bills:", error);
      res.status(500).json({ message: "Internal server error." });
    }
  }
  
  
  
  // Get All Bills
  exports.getAllBills = async (req, res) => {
    try {
      const organizationId = req.user.organizationId;
  
      const { organizationExists, allBills } = await billsDataExist( organizationId, null );
  
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




  // Get Invoice Journal
exports.billJournal = async (req, res) => {
  try {
      const organizationId = req.user.organizationId;
      const { billId } = req.params;


      // Find all accounts where organizationId matches
      const billJournal = await TrialBalance.find({ organizationId : organizationId, operationId : billId });

      if (!billJournal) {
          return res.status(404).json({
              message: "No Journal found for the Bill.",
          });
      }
      
      res.status(200).json(billJournal);
  } catch (error) {
      console.error("Error fetching journal:", error);
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














  //Default Account
async function defaultAccounting( data, defaultAccount, organizationExists ) {

  // Fetch data from accDataExists and destructure results
  const {
    purchaseAccountName,
    purchaseDiscountAccountName,
    inputCgstName,
    inputSgstName,
    inputIgstName,
    inputVatName,
    otherExpenseAcc,
    freightAcc,
    paidAcc
  } = await accDataExists(
    defaultAccount,
    organizationExists.organizationId,
    data.otherExpenseAccountId,
    data.freightAccountId,
    data.paidAccountId
  );
  
  
  let errorMessage = '';
  if (!defaultAccount.purchaseAccount && typeof data.totalAmount !== 'undefined') errorMessage += "Sales Account not found. ";
  if (!defaultAccount.purchaseDiscountAccount && (typeof data.totalDiscount !== 'undefined' || data.totalDiscount !== 0 )) errorMessage += "Discount Account not found. ";
 
  if (!defaultAccount.inputCgst && typeof data.cgst !== 'undefined') errorMessage += "CGST Account not found. ";
  if (!defaultAccount.inputSgst && typeof data.sgst !== 'undefined') errorMessage += "SGST Account not found. ";
  if (!defaultAccount.inputIgst && typeof data.igst !== 'undefined') errorMessage += "IGST Account not found. ";
  if (!defaultAccount.inputVat && typeof data.vat !== 'undefined') errorMessage += "VAT Account not found. ";
   
  if (!otherExpenseAcc && typeof data.otherExpenseAmount !== 'undefined') errorMessage += "Other Expense Account not found. ";
  if (!freightAcc && typeof data.freightAmount !== 'undefined') errorMessage += "Freight Account not found. ";
  if (!paidAcc && typeof data.paidAmount !== 'undefined') errorMessage += "Paid Through Account not found. ";


  // If there is an error message, return it as a response
  if (errorMessage) {
    return { defAcc: null, error: errorMessage.trim() }; // Return error message
  }
  
  // Update defaultAccount fields
  defaultAccount.purchaseAccountName = purchaseAccountName?.accountName;
  defaultAccount.purchaseDiscountAccountName = purchaseDiscountAccountName?.accountName;

  if (data.taxtype !== 'VAT') {
    defaultAccount.inputCgstName = inputCgstName?.accountName;
    defaultAccount.inputSgstName = inputSgstName?.accountName;
    defaultAccount.inputIgstName = inputIgstName?.accountName;
  } else {
    defaultAccount.inputVatName = inputVatName?.accountName;
  }
  if(data.otherExpenseAmount !=='undefined'){
    defaultAccount.otherExpenseAccountName = otherExpenseAcc?.accountName;
    defaultAccount.otherExpenseAccountId = otherExpenseAcc?._id;
  }
  if(data.freightAmount !=='undefined'){
    defaultAccount.freightAccountName = freightAcc?.accountName;
    defaultAccount.freightAccountId = freightAcc?._id;
  }
  if(data.paidAmount !=='undefined'){
    defaultAccount.paidAccountName = paidAcc?.accountName;
    defaultAccount.paidAccountId = paidAcc?._id;
  }    
  return { defAcc:defaultAccount ,error:null };
}



















// Get last credit note prefix
exports.getLastBillsPrefix = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;

      // Find all accounts where organizationId matches
      const prefix = await Prefix.findOne({ organizationId:organizationId,'series.status': true });

      if (!prefix) {
          return res.status(404).json({
              message: "No Prefix found for the provided organization ID.",
          });
      }
      
      const series = prefix.series[0];     
      const lastPrefix = series.bill + series.billNum;

      lastPrefix.organizationId = undefined;

      res.status(200).json(lastPrefix);
  } catch (error) {
      console.error("Error fetching accounts:", error);
      res.status(500).json({ message: "Internal server error." });
  }
};

// Credit Note Prefix
function billsPrefix( cleanData, existingPrefix ) {
  const activeSeries = existingPrefix.series.find(series => series.status === true);
  if (!activeSeries) {
      return res.status(404).json({ message: "No active series found for the organization." });
  }
  cleanData.billNumber = `${activeSeries.bill}${activeSeries.billNum}`;

  activeSeries.billNum += 1;

  existingPrefix.save()

  return 
}









  // Create New Debit Note
  function createNewBills( data, organizationId, openingDate, userId, userName ) {
    const newBill = new Bills({ ...data, organizationId, createdDate: openingDate, userId, userName });
    return newBill.save();
  }


  // Check for existing bill
  // async function checkExistingBill(billNumber, organizationId, res) {
  //   const existingBill = await Bills.findOne({ billNumber, organizationId });
  //   if (existingBill) {
  //     res.status(409).json({ message: "Bill already exists." });
  //     return true;
  //   }
  //   return false;
  // }
  
  
  //Clean Data 
  function cleanBillsData(data) {
    const cleanData = (value) => (value === null || value === undefined || value === "" ? undefined : value);
    return Object.keys(data).reduce((acc, key) => {
      acc[key] = cleanData(data[key]);
      return acc;
    }, {});
  }
  
  
  // Validate Organization Tax Currency
  function validateOrganizationSupplierOrder( purchaseOrderId, organizationExists, supplierExist, purchaseOrderExist, existingPrefix, defaultAccount, res ) {
    if (!organizationExists) {
      res.status(404).json({ message: "Organization not found" });
      return false;
    }
    if (!supplierExist) {
      res.status(404).json({ message: "Supplier not found." });
      return false;
    }
    if (purchaseOrderId) {
    if (!purchaseOrderExist) {
      res.status(404).json({ message: "Purchase order not found" });
      return false;
    }}
    if (!existingPrefix) {
      res.status(404).json({ message: "Prefix not found" });
      return false;
    }
    if (!defaultAccount) {
    res.status(404).json({ message: "Setup Accounts in settings" });
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

    

    // cleanedData.otherExpenseAmount = cleanedData.otherExpense;
    // cleanedData.freightAmount = cleanedData.freight;
    // cleanedData.roundOffAmount = cleanedData.roundOff;
    
    const errors = [];
  
    let otherExpense = (parseFloat(cleanedData.otherExpenseAmount) || 0);
    let freightAmount = (parseFloat(cleanedData.freightAmount) || 0);
    let roundOffAmount = (parseFloat(cleanedData.roundOffAmount) || 0);
    
    let totalDiscount= 0;
    
    let subTotal = 0;
    let totalTaxAmount = 0;
    let itemTotalDiscount= 0;
    let totalItem = 0;
    let transactionDiscountAmount = 0;
    let grandTotal = 0;
    let balanceAmount = 0;
    let paidAmount = (cleanedData.paidAmount || 0);

    let purchaseAmount =0;

  
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
      purchaseAmount +=(item.itemCostPrice * item.itemQuantity);
      totalDiscount +=  parseFloat(itemDiscAmt);
  
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

      //Purchase amount
    cleanedData.purchaseAmount=purchaseAmount;    

  
    const total = roundToTwoDecimals((subTotal + totalTaxAmount + otherExpense + freightAmount - roundOffAmount) - itemTotalDiscount );
          
    console.log(`Sub Total: ${subTotal} , Provided ${cleanedData.subTotal}`);
    console.log(`Total: ${total} , Provided ${total}`);
    console.log(`Sub Total: ${subTotal} , Provided ${cleanedData.subTotal}`);
    console.log(`Total Tax Amount: ${totalTaxAmount} , Provided ${cleanedData.totalTaxAmount}`);
    console.log(`Other Expense: ${otherExpense} , Provided ${cleanedData.otherExpenseAmount}`);
    console.log(`Freight Amount: ${freightAmount} , Provided ${cleanedData.freightAmount}`);
    console.log(`Round Off Amount: ${roundOffAmount} , Provided ${cleanedData.roundOffAmount}`);
    console.log(`Item Total Discount: ${itemTotalDiscount} , Provided ${cleanedData.itemTotalDiscount}`);
  
    // Transaction Discount
    let transDisAmt = calculateTransactionDiscount(cleanedData, total, transactionDiscountAmount); 
  
    cleanedData.totalDiscount =  roundToTwoDecimals(totalDiscount + parseFloat(transDisAmt));

    // grandTotal amount calculation with including transactionDiscount
    
    grandTotal = roundToTwoDecimals(total - transDisAmt); 
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
  
    validateAmount(roundedSubTotal, ( cleanedData.subTotal || 0 ), 'SubTotal', errors);
    validateAmount(roundedTotalTaxAmount, ( cleanedData.totalTaxAmount || 0 ), 'Total Tax Amount', errors);
    validateAmount(roundedGrandTotalAmount, ( cleanedData.grandTotal || 0 ), 'Grand Total', errors);
    validateAmount(roundedTotalItemDiscount, ( cleanedData.itemTotalDiscount || 0 ), 'Total Item Discount Amount', errors);
    validateAmount(roundedBalanceAmount, ( cleanedData.balanceAmount || 0 ), 'Balance Amount', errors);
    validateAmount(totalItem, ( cleanedData.totalItem || 0 ), 'Total Item count', errors);
  
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
      : (total * (cleanedData.transactionDiscount || 0)) / 100;    
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
function validateInputs( data, supplierExist, purchaseOrderExist, items, itemExists, organizationExists, defaultAccount, res) {
    const validationErrors = validateBillsData(data, supplierExist, purchaseOrderExist, items, itemExists, organizationExists, defaultAccount );  
  
    if (validationErrors.length > 0) {
      res.status(400).json({ message: validationErrors.join(", ") })
      ;
      return false;
    }
    return true;
  }
  
  //Validate Data
  function validateBillsData( data, supplierExist, purchaseOrderExist, items, itemTable, organizationExists, defaultAccount ) {
    const errors = [];
  
    // console.log("Item Request :",items);
    // console.log("Item Fetched :",itemTable);
  
    //Basic Info
    validateReqFields( data, supplierExist, defaultAccount, errors );
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
  function validateReqFields( data, supplierExist, defaultAccount, errors ) {
  validateField( typeof data.supplierId === 'undefined' || typeof data.supplierDisplayName === 'undefined', "Please select a Supplier", errors  );
  validateField( supplierExist.taxtype == 'GST' && typeof data.sourceOfSupply === 'undefined', "Source of supply required", errors  );
  validateField( supplierExist.taxtype == 'GST' && typeof data.destinationOfSupply === 'undefined', "Destination of supply required", errors  );
  
  validateField( typeof data.items === 'undefined', "Select an item", errors  );
  validateField( typeof data.supplierInvoiceNum === 'undefined', "Select an supplier invoice number", errors  );

  validateField( typeof data.otherExpenseAmount !== 'undefined' && typeof data.otherExpenseReason === 'undefined', "Please enter other expense reason", errors  );
  validateField( typeof data.otherExpenseAmount !== 'undefined' && typeof data.otherExpenseAccountId === 'undefined', "Please select expense account", errors  );
  validateField( typeof data.freightAmount !== 'undefined' && typeof data.freightAccountId === 'undefined', "Please select freight account", errors  );

  validateField( typeof data.roundOffAmount !== 'undefined' && !(data.roundOffAmount >= 0 && data.roundOffAmount <= 1), "Round Off Amount must be between 0 and 1", errors );

  validateField( typeof data.paidAmount !== 'undefined' && !(data.paidAmount <= data.grandTotal), "Excess payment amount", errors );
  validateField( typeof data.paidAmount !== 'undefined' && !(data.paidAmount >= 0 ), "Negative payment amount", errors );

  validateField( typeof defaultAccount.purchaseAccount === 'undefined', "No Purchase Account found", errors  );
  validateField( typeof defaultAccount.purchaseDiscountAccount === 'undefined', "No Purchase Discount Account found", errors  );

  validateField( supplierExist.taxType === 'GST' && typeof defaultAccount.inputCgst === 'undefined', "No Input Cgst Account found", errors  );
  validateField( supplierExist.taxType === 'GST' && typeof defaultAccount.inputSgst === 'undefined', "No Input Sgst Account found", errors  );
  validateField( supplierExist.taxType === 'GST' && typeof defaultAccount.inputIgst === 'undefined', "No Input Igst Account found", errors  );
  validateField( supplierExist.taxType === 'VAT' && typeof defaultAccount.inputVat === 'undefined', "No Input Vat Account found", errors  );

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
  
  






























  
async function journal( savedBills, defAcc, supplierAccount ) {
    
  const discount = {
    organizationId: savedBills.organizationId,
    operationId: savedBills._id,
    transactionId: savedBills.salesInvoice,
    date: savedBills.createdDate,
    accountId: defAcc.purchaseDiscountAccount || undefined,
    accountName: defAcc.purchaseDiscountAccountName || undefined,
    action: "Purchase Bill",
    debitAmount: 0,
    creditAmount: savedBills.totalDiscount,
    remark: savedBills.note,
  };
  const purchase = {
    organizationId: savedBills.organizationId,
    operationId: savedBills._id,
    transactionId: savedBills.salesInvoice,
    date: savedBills.createdDate,
    accountId: defAcc.purchaseAccount || undefined,
    accountName: defAcc.purchaseAccountName || undefined,
    action: "Purchase Bill",
    debitAmount: savedBills.purchaseAmount,
    creditAmount: 0,
    remark: savedBills.note,
  };
  const cgst = {
    organizationId: savedBills.organizationId,
    operationId: savedBills._id,
    transactionId: savedBills.salesInvoice,
    date: savedBills.createdDate,
    accountId: defAcc.inputCgst || undefined,
    accountName: defAcc.inputCgstName || undefined,
    action: "Purchase Bill",
    debitAmount: savedBills.cgst,
    creditAmount: 0,
    remark: savedBills.note,
  };
  const sgst = {
    organizationId: savedBills.organizationId,
    operationId: savedBills._id,
    transactionId: savedBills.salesInvoice,
    date: savedBills.createdDate,
    accountId: defAcc.inputSgst || undefined,
    accountName: defAcc.inputSgstName || undefined,
    action: "Purchase Bill",
    debitAmount: savedBills.sgst,
    creditAmount: 0,
    remark: savedBills.note,
  };
  const igst = {
    organizationId: savedBills.organizationId,
    operationId: savedBills._id,
    transactionId: savedBills.salesInvoice,
    date: savedBills.createdDate,
    accountId: defAcc.inputIgst || undefined,
    accountName: defAcc.inputIgstName || undefined,
    action: "Purchase Bill",
    debitAmount: savedBills.igst,
    creditAmount: 0,
    remark: savedBills.note,
  };
  const vat = {
    organizationId: savedBills.organizationId,
    operationId: savedBills._id,
    transactionId: savedBills.salesInvoice,
    date: savedBills.createdDate,
    accountId: defAcc.inputVat || undefined,
    accountName: defAcc.inputVatName || undefined,
    action: "Purchase Bill",
    debitAmount: savedBills.vat,
    creditAmount: 0,
    remark: savedBills.note,
  };
  const supplier = {
    organizationId: savedBills.organizationId,
    operationId: savedBills._id,
    transactionId: savedBills.salesInvoice,
    date: savedBills.createdDate,
    accountId: supplierAccount._id || undefined,
    accountName: supplierAccount.accountName || undefined,
    action: "Purchase Bill",
    debitAmount: 0,
    creditAmount: savedBills.grandTotal,
    remark: savedBills.note,
  };
  const supplierPaid = {
    organizationId: savedBills.organizationId,
    operationId: savedBills._id,
    transactionId: savedBills.salesInvoice,
    date: savedBills.createdDate,
    accountId: supplierAccount._id || undefined,
    accountName: supplierAccount.accountName || undefined,
    action: "Payment",
    debitAmount: savedBills.paidAmount,
    creditAmount: 0,
    remark: savedBills.note,
  };
  const paidAccount = {
    organizationId: savedBills.organizationId,
    operationId: savedBills._id,
    transactionId: savedBills.salesInvoice,
    date: savedBills.createdDate,
    accountId: defAcc.paidAccountId || undefined,
    accountName: defAcc.paidAccountName || undefined,
    action: "Payment",
    debitAmount: 0,
    creditAmount: savedBills.paidAmount,
    remark: savedBills.note,
  };
  const otherExpense = {
    organizationId: savedBills.organizationId,
    operationId: savedBills._id,
    transactionId: savedBills.salesInvoice,
    date: savedBills.createdDate,
    accountId: defAcc.otherExpenseAccountId || undefined,
    accountName: defAcc.otherExpenseAccountName || undefined,
    action: "Purchase Bill",
    debitAmount: savedBills.otherExpenseAmount,
    creditAmount: 0,
    remark: savedBills.note,
  };
  const freight = {
    organizationId: savedBills.organizationId,
    operationId: savedBills._id,
    transactionId: savedBills.salesInvoice,
    date: savedBills.createdDate,
    accountId: defAcc.freightAccountId || undefined,
    accountName: defAcc.freightAccountName || undefined,
    action: "Purchase Bill",
    debitAmount: savedBills.freightAmount,
    creditAmount: 0,
    remark: savedBills.note,
  };
  const roundOff = {
    organizationId: savedBills.organizationId,
    operationId: savedBills._id,
    transactionId: savedBills.salesInvoice,
    date: savedBills.createdDate,
    accountName: "Round Off",
    action: "Purchase Bill",
    debitAmount: 0,
    creditAmount: savedBills.roundOffAmount,
    remark: savedBills.note,
  };

  console.log("cgst", cgst.debitAmount,  cgst.creditAmount);
  console.log("sgst", sgst.debitAmount,  sgst.creditAmount);
  console.log("igst", igst.debitAmount,  igst.creditAmount);
  console.log("vat", vat.debitAmount,  vat.creditAmount);

  console.log("purchase", purchase.debitAmount,  purchase.creditAmount);
  console.log("supplier", supplier.debitAmount,  supplier.creditAmount);
  console.log("discount", discount.debitAmount,  discount.creditAmount);

  
  console.log("otherExpense", otherExpense.debitAmount,  otherExpense.creditAmount);
  console.log("freight", freight.debitAmount,  freight.creditAmount);
  console.log("roundOff", roundOff.debitAmount,  roundOff.creditAmount);

  console.log("supplierPaid", supplierPaid.debitAmount,  supplierPaid.creditAmount);
  console.log("paidAccount", paidAccount.debitAmount,  paidAccount.creditAmount);

  // const  debitAmount = cgst.debitAmount  + sgst.debitAmount + igst.debitAmount +  vat.debitAmount + purchase.debitAmount + supplier.debitAmount + discount.debitAmount + otherExpense.debitAmount + freight.debitAmount + roundOff.debitAmount + supplierPaid.debitAmount + paidAccount.debitAmount ;
  // const  creditAmount = cgst.creditAmount  + sgst.creditAmount + igst.creditAmount +  vat.creditAmount + purchase.creditAmount + supplier.creditAmount + discount.creditAmount + otherExpense.creditAmount + freight.creditAmount + roundOff.creditAmount + supplierPaid.creditAmount + paidAccount.creditAmount ;
  const debitAmount = 
  (cgst.debitAmount ?? 0) + 
  (sgst.debitAmount ?? 0) + 
  (igst.debitAmount ?? 0) + 
  (vat.debitAmount ?? 0) + 
  (purchase.debitAmount ?? 0) + 
  (supplier.debitAmount ?? 0) + 
  (discount.debitAmount ?? 0) + 
  (otherExpense.debitAmount ?? 0) + 
  (freight.debitAmount ?? 0) + 
  (roundOff.debitAmount ?? 0) + 
  (supplierPaid.debitAmount ?? 0) + 
  (paidAccount.debitAmount ?? 0);

const creditAmount = 
  (cgst.creditAmount ?? 0) + 
  (sgst.creditAmount ?? 0) + 
  (igst.creditAmount ?? 0) + 
  (vat.creditAmount ?? 0) + 
  (purchase.creditAmount ?? 0) + 
  (supplier.creditAmount ?? 0) + 
  (discount.creditAmount ?? 0) + 
  (otherExpense.creditAmount ?? 0) + 
  (freight.creditAmount ?? 0) + 
  (roundOff.creditAmount ?? 0) + 
  (supplierPaid.creditAmount ?? 0) + 
  (paidAccount.creditAmount ?? 0);

  console.log("Total Debit Amount: ", debitAmount );
  console.log("Total Credit Amount: ", creditAmount );

  // console.log( discount, sale, cgst, sgst, igst, vat, customer, otherExpense, freight, roundOff );


  createTrialEntry( purchase )

  //Tax
  if(savedBills.cgst){
    createTrialEntry( cgst )
  }
  if(savedBills.sgst){
    createTrialEntry( sgst )
  }
  if(savedBills.igst){
    createTrialEntry( igst )
  }
  if(savedBills.vat){
    createTrialEntry( vat )
  }

  //Discount  
  if(savedBills.totalDiscount){
    createTrialEntry( discount )
  }

  //Other Expense
  if(savedBills.otherExpenseAmount){
    createTrialEntry( otherExpense )
  }

  //Freight
  if(savedBills.freightAmount){
    createTrialEntry( freight )
  }
  
  //Round Off
  if(savedBills.roundOffAmount){
    createTrialEntry( roundOff )
  }
 
  //supplier
  createTrialEntry( supplier )
  
  //Paid
  if(savedBills.paidAmount){
    createTrialEntry( supplierPaid )
    createTrialEntry( paidAccount )
  }
}




async function createTrialEntry( data ) {
  const newTrialEntry = new TrialBalance({
      organizationId:data.organizationId,
      operationId:data.operationId,
      transactionId: data.transactionId,
      date:data.date,
      accountId: data.accountId,
      accountName: data.accountName,
      action: data.action,
      debitAmount: data.debitAmount,
      creditAmount: data.creditAmount,
      remark: data.remark
});

await newTrialEntry.save();

}

