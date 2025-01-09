const Organization = require("../database/model/organization");
const Item = require("../database/model/item");
const ItemTrack = require("../database/model/itemTrack");
const Settings = require("../database/model/settings");
const BMCR = require("../database/model/bmcr");
const Tax = require("../database/model/tax");
const Account = require("../database/model/account")


const { cleanData } = require("../services/cleanData");
const Supplier = require("../database/model/supplier");




// Fetch existing data
const dataExist = async ( organizationId, salesAccountId = null , purchaseAccountId = null ) => {  
  const [ organizationExists, taxExists, allItem, settingsExist, salesAccount, purchaseAccount ] = await Promise.all([
    Organization.findOne({ organizationId }),
    Tax.findOne({ organizationId }),
    Item.find({ organizationId }),
    Settings.findOne({ organizationId }),
    Account.findOne({ organizationId , _id : salesAccountId}),
    Account.findOne({ organizationId , _id : purchaseAccountId}),
  ]);
  return { organizationExists, taxExists, allItem, settingsExist,  salesAccount, purchaseAccount };
};



//Xs Item Exist
const xsItemDataExists = async (organizationId) => {
                // Retrieve items with specified fields
                const [newItems] = await Promise.all([
                  Item.find( { organizationId }, { _id: 1, itemName: 1, itemImage: 1, taxPreference: 1, sellingPrice: 1, salesAccountId:1, purchaseAccountId:1, costPrice:1, taxRate: 1, cgst: 1, sgst: 1, igst: 1, vat: 1 } )
                  .populate('salesAccountId', 'accountName') 
                  .populate('purchaseAccountId', 'accountName') 
                  .lean(),                  
                ]);     
                
                
                const transformedItems = newItems.map(item => ({
                  ...item,
                  salesAccountId: item.salesAccountId?._id || undefined,
                  salesAccountName: item.salesAccountId?.accountName || undefined,
                  
                  purchaseAccountId: item.purchaseAccountId?._id || undefined,
                  purchaseAccountName: item.purchaseAccountId?.accountName || undefined,
                }));

                // Extract itemIds from newItems
                const itemIds = transformedItems.map(item => item._id.toString());
              

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
                const enrichedItems = transformedItems.map(item => ({
                  ...item, // Copy item fields
                  currentStock: itemTrackMap[item._id.toString()] ? itemTrackMap[item._id.toString()].currentStock : null
                }));

                return { enrichedItems };
};


//M Item Exist
const mItemDataExists = async (organizationId) => {
          // Retrieve items with specified fields
          const [newItems] = await Promise.all([
            // Item.find( { organizationId },{ itemName :1, sku:1, costPrice:1, sellingPrice:1, reorderPoint:1 } ),
            Item.find( { organizationId },{ organizationId :0, itemImage: 0 } )
            .populate('salesAccountId', 'accountName') 
            .populate('purchaseAccountId', 'accountName')
            .populate('preferredVendorId', 'supplierDisplayName')  
            .lean(),

          ]);

          const transformedItems = newItems.map(item => ({
            ...item,
            salesAccountId: item.salesAccountId?._id || undefined,
            salesAccountName: item.salesAccountId?.accountName || undefined,

            purchaseAccountId: item.purchaseAccountId?._id || undefined,
            purchaseAccountName: item.purchaseAccountId?.accountName || undefined,

            preferredVendorId: item.preferredVendorId?._id || undefined,
            preferredVendorName: item.preferredVendorId?.supplierDisplayName || undefined,
          }));


          // Extract itemIds from newItems
          const itemIds = transformedItems.map(item => item._id.toString());


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
          const enrichedItems = transformedItems.map(item => ({
            ...item, // Copy item fields
            currentStock: itemTrackMap[item._id.toString()] ? itemTrackMap[item._id.toString()].currentStock : null
          }));
          
          

          return { enrichedItems };
};






// BMCR existing data
const bmcrDataExist = async (organizationId) => {
  const [brandExist, manufacturerExist, categoriesExist, rackExist] = await Promise.all([
    BMCR.find({ type: 'brand', organizationId }, { brandName: 1, _id: 0 }),
    BMCR.find({ type: 'manufacturer', organizationId }, { manufacturerName: 1, _id: 0 }),
    BMCR.find({ type: 'category', organizationId }, { categoriesName: 1, _id: 0 }),
    BMCR.find({ type: 'rack', organizationId }, { rackName: 1, _id: 0 })
  ]);
  return { brandExist, manufacturerExist, categoriesExist, rackExist };
};

