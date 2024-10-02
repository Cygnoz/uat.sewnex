const PurchaseOrder = require('../database/model/purchaseOrder');
const Organization = require('../database/model/organization');

// Add a new purchase order
exports.addPurchaseOrder = async (req, res) => {
  console.log("Add purchase order:", req.body);
  const {
    organizationId,
    supplierId,
    supplierDisplayName,

    taxMode,

    sourceOfSupply,
    destinationOfSupply,
    
    deliveryAddress,
    customerId,

    reference,
    purchaseOrder,
    shipmentPreference,
    purchaseOrderDate,
    expectedShipmentDate,
    paymentTerms,
    paymentMode,


    discountType,
    taxType,

    //Item Table
    itemTable,

    // Other details
    otherExpense,
    otherExpenseReason,
    freight,
    vehicleNo,
    transportationMode,
    addNotes,
    termsAndConditions,
    attachFiles,

    subTotal,
    totalItem,
    sgst,
    cgst,
    transactionDiscount,
    totalTaxAmount,
    roundOff,
    grandTotal,

  } = req.body;

  try {
    // Validate organizationId
    const organizationExists = await Organization.findOne({ organizationId });
    if (!organizationExists) {
      return res.status(404).json({ message: "Organization not found" });
    }

    // Check if a purchase order in this organizationId already exists
    const existingPurchaseOrder = await PurchaseOrder.findOne({ purchaseOrder, organizationId });
    if (existingPurchaseOrder) {
      return res.status(409).json({ message: "Purchase order already exists." });
    }

    // Create a new purchase order
    const newPurchaseOrder = new PurchaseOrder({
      organizationId,
      supplierId,
      supplierDisplayName,

      //supplierBillingAddress
      supplierBillingCountry,
      supplierBillingState,

      taxMode,

      sourceOfSupply,
      destinationOfSupply,
      
      deliveryAddress,
      customerId,

      sgst,
      cgst,
      igst,
      vat,

      reference,
      purchaseOrder,
      shipmentPreference,
      purchaseOrderDate,
      expectedShipmentDate,
      paymentTerms,
      paymentMode,

      discountType,
      taxType,

      //Item Table
      itemTable,

      // Other details
      otherExpense,
      otherExpenseReason,
      freight,
      vehicleNo,
      transportationMode,
      addNotes,
      termsAndConditions,
      attachFiles,

      //transaction details
      subTotal,
      totalItem,
      sgst,
      cgst,
      transactionDiscount,
      totalTaxAmount,
      roundOff,
      grandTotal,

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
  const {organizationId} = req.body;
  try {
    // Check if the Organization exists
    const existingOrganization = await Organization.findOne({ organizationId });

    if (!existingOrganization) {
        return res.status(404).json({
            message: "No Organization Found.",
        });
    }

    // Find all purchase orders where organizationId matches
    const purchaseOrders = await PurchaseOrder.find({ organizationId });
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
    const purchaseOrder = await PurchaseOrder.findById(purchaseOrderId);

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
      taxMode,
      supplierId,
      supplierDisplayName,

      //supplierBillingAddress
      supplierBillingAttention,
      supplierBillingCountry,
      supplierBillingAddressStreet1,
      supplierBillingAddressStreet2,
      supplierBillingCity,
      supplierBillingState,
      supplierBillingPinCode,
      supplierBillingPhone,
      supplierBillingFaxNum,

      supplierGstNo,
      supplierMobile,

      sourceOfSupply,
      destinationOfSupply,
      
      deliveryAddress,
      customer,
      organization,

      reference,
      purchaseOrder,
      shipmentPreference,
      purchaseOrderDate,
      expectedShipmentDate,
      paymentTerms,
      paymentMode,
      subTotal,
      cashDiscount,
      discountType,
      grandTotal,

      //Item Table
      itemTable,

      // Other details
      expense,
      freight,
      remark,
      roundoff,
      vehicleNoORcontainerNo,
      destination,
      transportMode,
      addNotes,
      termsAndConditions,
      attachFiles,
    } = req.body;

    const currentDate = new Date();
    const day = String(currentDate.getDate()).padStart(2, "0");
    const month = String(currentDate.getMonth() + 1).padStart(2, "0");
    const year = currentDate.getFullYear();
    const formattedDate = `${day}-${month}-${year}`;

    // Validate organizationId
    const organizationExists = await Organization.findOne({ organizationId });
    if (!organizationExists) {
      return res.status(404).json({ message: "Organization not found" });
    }

    // Find and update the purchase order
    const updatedPurchaseOrder = await PurchaseOrder.findByIdAndUpdate(
      purchaseOrderId,
      {
        organizationId,
        updatedDate: formattedDate,
        taxMode,
        supplierId,
        supplierDisplayName,

        //supplierBillingAddress
        supplierBillingAttention,
        supplierBillingCountry,
        supplierBillingAddressStreet1,
        supplierBillingAddressStreet2,
        supplierBillingCity,
        supplierBillingState,
        supplierBillingPinCode,
        supplierBillingPhone,
        supplierBillingFaxNum,

        supplierGstNo,
        supplierMobile,

        sourceOfSupply,
        destinationOfSupply,
    
        deliveryAddress,
        customer,
        organization,

        reference,
        purchaseOrder,
        shipmentPreference,
        purchaseOrderDate,
        expectedShipmentDate,
        paymentTerms,
        paymentMode,
        subTotal,
        cashDiscount,
        discountType,
        grandTotal,

        //Item Table
        itemTable,

        // Other details
        expense,
        freight,
        remark,
        roundoff,
        vehicleNoORcontainerNo,
        destination,
        transportMode,
        addNotes,
        termsAndConditions,
        attachFiles,
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

    res.status(200).json({ message: 'Purchase order deleted successfully' });
  } catch (error) {
    console.error("Error deleting purchase order:", error);
    res.status(500).json({ error: 'Server error' });
  }
};
