const Organization = require("../../database/model/organization");
const Customer = require("../../database/model/customer");
const Settings = require("../../database/model/settings");
const Prefix = require("../../database/model/prefix");
const DefAcc = require("../../database/model/defaultAccount");
const Account = require("../../database/model/account");
const TrialBalance = require("../../database/model/trialBalance");
const Item = require("../../database/model/item");
const Staff = require("../../database/model/staff");

const SewnexOrder = require("../model/sxOrder");
const Service = require("../model/service");
const SewnexOrderService = require("../model/sxOrderService");
const InternalOrder = require("../model/internalOrder");
const CPS = require("../model/cps");

const { dataExist, validation, prefix } = require("../controller/internalOrderCont");

const { cleanData } = require("../../services/cleanData");

const mongoose = require('mongoose');
const moment = require("moment-timezone");



// Edit Sewnex Internal Order
exports.editInternalOrder = async (req, res) => {
    console.log("Edit Internal Order", req.body);

    try {
        const { organizationId, id: userId } = req.user;
        const { orderId } = req.params; 

        // Fetch existing internal order
        const existingInternalOrder = await InternalOrder.findOne({ _id: orderId, organizationId });
        if (!existingInternalOrder) {
            console.log("Internal order not found with ID:", orderId);
            return res.status(404).json({ message: "Internal order not found!" });
        }

        const cleanedData = cleanData(req.body);

        // Ensure `internalOrder` field matches the existing internal order
        if (cleanedData.internalOrder !== existingInternalOrder.internalOrder) {
            return res.status(400).json({
            message: `The provided internalOrder does not match the existing record. Expected: ${existingInternalOrder.internalOrder}`,
            });
        }
        
        cleanedData.service = cleanedData.service
        ?.map(data => cleanData(data))
        .filter(service => service.serviceId !== undefined && service.serviceId !== '') || [];
        
        const { designerId, service } = cleanedData;
        
        const serviceIds = service.map(service => service.serviceId);

        // Check for duplicate itemIds
        // const uniqueItemIds = new Set(serviceIds);
        // if (uniqueItemIds.size !== serviceIds.length) {
        //   return res.status(400).json({ message: "Duplicate service found" });
        // }        

        // Validate serviceIds
        const invalidServiceIds = serviceIds.filter(serviceId => !mongoose.Types.ObjectId.isValid(serviceId) || serviceId.length !== 24);
        if (invalidServiceIds.length > 0) {
          return res.status(400).json({ message: `Invalid service IDs: ${invalidServiceIds.join(', ')}` });
        } 

        const { organizationExists, staffExist, existingPrefix, services, allFabrics, allReadyMade, allStyle, allParameter } = await dataExist.dataExist(organizationId, designerId, serviceIds);

        const allData = { allParameter, allFabrics, allReadyMade, allStyle, services };
        
        if (!validation.validateOrganizationTaxCurrency( organizationExists, staffExist, existingPrefix, res )) return;
        
        //Validate Inputs
        if (!validation.validateInputs( cleanedData, allData, res)) return;

        cleanedData.createdDateTime = moment.tz(cleanedData.internalOrderDate, "YYYY-MM-DDTHH:mm:ss.SSS[Z]", organizationExists.timeZoneExp).toISOString();           

        // **Step 1: Delete existing orderServiceId(s) from SewnexOrderService**
        await SewnexOrderService.deleteMany({ _id: { $in: existingInternalOrder.service.map(s => s.orderServiceId) } });

        // **Step 2: Create new orderServiceId(s)**
        const orderServices = await Promise.all(service.map(async (serviceItem) => {
            await prefix.salesOrderServicePrefix(serviceItem, existingPrefix);
            const newOrderService = new SewnexOrderService({
                ...serviceItem,
                organizationId,
                createdDateTime: cleanedData.createdDateTime // Pass new createdDateTime
            });
            return await newOrderService.save();
        }));

        existingPrefix.save();

        // **Step 3: Assign new orderServiceIds to cleanedData.service**
        cleanedData.service = orderServices.map(service => ({
            orderServiceId: service._id,
        }));

        // **Step 4: Update InternalOrder**
        const mongooseDocument = InternalOrder.hydrate(existingInternalOrder);
        Object.assign(mongooseDocument, cleanedData);
        const savedInternalOrder = await mongooseDocument.save();
        if (!savedInternalOrder) {
            return res.status(500).json({ message: "Failed to update internal order" });
        }

        console.log( "Internal Order created successfully:", savedInternalOrder );
        res.status(201).json({
            message: "Internal Order created successfully",
            data: savedInternalOrder
        });

    } catch (error) {
        console.error("Error creating internal order:", error);
        res.status(500).json({ message: "Internal server error" });
    }

}







// Delete Internal Order
exports.deleteInternalOrder = async (req, res) => {
    console.log("Delete internal order request received:", req.params);

    try {
        const { organizationId, id: userId } = req.user;
        const { orderId } = req.params;

        // Validate orderId
        if (!mongoose.Types.ObjectId.isValid(orderId) || orderId.length !== 24) {
            return res.status(400).json({ message: `Invalid Internal Order ID: ${orderId}` });
        }

        // Fetch existing internal order
        const existingInternalOrder = await InternalOrder.findOne({ _id: orderId, organizationId });
        if (!existingInternalOrder) {
            console.log("Internal order not found with ID:", orderId);
            return res.status(404).json({ message: "Internal order not found!" });
        }

        // Delete associated order services
        const deleteServicesResult = await SewnexOrderService.deleteMany({ 
            _id: { $in: existingInternalOrder.service.map(s => s.orderServiceId) } 
        });

        console.log(`Deleted ${deleteServicesResult.deletedCount} related order services.`);

        // Delete the internal order
        const deletedInternalOrder = await existingInternalOrder.deleteOne();
        if (!deletedInternalOrder) {
            console.error("Failed to delete internal order.");
            return res.status(500).json({ message: "Failed to delete internal order" });
        }
    
        res.status(200).json({ message: "Internal order deleted successfully" });
        console.log("Internal order deleted successfully with ID:", orderId);

    } catch (error) {
        console.error("Error deleting internal order:", error);
        res.status(500).json({ message: "Internal server error" });
    }
  };