const Settings = require('../database/model/settings')


exports.addSalesOrderSettings = async (req, res) => {
    try {
      const { organizationId } = req.body;
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
  
      res.status(200).json("sales settings updated successfully");
    } catch (error) {
      console.error("Error updating sales settings:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  };

exports.updateCreditNoteSettings = async (req, res) => {
    try {
      const { organizationId } = req.body;
      console.log(req.body);
  
      const creditNoteSettings = {
        overrideCostPrice: req.body.overrideCostPrice, // default to false
        creditNoteQr: req.body.creditNoteQr, // default to false
        creditNoteQrType: req.body.creditNoteQrType,
        creditNoteQrDescription: req.body.creditNoteQrDescription,
        recordLocking: req.body.recordLocking, // default to false
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
    const { organizationId } = req.body;
    console.log("Delivery Chellans:", req.body);

    const deliveryChellansSettings = {
      deliveryChellanTC: req.body.deliveryChellanTC,
      deliveryChellanCN: req.body.deliveryChellanCN,
    };

    // Find the document by organizationId
    const existingSettings = await Settings.findOne({ organizationId });

    if (!existingSettings) {
      return res.status(404).json({ message: "Settings not found" });
    }

    // Update the document with the new Delivery Chellans
    Object.assign(existingSettings, deliveryChellansSettings);

    // Save the updated document
    await existingSettings.save();

    res.status(200).json("Delivery chellans settings updated successfully");
  } catch (error) {
    console.error("Error updating Delivery Chellans:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

  
  //shipment
  exports.addShipmentAddressSettings = async (req, res) => {
    try {
      const { organizationId } = req.body;
      console.log("Sales setting:", req.body);
  
      const updatedSettings = {
        carrierNotification: req.body.carrierNotification,
        manualNotification: req.body.manualNotification,
        shippingAddress: req.body.shippingAddress,
      };
  
      // Find the document by organizationId
      const existingSettings = await Settings.findOne({ organizationId });
  
      if (!existingSettings) {
        return res.status(404).json({ message: "Settings not found" });
      }
  
      // Update the document with the new settings
      Object.assign(existingSettings, updatedSettings);
  
      // Save the updated document
      await existingSettings.save();
  
      res.status(200).json("Settings updated successfully");
    } catch (error) {
      console.error("Error updating settings:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  };


  //Invoice
  exports.addInvoiceSettings = async (req, res) => {
    try {
      const { organizationId } = req.body;
      console.log("Invoice Settings:", req.body);
   
      const updatedSettings = {
        invoiceEdit: req.body.invoiceEdit,
        displayExpenseReceipt: req.body.displayExpenseReceipt,
        salesOrserNumber: req.body.salesOrserNumber,
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
  