// Fetch Item existing data
const itemDataExist = async (organizationId, itemId) => {
  const [ itemTrackAll ] = await Promise.all([
    ItemTrack.find({ itemId: { $in: [itemId] } }) 
  ]);
  return { itemTrackAll };
};






// Add item
exports.addItem = async (req, res) => {
    console.log("Add Item:", req.body);
    try {
     const organizationId = req.user.organizationId;

      const cleanedData = cleanData(req.body);      
      
      const { salesAccountId, purchaseAccountId, itemName, sku, openingStock, taxRate } = cleanedData;

      //Data Exist Validation
      const { organizationExists, taxExists, settingsExist,  salesAccount, purchaseAccount } = await dataExist( organizationId, salesAccountId, purchaseAccountId );
      const { brandExist, manufacturerExist, categoriesExist, rackExist } = await bmcrDataExist(organizationId);
      const bmcr = { brandExist, manufacturerExist, categoriesExist, rackExist };
      

      if (!validateOrganizationTaxCurrency(organizationExists, taxExists, settingsExist, res)) return;     


       // Check for duplicate item name
       if (!settingsExist.itemDuplicateName && await isDuplicateItemName(itemName, organizationId, res)) return;

       // Check for duplicate SKU
       if (cleanedData.sku !== undefined && await isDuplicateSKU(sku, organizationId, res)) return;


      //Validate Inputs  
      if (!validateInputs(cleanedData, taxExists, organizationId, bmcr, salesAccount, purchaseAccount, res)) return;

      //Tax Type
      taxType( cleanedData, taxExists, taxRate );      
       
     
      const newItem = new Item({ ...cleanedData, organizationId });

      const savedItem = await newItem.save();

      
        const trackEntry = new ItemTrack({
          organizationId,
          operationId: savedItem._id,
          action: "Opening Stock", 
          itemId: savedItem._id,
          sellingPrice:savedItem.sellingPrice,
          costPrice:savedItem.costPrice,
          debitQuantity: openingStock || 0 ,
          currentStock: openingStock || 0,
      });  
      await trackEntry.save();
      console.log( "Item Track Added", trackEntry );      
      
  
      res.status(201).json({ message: "New Item created successfully." });
      console.log( "New Item created successfully:", savedItem );
    } catch (error) {
      console.error("Error creating Item:", error);
      res.status(500).json({ message: "Internal server error." });
    }
};

