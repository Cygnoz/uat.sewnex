const Invoice = require("../database/model/salesInvoice")


exports.customerSaleHistory = async (req, res) => {
  try {
    const { id } = req.params; 
    const { organizationId } = req.user;

    // Query to match customerId and organizationId in the Invoice collection
    const salesHistory = await Invoice.find({
      customerId: id,
      organizationId: organizationId
    });

    // Check if sales history exists
    if (salesHistory.length > 0) {
        const SalesHistory = salesHistory.map((history) => {
          const { organizationId, ...rest } = history.toObject(); // Convert to plain object and omit organizationId
          return rest;
        });
        res.status(200).json(SalesHistory);
      } else {
        return res.status(404).json("No Sales History found for the customer");
      }
  } catch (error) {
    // Handle any errors
    return res.status(500).json({ message: "Error fetching sales history", error });
  }
};

