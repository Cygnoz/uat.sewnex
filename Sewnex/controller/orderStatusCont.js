const Organization = require("../../database/model/organization");
const Item = require("../../database/model/item");
const ItemTrack = require("../../database/model/itemTrack");

const OrderStatus = require("../model/orderStatus");
const SewnexSetting = require("../model/sxSetting");
const sxOrderService = require("../model/sxOrderService");

const { cleanData } = require("../../services/cleanData");
const { singleCustomDateTime, multiCustomDateTime } = require("../../services/timeConverter");

const mongoose = require('mongoose');
const moment = require("moment-timezone");


// Fetch existing data
const dataExist = async ( organizationId) => {
    const [organizationExists, sewnexSetting ] = await Promise.all([
      Organization.findOne({ organizationId },{ timeZoneExp: 1, dateFormatExp: 1, dateSplit: 1, organizationCountry: 1 }).lean(),
      SewnexSetting.findOne({ organizationId }).lean(),
    ]);
    return { organizationExists, sewnexSetting };
};



//Fetch Item Data
const itemDataExists = async (organizationId, items) => {
  // Retrieve items with specified fields
  const itemIds = items.map(item => new mongoose.Types.ObjectId(item.itemId));

  console.log("itemIds:",itemIds);

  const [newItems] = await Promise.all([
    Item.find( { organizationId, _id: { $in: itemIds } },
    { _id: 1, itemName: 1, sellingPrice: 1, costPrice: 1, type: 1 }
    ).lean()
  ]);

  // Aggregate ItemTrack data to calculate current stock
  const itemTracks = await ItemTrack.aggregate([
    { $match: { itemId: { $in: itemIds } } },
    {
        $group: {
            _id: "$itemId",
            totalCredit: { $sum: "$creditQuantity" },
            totalDebit: { $sum: "$debitQuantity" },
            lastEntry: { $max: "$createdDateTime" } // Capture the latest entry time for each item
        }
    }
  ]);

  // Map itemTracks for easier lookup
  const itemTrackMap = itemTracks.reduce((acc, itemTrack) => {
      acc[itemTrack._id.toString()] = {
          currentStock: itemTrack.totalDebit - itemTrack.totalCredit, // Calculate stock as debit - credit
          lastEntry: itemTrack.lastEntry
      };
      return acc;
    }, {});

  // Enrich newItems with currentStock data
  const orderService = newItems.map(item => ({
      ...item,
      currentStock: itemTrackMap[item._id.toString()]?.currentStock ?? 0, // Use 0 if no track data
      // lastEntry: itemTrackMap[item._id.toString()]?.lastEntry || null // Include the latest entry timestamp
  }));

return { orderService };
};