// Get all items
exports.getAllItem = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;

    // Check if an Organization already exists
    const existingOrganization = await Organization.findOne({ organizationId });
    
    if (!existingOrganization) {
      return res.status(404).json({
        message: "No Organization Found.",
      });
    }

    const allItem = await Item.find({ organizationId },{ organizationId :0, itemImage: 0 }).lean();
    if (allItem) res.status(200).json(allItem);
    else return res.status(404).json("No Items found.");
    
  } catch (error) {
    console.error("Error fetching Items:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

//Get all item xs 
exports.getAllItemXS = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;

    // Check if an Organization already exists
    const existingOrganization = await Organization.findOne({ organizationId });
    
    if (!existingOrganization) {
      return res.status(404).json({
        message: "No Organization Found.",
      });
    }
    const { enrichedItems  } = await xsItemDataExists(organizationId);

    if (enrichedItems ) {
      res.status(200).json(enrichedItems);
    } else {
      return res.status(404).json("No Items found.");
    }
  } catch (error) {
    console.error("Error fetching Items:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

//Get all item m
exports.getAllItemM = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;


    // Check if an Organization already exists
    const existingOrganization = await Organization.findOne({ organizationId });
    
    if (!existingOrganization) {
      return res.status(404).json({
        message: "No Organization Found.",
      });
    }

    const { enrichedItems  } = await mItemDataExists(organizationId);

    if ( enrichedItems ) {
      res.status(200).json(enrichedItems);            
    } else {
      return res.status(404).json("No Items found.");
    }
  } catch (error) {
    console.error("Error fetching Items:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};


// Get one item
exports.getAItem = async (req, res) => {
    const { itemId } = req.params;
    const organizationId = req.user.organizationId;

    try {
      // Check if an Organization already exists
      const existingOrganization = await Organization.findOne({ organizationId });

      if (!existingOrganization) {
          return res.status(404).json({
              message: "No Organization Found."
          });
      }

      // Fetch item
      const singleItem = await Item.findById(itemId)
      .populate('salesAccountId', 'accountName') 
      .populate('purchaseAccountId', 'accountName')
      .populate('preferredVendorId', 'supplierDisplayName  mobile billingAddressStreet1 billingAddressStreet2 billingCity billingState billingCountry billingPinCode')
      .lean();

      if (!singleItem) {
          return res.status(404).json({ message: "Item not found." });
      }
      
      const transformedItems = {
        ...singleItem,
        salesAccountId: singleItem.salesAccountId?._id || undefined,
        salesAccountName: singleItem.salesAccountId?.accountName || undefined,

        purchaseAccountId: singleItem.purchaseAccountId?._id || undefined,
        purchaseAccountName: singleItem.purchaseAccountId?.accountName || undefined,

        preferredVendorId: singleItem.preferredVendorId?._id || undefined,
        preferredVendorName: singleItem.preferredVendorId?.supplierDisplayName || undefined,
        preferredVendorMobile: singleItem.preferredVendorId?.mobile || undefined,
        preferredVendorBillingAddressStreet1: singleItem.preferredVendorId?.billingAddressStreet1 || undefined,
        preferredVendorBillingAddressStreet2: singleItem.preferredVendorId?.billingAddressStreet2 || undefined,
        preferredVendorBillingCity: singleItem.preferredVendorId?.billingCity || undefined,
        preferredVendorBillingState: singleItem.preferredVendorId?.billingState || undefined,
        preferredVendorBillingCountry: singleItem.preferredVendorId?.billingCountry || undefined,
        preferredVendorBillingPinCode: singleItem.preferredVendorId?.billingPinCode || undefined,

      };

      res.status(200).json(transformedItems);
    } catch (error) {
      console.error("Error fetching Item:", error);
      res.status(500).json({ message: "Internal server error." });
    }
};


// Update Item
exports.updateItem = async (req, res) => {
  console.log("Edit item:", req.body); 
  try {    
    const organizationId = req.user.organizationId;
    const { itemId } = req.params;
    const cleanedData = cleanData(req.body);
    const { salesAccountId, purchaseAccountId, itemName, sku, taxRate, openingStock } = cleanedData;

    const existingItem = await Item.findById(itemId);
      if (!existingItem) {
        console.log("Item not found with ID:", itemId);
        return res.status(404).json({ message: "Item not found" });
      }


    //Data Exist Validation
    const { organizationExists, taxExists, settingsExist, salesAccount, purchaseAccount } = await dataExist( organizationId, salesAccountId, purchaseAccountId );
    const { brandExist, manufacturerExist, categoriesExist, rackExist } = await bmcrDataExist(organizationId);
    const bmcr = { brandExist, manufacturerExist, categoriesExist, rackExist };
    const { itemTrackAll  } = await itemDataExist( organizationId, itemId );
    const prevStock = existingItem.openingStock;
    
    if (!validateOrganizationTaxCurrency(organizationExists, taxExists, settingsExist, itemId, res)) return;     
    

    // Check for duplicate item name
    if (!settingsExist.itemDuplicateName && await isDuplicateItemNameExist( itemName, organizationId, itemId, res )) return;

    // Check for duplicate SKU
    if (cleanedData.sku !== undefined && await isDuplicateSKUExist( sku, organizationId, itemId, res )) return;

    //Validate Inputs  
    if (!validateInputs(cleanedData, taxExists, organizationId, bmcr,  salesAccount, purchaseAccount, res)) return;
   
     //Tax Type
    taxType( cleanedData, taxExists, taxRate );      

    // Update customer fields
    Object.assign( existingItem, cleanedData );
    const savedItem = await existingItem.save();

    await updateOpeningBalanceInItemTrack(openingStock, itemTrackAll, prevStock);
 
    if (!savedItem) {
      console.error("Item could not be saved.");
      return res.status(500).json({ message: "Failed to Update Item" });
    }      

    res.status(200).json({ message: "Item updated successfully", savedItem });
    console.log("Item updated successfully:", savedItem);
  } catch (error) {
    console.error("Error updating item:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Delete an item
exports.deleteItem = async (req, res) => {
  try {
      const itemId = req.params;
      const organizationId = req.user.organizationId;


    // Check if an Organization already exists
    const existingOrganization = await Organization.findOne({ organizationId });
    
    if (!existingOrganization) {
      return res.status(404).json({
        message: "No Organization Found.",
      });
    }

      const deletedItem = await Item.findByIdAndDelete(itemId);

      if (!deletedItem) {
          return res.status(404).json({ message: 'Item not found' });
      }

      res.json({ message: 'Item deleted successfully' });
  } catch (error) {
      res.status(500).json({ message: 'Server error', error });
  }
};








// Function to update the opening balance in item tracking
const updateOpeningBalanceInItemTrack = async (openingStock, itemTrackAll, prevStock) => {
  // Ensure openingStock, prevStock, and the difference are non-negative
  if (openingStock < 0 || prevStock < 0) {
    console.error("Opening stock and previous stock must be non-negative");
    return;
  }

  const diff = ( openingStock || 0) - ( prevStock || 0 );
  console.log( "Difference : ", diff );
  

  // If no change in stock, return without updating
  if (diff === 0) {
    console.log("No change in opening stock, no update needed.");
    return;
  }

  // Iterate through each item track and update the current stock
  itemTrackAll.forEach(itemTrack => {
    // Ensure CurrentStock is non-negative before updating
    if (itemTrack.currentStock < 0) {
      console.error("Current Stock must be non-negative");
      return;
    }

    // Update current stock by adding or subtracting the difference
    itemTrack.currentStock += diff;
  });

  itemTrackAll.forEach(itemTrack => {
    if (itemTrack.action === "Opening Stock") {
      const currentCreditQuantity = itemTrack.creditQuantity || 0;
      const newCreditQuantity = currentCreditQuantity + diff;

      if (isNaN(newCreditQuantity)) {
        console.error("Invalid value for creditQuantity");
        return;
      }
      itemTrack.creditQuantity = newCreditQuantity;
    }    
  });

  console.log("Item track's CurrentStock updated based on the new opening stock.");
  

  // If you need to persist these changes, save each itemTrack to the database
  for (const itemTrack of itemTrackAll) {
    try {
      await itemTrack.save();
    } catch (error) {
      console.error("Error saving itemTrack:", error.message);
    }
  }
};







// Check for duplicate item name - ADD
const isDuplicateItemName = async (itemName, organizationId, res) => {
  const existingItemName = await Item.findOne({ itemName, organizationId });
  if (existingItemName) {
      console.error("Item with this name already exists.");
      res.status(400).json({ message: "Item with this name already exists" });
      return true;
  }
  return false;
};

// Check for duplicate SKU - ADD
const isDuplicateSKU = async (sku, organizationId, res) => {
  const existingItem = await Item.findOne({ sku, organizationId });
  if (existingItem) {
      console.error("Item with this SKU already exists.");
      res.status(400).json({ message: "Item with this SKU already exists." });
      return true;
  }
  return false;
};

// Check for duplicate item name - EDIT
const isDuplicateItemNameExist = async (itemName, organizationId, itemId, res) => { 
  const existingItemName = await Item.findOne({
    itemName,
    organizationId,
    _id: { $ne: itemId }
  });
  
  if (existingItemName) {
      console.error("Item with this name already exists.");
      res.status(400).json({ message: "Item with this name already exists" });
      return true;
  }
  
  return false;
};

// Check for duplicate SKU - EDIT
const isDuplicateSKUExist = async (sku, organizationId, itemId, res) => {
  const existingItem = await Item.findOne({ sku, organizationId,  _id: { $ne: itemId }  });
  if (existingItem) {
      console.error("Item with this SKU already exists.");
      res.status(400).json({ message: "Item with this SKU already exists." });
      return true;
  }
  return false;
};




// Validate Organization Tax Currency
function validateOrganizationTaxCurrency(organizationExists, taxExists, allItem, settingsExist, res) {
  if (!organizationExists) {
    res.status(404).json({ message: "Organization not found" });
    return false;
  }
  if (!taxExists) {
    res.status(404).json({ message: "Tax not found" });
    return false;
  }
  if (!allItem) {
    res.status(404).json({ message: "Currency not found" });
    return false;
  }if (!settingsExist) {
    res.status(404).json({ message: "Settings not found" });
    return false;
  }
  return true;
}


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




















const validItemTypes = [ "goods", "service" ];
const validTaxPreference = [ "Non-taxable", "Taxable" ]; 

//Validate inputs
function validateInputs(data, taxExists, organizationId, bmcr,  salesAccount, purchaseAccount, res) {
   const validationErrors = validateItemData( data, taxExists, organizationId, bmcr,  salesAccount, purchaseAccount );

  if (validationErrors.length > 0) {
    res.status(400).json({ message: validationErrors.join(", ") });
    return false;
  }
  return true;
}



//Validate Data
function validateItemData( data, taxExists, organizationId, bmcr,  salesAccount, purchaseAccount ) {  
  
  const errors = [];

  //Basic Info

  //OtherDetails
  validateReqFields( data, errors );
  validateAccountStructure( data, salesAccount, purchaseAccount, errors);
  validateItemType(data.itemType, errors);
  validateTaxPreference(data.taxPreference, errors);
  validateBMCRFields( data.brand, data.manufacturer, data.categories, data.rack, bmcr, errors);


  validateAlphanumericFields(['mpn','isbn'], data, errors);
  validateIntegerFields(['upc','ean'], data, errors);
  validateFloatFields(['length', 'width', 'height', 'weight', 'sellingPrice', 'saleMrp', 'costPrice', 'openingStock', 'openingStockRatePerUnit', 'reorderPoint'], data, errors);
  //validateAlphabetsFields([''], data, errors);

  //Tax Details
  validateTaxType(data.taxRate, data.taxPreference, taxExists, errors);

  return errors;
}




// Field validation utility
function validateField(condition, errorMsg, errors) {
    if (condition) {
      console.log(errorMsg);      
      errors.push(errorMsg)};
}

//Valid Item Type
function validateItemType(itemType, errors) {
  validateField(itemType && !validItemTypes.includes(itemType),
    "Invalid Item type: " + itemType, errors);
}

//Valid Item Type
function validateTaxPreference(taxPreference, errors) {
  validateField(taxPreference && !validTaxPreference.includes(taxPreference),
    "Invalid Tax Preference: " + taxPreference, errors);
}

//Valid Req Fields
function validateReqFields( data, errors ) {
  validateField(typeof data.itemName === 'undefined',"Item Name required", errors);
  
  validateField(typeof data.taxPreference === 'undefined',"Tax Preference required", errors);
  validateField(data.taxPreference ==='Taxable' && typeof data.taxRate === 'undefined',"Tax Rate required", errors);
  validateField(data.taxPreference ==='Non-taxable' && typeof data.taxExemptReason === 'undefined',"Tax Exemption Reason required", errors);
  validateField(data.taxPreference ==='Non-taxable' && typeof data.taxRate !== 'undefined',"Invalid Tax Preference", errors);
  
  validateField(typeof data.sellingPrice !== 'undefined' && typeof data.salesAccountId === 'undefined',"Sales Account required", errors);
  validateField(typeof data.costPrice !== 'undefined' && typeof data.purchaseAccountId === 'undefined',"Purchase Account required", errors);
}

// Validation function for account structure
function validateAccountStructure( data, salesAccount, purchaseAccount, errors ) {
  if(data.salesAccountId) {
    validateField( salesAccount.accountGroup !== "Asset" || salesAccount.accountHead !== "Income" || salesAccount.accountSubhead !== "Income" , "Invalid Sales Account.", errors);
  }
  if(data.purchaseAccountId) {
    validateField( purchaseAccount.accountGroup !== "Liability" || purchaseAccount.accountHead !== "Expenses" ||  (purchaseAccount.accountSubhead !== "Expense" && purchaseAccount.accountSubhead !== "Cost of Goods Sold") , "Invalid Purchase Account.", errors);
  }
}


//Valid BMCR field
function validateBMCRFields(brand, manufacturer, categories, rack, bmcr, errors) {
    const validBrandNames = bmcr.brandExist.map(item => item.brandName);
    validateField(brand && !validBrandNames.includes(brand), "Invalid Brand: " + brand+" Choose a valid brand", errors);

    const validManufacturerNames = bmcr.manufacturerExist.map(item => item.manufacturerName);
    validateField(manufacturer && !validManufacturerNames.includes(manufacturer), "Invalid Manufacturer: " + manufacturer+" Choose a valid manufacturer", errors);

    const validCategoryNames = bmcr.categoriesExist.map(item => item.categoriesName);
    validateField(categories && !validCategoryNames.includes(categories), "Invalid Category: " + categories+" Choose a valid category", errors);

    const validRackNames = bmcr.rackExist.map(item => item.rackName);
    validateField(rack && !validRackNames.includes(rack), "Invalid Rack: "+ rack +" Choose a valid rack", errors);  
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


//Validate Tax Type
function validateTaxType( taxRate, taxPreference, taxExists, errors ) {
  const taxType = taxExists.taxType;
  let taxFound = false;


  // Check if taxType is GST
  if (taxType === 'GST' && taxPreference =='Taxable' ) {
    taxExists.gstTaxRate.forEach((tax) => {
      
      if (tax.taxName === taxRate) {
        taxFound = true;
        console.log(`Matching GST tax found: ${tax.taxName} with rate: ${tax.taxRate}`);
      }
    });
  }
  
  // Check if taxType is VAT
  if (taxType === 'VAT' && taxPreference =='Taxable') {
    taxExists.vatTaxRate.forEach((tax) => {
      if (tax.taxName === taxRate) {
        taxFound = true;
        console.log(`Matching VAT tax found: ${tax.taxName} with rate: ${tax.taxRate}`);
      }
    });
  }

  // If no matching tax rate found, add an error
  if (!taxFound  && taxPreference =='Taxable' ) {
    errors.push(`No matching ${taxType} Tax group found `);
  }  
  
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