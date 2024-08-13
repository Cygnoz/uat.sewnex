const PurchaseOrder = require('../database/model/purchaseOrder');
const Organization = require('../database/model/organization');

// Add a new purchase order
exports.addPurchaseOrder = async (req, res) => {
  console.log("Add purchase order:", req.body);
  const {
    organizationId,
    orderId,
    deliveryAddress,
    customer,
    warehouse,
    warehouseToBeUpdated,
    reference,
    shipmentPreference,
    purchaseOrderDate,
    expectedShipmentDate,
    paymentTerms,
    addNotes,
    termsAndConditions,
    purchaseOrder
  } = req.body;

  try {
    // Validate organizationId
    const organizationExists = await Organization.findOne({ organizationId: organizationId });
    if (!organizationExists) {
      return res.status(404).json({ message: "Organization not found" });
    }

    // Check if a purchase order with the same orderId and organizationId already exists
    const existingPurchaseOrder = await PurchaseOrder.findOne({ orderId: orderId, organizationId: organizationId });
    if (existingPurchaseOrder) {
      return res.status(409).json({ message: "Purchase order with the provided orderId already exists." });
    }
    const currentDate = new Date();
    const day = String(currentDate.getDate()).padStart(2, "0");
    const month = String(currentDate.getMonth() + 1).padStart(2, "0");
    const year = currentDate.getFullYear();
    const formattedDate = `${day}-${month}-${year}`;

    // Create a new purchase order
    const newPurchaseOrder = new PurchaseOrder({
      organizationId,
      orderId,
      createdDate: formattedDate,
      deliveryAddress,
      customer,
      warehouse,
      warehouseToBeUpdated,
      reference,
      shipmentPreference,
      purchaseOrderDate,
      expectedShipmentDate,
      paymentTerms,
      addNotes,
      termsAndConditions,
      purchaseOrder
    });

    // Save the purchase order to the database
    const savedPurchaseOrder = await newPurchaseOrder.save();

    // Send response
    res.status(201).json(savedPurchaseOrder);
  } catch (error) {
    console.error("Error adding purchase order:", error);
    res.status(400).json({ error: error.message });
  }
};

// Get all purchase orders for a given organizationId
exports.getAllPurchaseOrders = async (req, res) => {
  const organizationId = req.params.id;
  try {
    // Find all purchase orders where organizationId matches
    const purchaseOrders = await PurchaseOrder.find({ organizationId: organizationId });
    if (!purchaseOrders.length) {
      return res.status(404).json({ message: "No purchase orders found for the provided organization ID." });
    }
      
    res.status(200).json(purchaseOrders);
  } catch (error) {
    console.error("Error fetching purchase orders:", error); 
    res.status(500).json({ message: "Internal server error." });
  }
};

// Get a single purchase order by ID
exports.getPurchaseOrder = async (req, res) => {
  try {
    const purchaseOrderId = req.params.id;
    const { organizationId } = req.body;

    const purchaseOrder = await PurchaseOrder.findById({
      _id: purchaseOrderId,
      organizationId: organizationId
    });

    if (!purchaseOrder) {
      return res.status(404).json({ message: "Purchase order not found" });
    }
    res.status(200).json(purchaseOrder);
  } catch (error) {
    console.error("Error fetching purchase order:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

// Update a purchase order
exports.updatePurchaseOrder = async (req, res) => {
  console.log("Update purchase order:", req.body);

  try {
    const purchaseOrderId = req.params.id;
    const {
      organizationId,
      orderId,
      deliveryAddress,
      customer,
      warehouse,
      warehouseToBeUpdated,
      reference,
      shipmentPreference,
      purchaseOrderDate,
      expectedShipmentDate,
      paymentTerms,
      addNotes,
      termsAndConditions,
      purchaseOrder
    } = req.body;

    const currentDate = new Date();
    const day = String(currentDate.getDate()).padStart(2, "0");
    const month = String(currentDate.getMonth() + 1).padStart(2, "0");
    const year = currentDate.getFullYear();
    const formattedDate = `${day}-${month}-${year}`;

    // Validate organizationId
    const organizationExists = await Organization.findOne({ organizationId: organizationId });
    if (!organizationExists) {
      return res.status(404).json({ message: "Organization not found" });
    }

    // Check if orderId already exists for another purchase order
    const existingPurchaseOrder = await PurchaseOrder.findOne({ orderId });
    if (existingPurchaseOrder && existingPurchaseOrder._id.toString() !== purchaseOrderId) {
      return res.status(400).json({ message: "Order ID already exists for another purchase order" });
    }

    // Find and update the purchase order
    const updatedPurchaseOrder = await PurchaseOrder.findByIdAndUpdate(
      purchaseOrderId,
      {
        organizationId,
        orderId,
        updatedDate: formattedDate,
        deliveryAddress,
        customer,
        warehouse,
        warehouseToBeUpdated,
        reference,
        shipmentPreference,
        purchaseOrderDate,
        expectedShipmentDate,
        paymentTerms,
        addNotes,
        termsAndConditions,
        purchaseOrder
      },
      { new: true, runValidators: true }
    );

    if (!updatedPurchaseOrder) {
      return res.status(404).json({ message: "Purchase order not found" });
    }

    res.status(200).json({ message: "Purchase order updated successfully", purchaseOrder: updatedPurchaseOrder });
  } catch (error) {
    console.error("Error updating purchase order:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Delete a purchase order
exports.deletePurchaseOrder = async (req, res) => {
  const purchaseOrderId = req.params.id;

  try {
    const deletedPurchaseOrder = await PurchaseOrder.findByIdAndDelete(purchaseOrderId);

    if (!deletedPurchaseOrder) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }

    res.status(200).json({ message: 'Purchase order deleted successfully', deletedPurchaseOrder });
  } catch (error) {
    console.error("Error deleting purchase order:", error);
    res.status(500).json({ error: 'Server error' });
  }
};
