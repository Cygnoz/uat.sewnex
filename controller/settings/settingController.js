// v1.1

const Organization = require("../../database/model/organization")
const Settings = require('../../database/model/settings')


// Get settings
exports.getSettings = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;    

    const settings = await Settings.findOne({ organizationId });

    if (!settings) {
      return res.status(404).json({ message: "No settings found for this organization" });
    }

    // Organize the settings into categories
    const organizedSettings = {
      invoice: {
        organizationAddressFormat: settings.organizationAddressFormat,
        qrLocation: settings.qrLocation,
        displayQrLocation: settings.displayQrLocation,
        qrPayment: settings.qrPayment,
        displayQrPayment: settings.displayQrPayment,
        digitalSignature: settings.digitalSignature,
        displayDigitalSignature: settings.displayDigitalSignature,
        xLink: settings.xLink,
        displayXLink: settings.displayXLink,
        instagramLink: settings.instagramLink,
        displayInstagramLink: settings.displayInstagramLink,
        linkedinLink: settings.linkedinLink,
        displayLinkedinLink: settings.displayLinkedinLink,
        facebookLink: settings.facebookLink,
        displayFacebookLink: settings.displayFacebookLink,
        accountHolderName: settings.accountHolderName,
        displayAccountHolderName: settings.displayAccountHolderName,
        bankName: settings.bankName,
        displayBankName: settings.displayBankName,
        accNum: settings.accNum,
        displayAccNum: settings.displayAccNum,
        ifsc: settings.ifsc,
        displayIfsc: settings.displayIfsc,
        defaultTermsAndCondition: settings.defaultTermsAndCondition
      },
      itemSettings: {
        itemDecimal: settings.itemDecimal,
        itemDimensions: settings.itemDimensions,
        itemWeights: settings.itemWeights,
        barcodeScan: settings.barcodeScan,
        itemDuplicateName: settings.itemDuplicateName,
        hsnSac: settings.hsnSac,
        hsnDigits: settings.hsnDigits,
        priceList: settings.priceList,
        priceListAtLineLevel: settings.priceListAtLineLevel,
        compositeItem: settings.compositeItem,
        stockBelowZero: settings.stockBelowZero,
        outOfStockBelowZero: settings.outOfStockBelowZero,
        notifyReorderPoint: settings.notifyReorderPoint,
        trackCostOnItems: settings.trackCostOnItems
      },
      salesOrderSettings: {
        salesOrderAddress: settings.salesOrderAddress,
        salesOrderCustomerNote: settings.salesOrderCustomerNote,
        salesOrderTermsCondition: settings.salesOrderTermsCondition,
        salesOrderClose: settings.salesOrderClose,
        restrictSalesOrderClose: settings.restrictSalesOrderClose,
        termCondition: settings.termCondition,
        customerNote: settings.customerNote
      },
      shipmentSettings: {
        carrierNotification: settings.carrierNotification,
        manualNotification: settings.manualNotification,
        shippingAddress: settings.shippingAddress
      },
      salesInvoiceSettings: {
        invoiceEdit: settings.invoiceEdit,
        displayExpenseReceipt: settings.displayExpenseReceipt,
        salesOrderNumber: settings.salesOrderNumber,
        paymentReceipt: settings.paymentReceipt,
        invoiceQrCode: settings.invoiceQrCode,
        invoiceQrType: settings.invoiceQrType,
        invoiceQrDescription: settings.invoiceQrDescription,
        zeroValue: settings.zeroValue,
        salesInvoiceTC: settings.salesInvoiceTC,
        salesInvoiceCN: settings.salesInvoiceCN
      },
      deliveryChellans: {
        deliveryChellanTC: settings.deliveryChellanTC,
        deliveryChellanCN: settings.deliveryChellanCN
      },
      creditNoteSettings: {
        overRideCostPrice: settings.overRideCostPrice,
        creditNoteQr: settings.creditNoteQr,
        creditNoteQrType: settings.creditNoteQrType,
        creditNoteQrDespriction: settings.creditNoteQrDespriction,
        recordLocking: settings.recordLocking,
        creditNoteTC: settings.creditNoteTC,
        creditNoteCN: settings.creditNoteCN
      },
      purchaseOrderSettings: {
        purchaseOrderClose: settings.purchaseOrderClose,
        purchaseTC: settings.purchaseTC,
        purchaseNote: settings.purchaseNote
      },
      supplierCustomerSettings:{
        duplicateSupplierDisplayName: settings.duplicateSupplierDisplayName,
        duplicateSupplierEmail: settings.duplicateSupplierEmail,
        duplicateSupplierMobile: settings.duplicateSupplierMobile,
        duplicateCustomerDisplayName: settings.duplicateCustomerDisplayName,
        duplicateCustomerEmail: settings.duplicateCustomerEmail,
        duplicateCustomerMobile: settings.duplicateCustomerMobile
      }
    };
    console.log(organizedSettings);


    // Return the organized settings
    res.status(200).json(organizedSettings);
  } catch (error) {
    console.error("Error retrieving settings:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};



// More details
// Setup Invoice settings
exports.updateInvoiceSettings = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    console.log(req.body);
    
    const invoiceSettings = {
      organizationAddressFormat: req.body.organizationAddressFormat,
      qrLocation: req.body.qrLocation,
      displayQrLocation: req.body.displayQrLocation,
      qrPayment: req.body.qrPayment,
      displayQrPayment: req.body.displayQrPayment,
      digitalSignature: req.body.digitalSignature,
      displayDigitalSignature: req.body.displayDigitalSignature,
      xLink: req.body.xLink,
      displayXLink: req.body.displayXLink,
      instagramLink: req.body.instagramLink,
      displayInstagramLink: req.body.displayInstagramLink,
      linkedinLink: req.body.linkedinLink,
      displayLinkedinLink: req.body.displayLinkedinLink,
      facebookLink: req.body.facebookLink,
      displayFacebookLink: req.body.displayFacebookLink,

      accountHolderName: req.body.accountHolderName,
      displayAccountHolderName: req.body.displayAccountHolderName,
      bankName: req.body.bankName,
      displayBankName: req.body.displayBankName,
      accNum: req.body.accNum,
      displayAccNum: req.body.displayAccNum,
      ifsc: req.body.ifsc,
      displayIfsc: req.body.displayIfsc,
      defaultTermsAndCondition: req.body.defaultTermsAndCondition
    };

    // Find the document by organizationId
    const existingSettings = await Settings.findOne({ organizationId });

    if (!existingSettings) {
      return res.status(404).json({ message: "Settings not found" });
    }

    // Update the document with the new invoice settings
    Object.assign(existingSettings, invoiceSettings);

    // Save the updated document
    await existingSettings.save();

    res.status(200).json("Invoice settings updated successfully");
  } catch (error) {
    console.error("Error updating invoice settings:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};





































