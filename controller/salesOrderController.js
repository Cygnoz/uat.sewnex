// const salesOrderAndQuotes = require('../database/model/salesOrderAndQuotes');

// Example function to add a sales order or quote
exports.addSalesOrder = async (req, res) => {
    try {
        const {
            salesOrder,
            customer,
            reference,
            salesOrderDate,
            expectedShipmentDate,
            paymentTerms,
            deliveryMethod,
            salesPerson,
            items,
            notes,
            tc
        } = req.body;

           // Check if an Organization already exists
    const existingOrganization = await Organization.findOne({ organizationId });
 
    if (!existingOrganization) {
      return res.status(404).json({
        message: "No Organization Found.",
      });
    }
        const newSalesOrder = new salesOrderAndQuotes({
            salesOrder,
            customer,
            reference,
            salesOrderDate,
            expectedShipmentDate,
            paymentTerms,
            deliveryMethod,
            salesPerson,
            items,
            notes,
            tc
        });

        await newSalesOrder.save();
        res.status(201).json({ message: 'Sales order created successfully' });
    } catch (error) {
        console.error('Error creating sales order:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};
