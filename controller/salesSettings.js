const Settings = require('../database/model/settings')


exports.addSalesOrderSettings = async (req, res) => {
    try {
      const organizationId = req.user.organizationId;
      console.log("Sales setting:", req.body);
  
      const itemSettings = {
        salesOrderAddress: req.body.salesOrderAddress,
        salesOrderCustomerNote: req.body.salesOrderCustomerNote,
        salesOrderTermsCondition: req.body.salesOrderTermsCondition,
        salesOrderClose: req.body.salesOrderClose,
        restrictSalesOrderClose: req.body.restrictSalesOrderClose,
        termCondition: req.body.termCondition,
        customerNote: req.body.customerNote,
      };
  
      // Find the document by organizationId
      const existingSettings = await Settings.findOne({ organizationId });
  
      if (!existingSettings) {
        return res.status(404).json({ message: "Settings not found" });
      }
  
      // Update the document with the new item settings
      Object.assign(existingSettings, itemSettings);
  
      // Save the updated document
      await existingSettings.save();
  
      res.status(200).json("Sales Settings updated successfully");
    } catch (error) {
      console.error("Error updating sales settings:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  };

exports.updateCreditNoteSettings = async (req, res) => {
    try {
      const organizationId = req.user.organizationId;
      console.log(req.body);
      
      const creditNoteSettings = {
        overideCostPrice: req.body.overideCostPrice, 
        creditNoteQr: req.body.creditNoteQr, 
        creditNoteQrType: req.body.creditNoteQrType,
        creditNoteQrDespriction: req.body.creditNoteQrDespriction,
        recordLocking: req.body.recordLocking, 
        creditNoteTC: req.body.creditNoteTC,
        creditNoteCN: req.body.creditNoteCN,
      };
  
      // Find the document by organizationId
      const existingSettings = await Settings.findOne({ organizationId });
  
      if (!existingSettings) {
        return res.status(404).json({ message: "Settings not found" });
      }
  
      // Update the document with the new credit note settings
      Object.assign(existingSettings, creditNoteSettings);
  
      // Save the updated document
      await existingSettings.save();
  
      res.status(200).json("Credit note settings updated successfully");
    } catch (error) {
      console.error("Error updating credit note settings:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  };


// Delivery Chellans
exports.addDeliveryChellans = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    console.log("Delivery Chellans:", req.body);

    const deliveryChellans = {
      deliveryChellanTC: req.body.deliveryChellanTC,
      deliveryChellanCN: req.body.deliveryChellanCN,
    };

    // Find the document by organizationId
    const existingDeliveryChellans = await Settings.findOne({ organizationId });

    if (!existingDeliveryChellans) {
      return res.status(404).json({ message: "Delivery Chellans not found" });
    }

    // Update the document with the new Delivery Chellans
    Object.assign(existingDeliveryChellans, deliveryChellans);

    // Save the updated document
    await existingDeliveryChellans.save();

    res.status(200).json("Delivery Chellans updated successfully");
  } catch (error) {
    console.error("Error updating Delivery Chellans:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};


  
//Shipment
exports.addShipmentAddressSettings = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    console.log("Shipment Address Settings:", req.body);

    const updatedSettings = {
      carrierNotification: req.body.carrierNotification,
      manualNotification: req.body.manualNotification,
    };

    // Find the document by organizationId
    const existingSettings = await Settings.findOne({ organizationId });

    if (!existingSettings) {
      return res.status(404).json({ message: "Settings not found" });
    }

    // Update the document with the new shipment address settings
    Object.assign(existingSettings, updatedSettings);

    // Save the updated document
    await existingSettings.save();

    res.status(200).json("Shipment address settings updated successfully");
  } catch (error) {
    console.error("Error updating shipment address settings:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

//Bmcr
exports.addInvoiceSettings = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    console.log("Invoice Settings:", req.body);

    const updatedSettings = {
      invoiceEdit: req.body.invoiceEdit,
      displayExpenseReceipt: req.body.displayExpenseReceipt,
      salesOrderNumber: req.body.salesOrderNumber,
      paymentReceipt: req.body.paymentReceipt,
      invoiceQrCode: req.body.invoiceQrCode,
      invoiceQrType: req.body.invoiceQrType,
      invoiceQrDescription: req.body.invoiceQrDescription,
      zeroValue: req.body.zeroValue,
      salesInvoiceTC: req.body.salesInvoiceTC,
      salesInvoiceCN: req.body.salesInvoiceCN,
    };

    // Find the document by organizationId
    const existingSettings = await Settings.findOne({ organizationId });

    if (!existingSettings) {
      return res.status(404).json({ message: "Settings not found" });
    }

    // Update the document with the new invoice settings
    Object.assign(existingSettings, updatedSettings);

    // Save the updated document
    await existingSettings.save();

    res.status(200).json("Invoice settings updated successfully");
  } catch (error) {
    console.error("Error updating invoice settings:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
