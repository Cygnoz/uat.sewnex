const PurchasePayment = require('../database/model/paymentMade');
const Organization = require('../database/model/organization');

// Add a new purchase payment
exports.addPurchasePayment = async (req, res) => {
  console.log("Add purchase payment:", req.body);
  const {
    organizationId,
    supplier,
    paymentDate,
    paymentId,
    paymentMode,
    paidThrough,
    reference,
    notes,
    attachments,
    unpaidBill
  } = req.body;

  try {
    // Validate organizationId
    const organizationExists = await Organization.findOne({ organizationId: organizationId });
    if (!organizationExists) {
      return res.status(404).json({ message: "Organization not found" });
    }

    // Check if a purchase payment with the same paymentId and organizationId already exists
    const existingPurchasePayment = await PurchasePayment.findOne({ paymentId: paymentId, organizationId: organizationId });
    if (existingPurchasePayment) {
      return res.status(409).json({ message: "Purchase payment with the provided paymentId already exists." });
    }
    const currentDate = new Date();
    const day = String(currentDate.getDate()).padStart(2, "0");
    const month = String(currentDate.getMonth() + 1).padStart(2, "0");
    const year = currentDate.getFullYear();
    const formattedDate = `${day}-${month}-${year}`;

    // Create a new purchase payment
    const newPurchasePayment = new PurchasePayment({
      organizationId,
      supplier,
      paymentDate,
      paymentId,
      paymentMode,
      paidThrough,
      reference,
      notes,
      attachments,
      createdDate: formattedDate,
      unpaidBill
    });

    // Save the purchase payment to the database
    const savedPurchasePayment = await newPurchasePayment.save();

    // Send response
    res.status(201).json(savedPurchasePayment);
  } catch (error) {
    console.error("Error adding purchase payment:", error);
    res.status(400).json({ error: error.message });
  }
};

// Get all purchase payments for a given organizationId
exports.getAllPurchasePayments = async (req, res) => {
  const organizationId = req.params.id;
  try {
    // Find all purchase payments where organizationId matches
    const purchasePayments = await PurchasePayment.find({ organizationId: organizationId });
    if (!purchasePayments.length) {
      return res.status(404).json({ message: "No purchase payments found for the provided organization ID." });
    }
      
    res.status(200).json(purchasePayments);
  } catch (error) {
    console.error("Error fetching purchase payments:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

// Get a single purchase payment by ID
exports.getPurchasePayment = async (req, res) => {
  try {
    const purchasePaymentId = req.params.id;
    const { organizationId } = req.body;

    const purchasePayment = await PurchasePayment.findById({
      _id: purchasePaymentId,
      organizationId: organizationId
    });

    if (!purchasePayment) {
      return res.status(404).json({ message: "Purchase payment not found" });
    }
    res.status(200).json(purchasePayment);
  } catch (error) {
    console.error("Error fetching purchase payment:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

// Update a purchase payment
exports.updatePurchasePayment = async (req, res) => {
  console.log("Update purchase payment:", req.body);

  try {
    const purchasePaymentId = req.params.id;
    const {
      organizationId,
      supplier,
      paymentDate,
      paymentId,
      paymentMode,
      paidThrough,
      reference,
      notes,
      attachments,
      unpaidBill
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

    // Check if paymentId already exists for another purchase payment
    const existingPurchasePayment = await PurchasePayment.findOne({ paymentId });
    if (existingPurchasePayment && existingPurchasePayment._id.toString() !== purchasePaymentId) {
      return res.status(400).json({ message: "Payment ID already exists for another purchase payment" });
    }

    // Find and update the purchase payment
    const updatedPurchasePayment = await PurchasePayment.findByIdAndUpdate(
      purchasePaymentId,
      {
        organizationId,
        supplier,
        paymentDate,
        paymentId,
        paymentMode,
        paidThrough,
        reference,
        notes,
        attachments,
        updatedDate: formattedDate,
        unpaidBill
      },
      { new: true, runValidators: true }
    );

    if (!updatedPurchasePayment) {
      return res.status(404).json({ message: "Purchase payment not found" });
    }

    res.status(200).json({ message: "Purchase payment updated successfully", purchasePayment: updatedPurchasePayment });
  } catch (error) {
    console.error("Error updating purchase payment:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Delete a purchase payment
exports.deletePurchasePayment = async (req, res) => {
  const purchasePaymentId = req.params.id;

  try {
    const deletedPurchasePayment = await PurchasePayment.findByIdAndDelete(purchasePaymentId);

    if (!deletedPurchasePayment) {
      return res.status(404).json({ error: 'Purchase payment not found' });
    }

    res.status(200).json({ message: 'Purchase payment deleted successfully', deletedPurchasePayment });
  } catch (error) {
    console.error("Error deleting purchase payment:", error);
    res.status(500).json({ error: 'Server error' });
  }
};
