
const Organization = require("../../database/model/organization")
const Prefix = require('../../database/model/prefix')

const { cleanData } = require("../../services/cleanData");



// Utility function to check if a value exists in an array
const valueExists = (array, key, value) => array.some(item => item[key] === value);

// Utility function to handle errors
const handleError = (res, error, message = "Internal server error") => {
  console.error(message, error);
  res.status(500).json({ message });
};



// List of fields to check for conflicts
const fieldsToCheck = [
  { key: 'seriesName', message: "Series name already exists in another series." },
  { key: 'journal', message: "Journal Prefix already exists in another series." },
  { key: 'creditNote', message: "Credit Note Prefix already exists in another series." },
  { key: 'receipt', message: "Receipt Prefix already exists in another series." },
  { key: 'purchaseOrder', message: "Purchase Order Prefix already exists in another series." },
  { key: 'salesOrder', message: "Sales Order Prefix already exists in another series." },
  { key: 'payment', message: "Payment Prefix already exists in another series." },
  { key: 'bill', message: "Bill Prefix already exists in another series." },
  { key: 'debitNote', message: "Debit Note Prefix already exists in another series." },
  { key: 'invoice', message: "Invoice Prefix already exists in another series." },
  { key: 'quote', message: "Quote Prefix already exists in another series." },
  { key: 'deliveryChallan', message: "Delivery Challan Prefix already exists in another series." },
  { key: 'expense', message: "Expense Prefix already exists in another series." },
];



//Add Prefix 
exports.addPrefix = async (req, res) => {
  console.log("Add Prefix:", req.body);
  try {
    const organizationId = req.user.organizationId;
    const cleanedData = cleanData(req.body);
    const newSeries = { ...cleanedData, status: false };
    

    // Find the existing prefix collection by organizationId
    const prefix = await Prefix.findOne({ organizationId });

    if (!prefix) {
      return res.status(404).json({ message: "Prefix collection not found for the given organization." });
    }

        
    // Loop through each field and check if it exists
    for (const field of fieldsToCheck) {
      if (valueExists(prefix.series, field.key, cleanedData[field.key])) {
        return res.status(400).json({ message: field.message });
      }
    }
     
    // Add the new series to the series array
    prefix.series.push(newSeries);
    const updatedPrefix = await prefix.save();
    res.status(201).json({ message: "Prefix added successfully", updatedPrefix });
  } catch (error) {
    console.log("Error adding prefix to existing collection:", error);
    res.status(500).json({ message: "Internal server error.", error : error.message, stack: error.stack });
  }
};
    
//Get Prefix 
exports.getPrefix = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;    
    const prefix = await Prefix.findOne({ organizationId },{organizationId:0});
    if (!prefix) return res.status(404).json({ message: "Prefix collection not found" });
    

    res.status(200).json({ prefix });
  } catch (error) {
    console.log("Error fetching prefix:", error);
    res.status(500).json({ message: "Internal server error.", error : error.message, stack: error.stack });
  }
};

//Edit Prefix
exports.updatePrefix = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const { seriesId, ...updateData } = cleanData(req.body);
    
    // Find the prefix collection by organizationId and the series by seriesId
    const prefix = await Prefix.findOne({ organizationId });
    if (!prefix) return res.status(404).json({ message: "Prefix not found" });
    

    // Find the series being edited
    const series = prefix.series.id(seriesId);
    if (!series) return res.status(404).json({ message: "Series not found" });
    

    const otherSeries = prefix.series.filter(ser => ser._id.toString() !== seriesId);
    for (const field of fieldsToCheck) {
      if (updateData[field.key] && valueExists(otherSeries, field.key, updateData[field.key])) {
        return res.status(400).json({ message: field.message });
      }
    }

    

    // Save the updated prefix collection
    Object.assign(series, updateData);
    const updatedPrefix = await prefix.save();
    res.status(200).json({ message: "Series updated successfully", updatedPrefix });
  } catch (error) {
    console.log("Error updating series by ID:", error);
    res.status(500).json({ message: "Internal server error.", error : error.message, stack: error.stack });
  }
};


//Delete One prefix
exports.deletePrefix = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const { seriesId } = req.params;

    // Find the prefix collection by organizationId
    const prefix = await Prefix.findOne({ organizationId: organizationId });

    if (!prefix) {
      return res.status(404).json({ message: "Prefix collection not found" });
    }

    // Check if there is more than one series
    if (prefix.series.length < 2) {
      return res.status(400).json({ message: "Cannot delete the series as only one series remains" });
    }

    // Find the series by seriesId to check its status
    const seriesToDelete = prefix.series.find(series => series._id.toString() === seriesId);

    // If series not found or its status is 'true', reject the deletion
    if (!seriesToDelete) {
      return res.status(404).json({ message: "Series not found" });
    }
    if (seriesToDelete.status === 'true') {
      return res.status(400).json({ message: "Cannot delete the series with status 'true'" });
    }

    
    // Remove the series by its ID
    prefix.series = prefix.series.filter(series => series._id.toString() !== seriesId);

    // Save the updated prefix collection
    const updatedPrefix = await prefix.save();

    res.status(200).json({ message: "Series deleted successfully", updatedPrefix });
  } catch (error) {
    console.log("Error deleting series by ID:", error);
    res.status(500).json({ message: "Internal server error.", error : error.message, stack: error.stack });
  }
};


//Status True 
exports.setPrefixSeriesStatusTrue = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const { seriesId } = req.body;

    const prefix = await Prefix.findOne({ organizationId });
    if (!prefix) return res.status(404).json({ message: "Prefix collection not found for the given organization." });
    

    prefix.series.forEach(series => { series.status = false; });

    const series = prefix.series.id(seriesId);
    if (!series) return res.status(404).json({ message: "Series not found" });

    series.status = true;

    const updatedPrefix = await prefix.save();

    res.status(200).json({ message: "Series status updated successfully", updatedPrefix });
  } catch (error) {
    console.log("Error updating series status:", error);
    res.status(500).json({ message: "Internal server error.", error : error.message, stack: error.stack });
  }
};







