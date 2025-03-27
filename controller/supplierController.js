const PurchaseOrder = require('../database/model/purchaseOrder');
const PurchaseBill = require('../database/model/bills');

exports.getPurchaseOrderSupplier = async (req, res) => {
    try {
        const { id } = req.params; 
        const { organizationId } = req.user;
        // const organizationId = req.user.organizationId;

        // Find the PurchaseOrder document by id and organizationId
        const purchaseOrder = await PurchaseOrder.find({ supplierId: id, organizationId: organizationId });

        if (purchaseOrder.length > 0) {
            const PurchaseOrder = purchaseOrder.map((history) => {
              const { organizationId, ...rest } = history.toObject(); // Convert to plain object and omit organizationId
              return rest;
            });
            res.status(200).json(PurchaseOrder);
          } else {
            return res.status(404).json("No Purchase Order found for the given Supplier");
          }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error.", error : error.message, stack: error.stack });
    }
};

exports.getBillsSupplier = async (req, res) => {
    try {
        const { id } = req.params; 
        const { organizationId } = req.user;
        // const organizationId = req.user.organizationId;

        // Find the PurchaseOrder document by id and organizationId
        const purchaseBill = await PurchaseBill.find({ supplierId: id, organizationId: organizationId });

        if (purchaseBill.length > 0) {
            const PurchaseBill = purchaseBill.map((history) => {
              const { organizationId, ...rest } = history.toObject(); // Convert to plain object and omit organizationId
              return rest;
            });
            res.status(200).json(PurchaseBill);
          } else {
            return res.status(404).json("No purchase Bill found for the given Supplier");
          }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error.", error : error.message, stack: error.stack });
    }
};