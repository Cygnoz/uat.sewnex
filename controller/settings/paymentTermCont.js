

const Organization = require("../../database/model/organization")

const PaymentTerms = require('../../database/model/paymentTerm')


// Payment Term
// Add payment terms
exports.addPaymentTerm = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const { name, days } = req.body;

    // Check if a payment term with the same name and organizationId already exists
    const existingPaymentTerm = await PaymentTerms.findOne({ organizationId, name });

    if (existingPaymentTerm) {
      return res.status(400).json({ message: "Payment Term with this name already exists for the organization" });
    }

    // If no duplicate is found, create a new payment term
    const newPaymentTerm = new PaymentTerms({
      organizationId,
      name,
      days
    });

    await newPaymentTerm.save();

    res.status(201).json("Payment Term added successfully");
  } catch (error) {
    console.log("Error adding Payment Term:", error);
    res.status(500).json({ message: "Internal server error.", error : error.message, stack: error.stack });
  }
};

// Edit payment terms
exports.editPaymentTerm = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const { id } = req.params;
    const { name, days } = req.body;

    const updatedPaymentTerm = await PaymentTerms.findByIdAndUpdate(
      id,
      { organizationId, name, days },
      { new: true }
    );

    if (!updatedPaymentTerm) {
      return res.status(404).json({ message: "Payment Term not found" });
    }

    res.status(200).json("Payment Term updated successfully");
  } catch (error) {
    console.log("Error updating Payment Term:", error);
    res.status(500).json({ message: "Internal server error.", error : error.message, stack: error.stack });
  }
};

// Delete payment terms
exports.deletePaymentTerm = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedPaymentTerm = await PaymentTerms.findByIdAndDelete(id);

    if (!deletedPaymentTerm) {
      return res.status(404).json({ message: "Payment Term not found" });
    }

    res.status(200).json("Payment Term deleted successfully");
  } catch (error) {
    console.log("Error deleting Payment Term:", error);
    res.status(500).json({ message: "Internal server error.", error : error.message, stack: error.stack });
  }
};

// Get all payment terms
exports.getAllPaymentTerms = async (req, res) => {
  try {
    const { organizationId } = req.user; // Correct destructuring
    const paymentTerms = await PaymentTerms.find({ organizationId }); // Use correct query format
    
    if (!paymentTerms || paymentTerms.length === 0) {
      return res.status(404).json({ message: "No Payment Terms found" });
    }

    res.status(200).json(paymentTerms);
  } catch (error) {
    console.log("Error fetching Payment Terms:", error);
    res.status(500).json({ message: "Internal server error.", error : error.message, stack: error.stack });
  }
};
