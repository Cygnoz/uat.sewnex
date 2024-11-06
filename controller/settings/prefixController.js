
const Organization = require("../../database/model/organization")
const Prefix = require('../../database/model/prefix')


//Add Prefix 
exports.addPrefix = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const { seriesName, journal, journalNum, creditNote, creditNoteNum, customerPayment, customerPaymentNum, purchaseOrder, purchaseOrderNum, salesOrder, salesOrderNum, vendorPayment, vendorPaymentNum, retainerInvoice, retainerInvoiceNum, vendorCredits, vendorCreditsNum, billOfSupply, billOfSupplyNum, debitNote, debitNoteNum, invoice, invoiceNum, quote, quoteNum, deliveryChallan, deliveryChallanNum } = req.body;

    const newSeries = {
      seriesName,
      status: false, 
      journal,      journalNum,
      creditNote,      creditNoteNum,
      customerPayment,      customerPaymentNum,
      purchaseOrder,      purchaseOrderNum,
      salesOrder,      salesOrderNum,
      vendorPayment,      vendorPaymentNum,
      retainerInvoice,      retainerInvoiceNum,
      vendorCredits,      vendorCreditsNum,
      billOfSupply,      billOfSupplyNum,
      debitNote,      debitNoteNum,
      invoice,      invoiceNum,
      quote,      quoteNum,
      deliveryChallan,      deliveryChallanNum,
    };

    // Find the existing prefix collection by organizationId
    const prefix = await Prefix.findOne({ organizationId });

    if (!prefix) {
      return res.status(404).json({ message: "Prefix collection not found for the given organization." });
    }

    const fieldsToCheck = [
      { key: 'seriesName', value: seriesName, message: "Series name already exists in the collection." },
      { key: 'journal', value: journal, message: "Journal Prefix already exists in the collection." },
      { key: 'creditNote', value: creditNote, message: "Credit Note already exists in the collection." },
      { key: 'customerPayment', value: customerPayment, message: "Customer Payment Prefix already exists in the collection." },
      { key: 'purchaseOrder', value: purchaseOrder, message: "Purchase Order Prefix already exists in the collection." },
      { key: 'salesOrder', value: salesOrder, message: "Sales Order Prefix already exists in the collection." },
      { key: 'vendorPayment', value: vendorPayment, message: "Vendor Payment Prefix already exists in the collection." },
      { key: 'retainerInvoice', value: retainerInvoice, message: "Retainer Invoice Prefix already exists in the collection." },
      { key: 'vendorCredits', value: vendorCredits, message: "Vendor Credits Prefix already exists in the collection." },
      { key: 'billOfSupply', value: billOfSupply, message: "Bill Of Supply Prefix already exists in the collection." },
      { key: 'debitNote', value: debitNote, message: "Debit Note Prefix already exists in the collection." },
      { key: 'invoice', value: invoice, message: "Invoice Prefix already exists in the collection." },
      { key: 'quote', value: quote, message: "Quote Prefix already exists in the collection." },
      { key: 'deliveryChallan', value: deliveryChallan, message: "Delivery Challan Prefix already exists in the collection." }
    ];
    
    // Function to check if a value already exists in the series array
    const valueExists = (array, key, value) => array.some(item => item[key] === value);
    
    // Loop through each field and check if it exists
    for (const field of fieldsToCheck) {
      if (valueExists(prefix.series, field.key, field.value)) {
        return res.status(400).json({ message: field.message });
      }
    }
        // Add the new series to the series array
    prefix.series.push(newSeries);

    // Save the updated prefix collection
    const updatedPrefix = await prefix.save();

    res.status(201).json({ message: "Prefix added successfully", updatedPrefix });
  } catch (error) {
    console.error("Error adding prefix to existing collection:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
    
//Get Prefix 
exports.getPrefix = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    console.log(organizationId);
    

    const prefix = await Prefix.findOne({ organizationId });

    if (!prefix) {
      return res.status(404).json({ message: "Prefix collection not found" });
    }

    res.status(200).json({ prefix });
  } catch (error) {
    console.error("Error fetching prefix:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

//Edit Prefix
exports.updatePrefix = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const { seriesId } = req.body;
    const {
      seriesName, journal, journalNum, creditNote, creditNoteNum,
      customerPayment, customerPaymentNum, purchaseOrder, purchaseOrderNum,
      salesOrder, salesOrderNum, vendorPayment, vendorPaymentNum,
      retainerInvoice, retainerInvoiceNum, vendorCredits, vendorCreditsNum,
      billOfSupply, billOfSupplyNum, debitNote, debitNoteNum,
      invoice, invoiceNum, quote, quoteNum,
      deliveryChallan, deliveryChallanNum, status
    } = req.body;

    // Find the prefix collection by organizationId and the series by seriesId
    const prefix = await Prefix.findOne({ organizationId });

    if (!prefix) {
      return res.status(404).json({ message: "Prefix not found" });
    }

    // Find the series being edited
    const series = prefix.series.id(seriesId);

    if (!series) {
      return res.status(404).json({ message: "Series not found" });
    }

    // Remove the series being edited from the collection and store the rest in a variable
    const otherSeries = prefix.series.filter(ser => ser._id.toString() !== seriesId);

    // List of fields to check for conflicts
    const fieldsToCheck = [
      { key: 'seriesName', value: seriesName, message: "Series name already exists in another series." },
      { key: 'journal', value: journal, message: "Journal Prefix already exists in another series." },
      { key: 'creditNote', value: creditNote, message: "Credit Note Prefix already exists in another series." },
      { key: 'customerPayment', value: customerPayment, message: "Customer Payment Prefix already exists in another series." },
      { key: 'purchaseOrder', value: purchaseOrder, message: "Purchase Order Prefix already exists in another series." },
      { key: 'salesOrder', value: salesOrder, message: "Sales Order Prefix already exists in another series." },
      { key: 'vendorPayment', value: vendorPayment, message: "Vendor Payment Prefix already exists in another series." },
      { key: 'retainerInvoice', value: retainerInvoice, message: "Retainer Invoice Prefix already exists in another series." },
      { key: 'vendorCredits', value: vendorCredits, message: "Vendor Credits Prefix already exists in another series." },
      { key: 'billOfSupply', value: billOfSupply, message: "Bill Of Supply Prefix already exists in another series." },
      { key: 'debitNote', value: debitNote, message: "Debit Note Prefix already exists in another series." },
      { key: 'invoice', value: invoice, message: "Invoice Prefix already exists in another series." },
      { key: 'quote', value: quote, message: "Quote Prefix already exists in another series." },
      { key: 'deliveryChallan', value: deliveryChallan, message: "Delivery Challan Prefix already exists in another series." }
    ];

    // Function to check if a value exists in other series
    const valueExists = (array, key, value) => array.some(item => item[key] === value);

    // Check for conflicts across all relevant fields
    for (const field of fieldsToCheck) {
      if (field.value && valueExists(otherSeries, field.key, field.value)) {
        return res.status(400).json({ message: field.message });
      }
    }

    // Update the series details
    series.seriesName = seriesName || series.seriesName;
    series.journal = journal || series.journal;
    series.journalNum = journalNum || series.journalNum;
    series.creditNote = creditNote || series.creditNote;
    series.creditNoteNum = creditNoteNum || series.creditNoteNum;
    series.customerPayment = customerPayment || series.customerPayment;
    series.customerPaymentNum = customerPaymentNum || series.customerPaymentNum;
    series.purchaseOrder = purchaseOrder || series.purchaseOrder;
    series.purchaseOrderNum = purchaseOrderNum || series.purchaseOrderNum;
    series.salesOrder = salesOrder || series.salesOrder;
    series.salesOrderNum = salesOrderNum || series.salesOrderNum;
    series.vendorPayment = vendorPayment || series.vendorPayment;
    series.vendorPaymentNum = vendorPaymentNum || series.vendorPaymentNum;
    series.retainerInvoice = retainerInvoice || series.retainerInvoice;
    series.retainerInvoiceNum = retainerInvoiceNum || series.retainerInvoiceNum;
    series.vendorCredits = vendorCredits || series.vendorCredits;
    series.vendorCreditsNum = vendorCreditsNum || series.vendorCreditsNum;
    series.billOfSupply = billOfSupply || series.billOfSupply;
    series.billOfSupplyNum = billOfSupplyNum || series.billOfSupplyNum;
    series.debitNote = debitNote || series.debitNote;
    series.debitNoteNum = debitNoteNum || series.debitNoteNum;
    series.invoice = invoice || series.invoice;
    series.invoiceNum = invoiceNum || series.invoiceNum;
    series.quote = quote || series.quote;
    series.quoteNum = quoteNum || series.quoteNum;
    series.deliveryChallan = deliveryChallan || series.deliveryChallan;
    series.deliveryChallanNum = deliveryChallanNum || series.deliveryChallanNum;
    series.status = status !== undefined ? status : series.status;

    // Save the updated prefix collection
    const updatedPrefix = await prefix.save();

    res.status(200).json({ message: "Series updated successfully", updatedPrefix });
  } catch (error) {
    console.error("Error updating series by ID:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};


//Delete One prefix
exports.deletePrefix = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const { seriesId } = req.body;

    // Find the prefix collection by organizationId
    const prefix = await Prefix.findOne({ organizationId: organizationId });

    if (!prefix) {
      return res.status(404).json({ message: "Prefix collection not found" });
    }

    // Check if there is more than one series
    if (prefix.series.length < 2) {
      return res.status(400).json({ message: "Cannot delete the series as only one series remains" });
    }

    
    // Remove the series by its ID
    prefix.series = prefix.series.filter(series => series._id.toString() !== seriesId);

    // Save the updated prefix collection
    const updatedPrefix = await prefix.save();

    res.status(200).json({ message: "Series deleted successfully", updatedPrefix });
  } catch (error) {
    console.error("Error deleting series by ID:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};


//Status True 
exports.setPrefixSeriesStatusTrue = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const { seriesId } = req.body;

    // Find the prefix collection by organizationId
    const prefix = await Prefix.findOne({ organizationId });

    if (!prefix) {
      return res.status(404).json({ message: "Prefix collection not found for the given organization." });
    }

    // Update all series to have status false
    prefix.series.forEach(series => {
      series.status = false;
    });

    // Find the specific series by seriesId and set its status to true
    const series = prefix.series.id(seriesId);
    if (series) {
      series.status = true;
    } else {
      return res.status(404).json({ message: "Series not found" });
    }

    // Save the updated prefix collection
    const updatedPrefix = await prefix.save();

    res.status(200).json({ message: "Series status updated successfully", updatedPrefix });
  } catch (error) {
    console.error("Error updating series status:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};