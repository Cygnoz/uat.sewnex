const Organization = require("../../database/model/organization");
const Customer = require("../../database/model/customer");
const Settings = require("../../database/model/settings");
const Prefix = require("../../database/model/prefix");
const Service = require("../model/service");
const SewnexOrder = require("../model/sxOrder");
const SewnexOrderService = require("../model/sxOrderService");
const DefAcc = require("../../database/model/defaultAccount");
const Account = require("../../database/model/account");
const TrialBalance = require("../../database/model/trialBalance");
const Item = require("../../database/model/item");

const { cleanData } = require("../../services/cleanData");
const { singleCustomDateTime, multiCustomDateTime } = require("../../services/timeConverter");

const mongoose = require('mongoose');
const moment = require("moment-timezone");

// Fetch existing data
const dataExist = async (organizationId, customerId, orderId = null) => {
    const promises = [
        Organization.findOne({ organizationId }, { organizationId: 1, organizationCountry: 1, state: 1, timeZoneExp: 1, dateFormatExp: 1 }),
        customerId ? Customer.findOne({ organizationId, _id: customerId }, { _id: 1, customerDisplayName: 1, taxType: 1 }) : null,
        Settings.findOne({ organizationId }),
        Prefix.findOne({ organizationId }),
        DefAcc.findOne({ organizationId }),
        customerId ? Account.findOne({ organizationId, accountId: customerId }, { _id: 1, accountName: 1 }) : null,
        orderId ? SewnexOrder.findOne({ organizationId, _id: orderId })
            .populate('customerId', 'customerDisplayName')
            .populate({
                path: 'service.orderServiceId',
                populate: [
                    { path: 'serviceId', select: 'serviceName' },
                    { path: 'fabric.itemId', select: 'itemName' },
                    { path: 'measurement.parameterId', select: 'parameterName' },
                    { path: 'style.styleId', select: 'styleName' }
                ]
            }) : null,
        orderId ? null : SewnexOrder.find({ organizationId })
            .populate('customerId', 'customerDisplayName')
            .populate({
                path: 'service.orderServiceId',
                populate: [
                    { path: 'serviceId', select: 'serviceName' },
                    { path: 'fabric.itemId', select: 'itemName' }
                ]
            })
    ];

    const [
        organizationExists, 
        customerExist, 
        settings, 
        existingPrefix, 
        defaultAccount, 
        customerAccount,
        order,
        orders
    ] = await Promise.all(promises.filter(p => p !== null));

    return { 
        organizationExists, 
        customerExist, 
        settings, 
        existingPrefix, 
        defaultAccount, 
        customerAccount,
        order,
        orders
    };
};

// Add Sewnex Order
exports.addOrder = async (req, res) => {
    try {
        const { organizationId, id: userId } = req.user;
        const cleanedData = cleanData(req.body);
        const { customerId, service } = cleanedData;

        if (!customerId || !service || !Array.isArray(service)) {
            return res.status(400).json({ message: "Missing required fields" });
        }

        const { organizationExists, customerExist, existingPrefix } = await dataExist(organizationId, customerId);

        if (!organizationExists || !customerExist) {
            return res.status(404).json({ message: "Organization or Customer not found" });
        }

        const orderServices = await Promise.all(service.map(async (serviceItem) => {
            const newOrderService = new SewnexOrderService({
                ...serviceItem,
                organizationId
            });
            return await newOrderService.save();
        }));

        cleanedData.service = orderServices.map(service => ({
            orderServiceId: service._id,
            sellingPrice: service.serviceRate + service.fabricRate + service.styleRate,
            taxPreference: service.fabric[0]?.taxPreference || 'Non-Taxable',
            taxGroup: service.fabric[0]?.taxGroup || '0',
            itemTotalTax: service.fabric.reduce((sum, item) => sum + (item.itemTotalTax || 0), 0)
        }));

        const newOrder = new SewnexOrder({
            ...cleanedData,
            organizationId,
            userId,
            createdDateTime: moment.tz(new Date(), organizationExists.timeZoneExp).toISOString()
        });

        const savedOrder = await newOrder.save();

        res.status(201).json({
            message: "Sewnex Order created successfully",
            data: savedOrder
        });

    } catch (error) {
        console.error("Error creating Sewnex Order:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// Get All Orders
exports.getAllOrders = async (req, res) => {
    try {
        const { organizationId } = req.user;

        const { organizationExists, orders } = await dataExist(organizationId);

        if (!orders?.length) {
            return res.status(404).json({ message: "No orders found" });
        }

        const formattedOrders = multiCustomDateTime(
            orders,
            organizationExists.dateFormatExp,
            organizationExists.timeZoneExp
        );

        res.status(200).json(formattedOrders);

    } catch (error) {
        console.error("Error fetching orders:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// Get One Order
exports.getOneOrder = async (req, res) => {
    try {
        const { organizationId } = req.user;
        const { orderId } = req.params;

        const { organizationExists, order } = await dataExist(organizationId, null, orderId);

        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }

        const formattedOrder = singleCustomDateTime(
            order,
            organizationExists.dateFormatExp,
            organizationExists.timeZoneExp
        );

        res.status(200).json(formattedOrder);

    } catch (error) {
        console.error("Error fetching order:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// Edit Order
exports.editOrder = async (req, res) => {
    try {
        const { organizationId } = req.user;
        const { orderId } = req.params;
        const updates = cleanData(req.body);

        const { order } = await dataExist(organizationId, null, orderId);

        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }

        if (updates.service) {
            await Promise.all(updates.service.map(async (serviceItem) => {
                if (serviceItem.orderServiceId) {
                    await SewnexOrderService.findByIdAndUpdate(
                        serviceItem.orderServiceId,
                        serviceItem,
                        { new: true }
                    );
                }
            }));
        }

        const updatedOrder = await SewnexOrder.findByIdAndUpdate(
            orderId,
            updates,
            { new: true }
        )
        .populate('customerId', 'customerDisplayName')
        .populate({
            path: 'service.orderServiceId',
            populate: [
                { path: 'serviceId', select: 'serviceName' },
                { path: 'fabric.itemId', select: 'itemName' }
            ]
        });

        res.status(200).json({
            message: "Order updated successfully",
            data: updatedOrder
        });

    } catch (error) {
        console.error("Error updating order:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// Delete Order
exports.deleteOrder = async (req, res) => {
    try {
        const { organizationId } = req.user;
        const { orderId } = req.params;

        const { order } = await dataExist(organizationId, null, orderId);

        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }

        await Promise.all([
            ...order.service.map(service => 
                SewnexOrderService.findByIdAndDelete(service.orderServiceId)
            ),
            SewnexOrder.findByIdAndDelete(orderId)
        ]);

        res.status(200).json({ message: "Order deleted successfully" });

    } catch (error) {
        console.error("Error deleting order:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