// Add Order Status
exports.addOrderStatus = async (req, res) => {
    console.log("Add or Edit Order Status", req.body);

    try {
        const { organizationId, id: userId } = req.user;
        const cleanedData = cleanData(req.body);
        const { orderServiceId, orderStatus, remarks } = cleanedData;

        // Check if orderServiceId exists in sxOrderService
        const service = await sxOrderService.findOne({
            organizationId,
            _id: orderServiceId
        }).lean();

        if (!service) {
            return res.status(404).json({ message: "Order service not found for this orderServiceId." });
        }

        const { orderId, productId } = service;

        // Combine fabric and rawMaterial arrays into items array
        const items = [...(service.fabric || []), ...(service.rawMaterial || []), ...(service.readyMade || [])];
        console.log("Fetched items (fabric + rawMaterial + readyMade):", items);

        // Check organization
        const { organizationExists, sewnexSetting } = await dataExist(organizationId);

        // Item Track Data Exist
        const { orderService } = await itemDataExists( organizationId, items );

        if (!validateOrganizationSetting(organizationExists, sewnexSetting, res)) return;

        if (!validateInputs(cleanedData, orderStatus, sewnexSetting, res)) return;

        // Check if order status entry exists
        const existingOrderStatus = await OrderStatus.findOne({
            organizationId,
            orderServiceId
        });
        console.log("cleanedData and orderStatus:",cleanedData, orderStatus);
        console.log("existingOrderStatus:",existingOrderStatus);

        if (!existingOrderStatus) {
            console.log("Order status entry not found for this service.");
            return res.status(404).json({ message: "Order status entry not found for this service." });
        }

        const statuses = Array.isArray(orderStatus) ? orderStatus : [orderStatus];
        let addedOrUpdatedStatuses = [];

        statuses.forEach(statusEntry => {
            const existingStatus = existingOrderStatus.orderStatus.findIndex(existing =>
                existing.status === statusEntry.status
            );

            if (existingStatus !== -1) {
                // Delete all entries after the existing status entry
                existingOrderStatus.orderStatus = existingOrderStatus.orderStatus.slice(0, existingStatus + 1);

                // Update date and remarks if status exists
                existingOrderStatus.orderStatus[existingStatus].date = statusEntry.date;
                addedOrUpdatedStatuses.push(`${statusEntry.status} (updated)`);
            } else {
                // Push new status
                existingOrderStatus.orderStatus.push({
                    status: statusEntry.status,
                    date: statusEntry.date
                });
                addedOrUpdatedStatuses.push(`${statusEntry.status} (added)`);
            }
        });

        // Update remarks at the root level
        existingOrderStatus.remarks = remarks;

        // Save
        await existingOrderStatus.save();

        // Update sewnexOrderService with the latest status
        const latestStatus = existingOrderStatus.orderStatus[existingOrderStatus.orderStatus.length - 1]?.status;

        if (latestStatus) {
            await sxOrderService.findOneAndUpdate(
                { organizationId, _id: orderServiceId },
                { status: latestStatus },
                { new: true }
            );
        }

        res.status(200).json({
            message: `Order status successfully updated. Changed statuses: ${addedOrUpdatedStatuses.join(", ")}`,
            data: existingOrderStatus
        });

        //Item Track
        await itemTrack( existingOrderStatus, items, orderService, orderId, productId );

    } catch (error) {
        console.error("Error in addOrderStatus:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};


// Get One Order Status 
exports.getOrderStatus = async (req, res) => {
    try {
        const { organizationId } = req.user;
        const { orderServiceId, statusName } = req.query;

        // Validate orderServiceId
        if (!mongoose.Types.ObjectId.isValid(orderServiceId) || orderServiceId.length !== 24) {
            return res.status(400).json({ message: `Invalid Order Service ID: ${orderServiceId}` });
        }

        // Check organization
        const { organizationExists } = await dataExist(organizationId);
        if (!organizationExists) {
            return res.status(404).json({ message: "Organization not found!" });
        }

        const orderStatusDoc = await OrderStatus.findOne({
            organizationId,
            orderServiceId
        }).lean();

        if (!orderStatusDoc) {
            return res.status(404).json({ message: "Order status not found for this service!" });
        }

        // If statusId is provided, find that specific status object
        let statusData = orderStatusDoc;
        if (statusName) {
            const singleStatus = orderStatusDoc.orderStatus.find(
                (statusEntry) => statusEntry.status === statusName
            );

            if (!singleStatus) {
                return res.status(404).json({ message: "Status entry not found in order status array!" });
            }
            statusData = { ...singleStatus, remarks: orderStatusDoc.remarks };
        }

        const formattedData = singleCustomDateTime(
            statusData,
            organizationExists.dateFormatExp,
            organizationExists.timeZoneExp,
            organizationExists.dateSplit
        );

        res.status(200).json(formattedData);

    } catch (error) {
        console.error("Error fetching order status:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};





// Item Track Function
async function itemTrack(existingOrderStatus, items, services, orderId, productId) {
    console.log("existingOrderStatus:", existingOrderStatus);
    console.log("items:", items);
    console.log("services:", services);
    console.log("orderId and productId:", orderId, productId);

    const hasValidType = services.some(service =>
        ["Fabric", "Raw Material", "Ready Made"].includes(service.type)
    );

    if (!hasValidType) {
        console.log(`No applicable service type found for item tracking. Skipping itemTrack creation.`);
        return;
    }
    
    const lastStatusEntry = existingOrderStatus.orderStatus[existingOrderStatus.orderStatus.length - 1];

    if (!lastStatusEntry || lastStatusEntry.status !== "Delivery") {
        console.log("Last order status is not 'Delivery'; skipping itemTrack creation.");

        // Delete previous ItemTrack entries for this operationId (orderServiceId)
        const deleteItemTrack = await ItemTrack.deleteMany({
            organizationId: existingOrderStatus.organizationId,
            operationId: existingOrderStatus.orderServiceId
        });
        console.log("Delete ItemTrack entries:", deleteItemTrack);

        return;
    }


    console.log("Creating ItemTrack entries since last status is 'Delivery'...");
    for (const item of items) {
        const matchingServiceItem = services.find(s => s._id.toString() === item.itemId.toString());
    
        if (!matchingServiceItem) {
            console.warn(`Item with ID ${item.itemId} not found in fetched services`);
            continue;
        }

        if (productId) {
            const newItemTrack = new ItemTrack({
                organizationId: existingOrderStatus.organizationId,
                operationId: existingOrderStatus.orderServiceId,  
                transactionId: orderId,                           
                action: "Internal Order",
                itemId: item.itemId,                              
                sellingPrice: item.sellingPrice || 0,
                costPrice: matchingServiceItem.costPrice || 0,
                debitQuantity: item.quantity,                                     
                createdDateTime: existingOrderStatus.createdDateTime            
            });

            const savedItemTrack = await newItemTrack.save();
            console.log("Saved ItemTrack:", savedItemTrack);

        } else {
            const newItemTrack = new ItemTrack({
                organizationId: existingOrderStatus.organizationId,
                operationId: existingOrderStatus.orderServiceId,  
                transactionId: orderId,                           
                action: "Order",
                itemId: item.itemId,                              
                sellingPrice: item.sellingPrice || 0,
                costPrice: matchingServiceItem.costPrice || 0,
                creditQuantity: item.quantity,                                  
                createdDateTime: existingOrderStatus.createdDateTime            
            });

            const savedItemTrack = await newItemTrack.save();
            console.log("Saved ItemTrack:", savedItemTrack);
        }
    } 
  }






// Validate Organization 
function validateOrganizationSetting( organizationExists, SewnexSetting, res ) {
    if (!organizationExists) {
      res.status(404).json({ message: "Organization not found" });
      return false;
    }
    if (!SewnexSetting) {
        res.status(404).json({ message: "SewnexSetting not found" });
        return false;
    }
    return true;
  }


  //Validate inputs
function validateInputs( cleanedData, orderStatus, SewnexSetting, res) {
    const validationErrors = validateData( cleanedData, orderStatus, SewnexSetting );

    if (validationErrors.length > 0) {
      res.status(400).json({ message: validationErrors.join(", ") });
      return false;
    }
    return true;
 }

//Validate Data
function validateData( data, orderStatus, settings ) {
    const errors = [];    
    //Basic Info
    validateReqFields( data, orderStatus, settings, errors );
    return errors;
}

// Field validation utility
function validateField(condition, errorMsg, errors) {
    if (condition) errors.push(errorMsg);
}

//Valid Req Fields
function validateReqFields( data, orderStatus, settings, errors ) {
    validateField( typeof data.orderServiceId === 'undefined', "orderServiceId is required!", errors  );

    if (!orderStatus || !Array.isArray(orderStatus) || orderStatus.length === 0) {
        errors.push("orderStatus array is required.");
        return;
    }

    const validStatuses = settings.orderStatus.map(s => s.orderStatusName);

    orderStatus.forEach((OS) => {
        validateField( typeof OS.status === 'undefined', "Please select the status!", errors  );
        validateField( typeof OS.date === 'undefined', "Please select the date!", errors  );
        validateField( !validStatuses.includes(OS.status), `Invalid status: ${OS.status}`, errors );
    });
}



