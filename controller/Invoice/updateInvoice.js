
const mongoose = require('mongoose');
const SalesInvoice = require('../../database/model/salesInvoice');
const { dataExist, saleInvoice, validation, calculation, accounts } = require("../Invoice/salesInvoice");
const { cleanData } = require("../../services/cleanData");



// Update Sales Invoice 
exports.updateInvoice = async (req, res) => {
    console.log("Update sales invoice:", req.body);
  
    try {
      const { organizationId, id: userId, userName } = req.user;
      const { invoiceId } = req.params;

      // Clean input data
      const cleanedData = cleanData(req.body);

      const { items, customerId, otherExpenseAccountId, freightAccountId, depositAccountId } = cleanedData;

      const itemIds = items.map(item => item.itemId);
  
      // Fetch existing sales order
      const existingSalesInvoice = await SalesInvoice.findOne({ _id: invoiceId, organizationId });
      if (!existingSalesInvoice) {
        console.log("Sales invoice not found with ID:", invoiceId);
        return res.status(404).json({ message: "Sales invoice not found" });
      }
    
      // Validate Customer
      if (!mongoose.Types.ObjectId.isValid(customerId) || customerId.length !== 24) {
        return res.status(400).json({ message: `Invalid Customer ID: ${customerId}` });
      }

      if ((!mongoose.Types.ObjectId.isValid(otherExpenseAccountId) || otherExpenseAccountId.length !== 24) && cleanedData.otherExpenseAmount !== undefined ) {
        return res.status(400).json({ message: `Select other expense account` });
      }
      
      if ((!mongoose.Types.ObjectId.isValid(freightAccountId) || freightAccountId.length !== 24) && cleanedData.freightAmount !== undefined ) {
        return res.status(400).json({ message: `Select freight account` });
      }
      
      if ((!mongoose.Types.ObjectId.isValid(depositAccountId) || depositAccountId.length !== 24) && cleanedData.paidAmount !== undefined ) {
        return res.status(400).json({ message: `Select deposit account` });
      }
  
      // Validate ItemIds
      const invalidItemIds = itemIds.filter(itemId => !mongoose.Types.ObjectId.isValid(itemId) || itemId.length !== 24);
      if (invalidItemIds.length > 0) {
        return res.status(400).json({ message: `Invalid item IDs: ${invalidItemIds.join(', ')}` });
      }
  
      // Check for duplicate itemIds
      const uniqueItemIds = new Set(itemIds);
      if (uniqueItemIds.size !== itemIds.length) {
        return res.status(400).json({ message: "Duplicate Item found in the list." });
      }
  
      // Fetch related data
      const { organizationExists, customerExist, existingPrefix, defaultAccount, customerAccount } = await dataExist.dataExist(organizationId, customerId);

      const { itemTable } = await dataExist.itemDataExists( organizationId, items );
  
     //Data Exist Validation
     if (!validation.validateOrganizationTaxCurrency( organizationExists, customerExist, existingPrefix, defaultAccount, res )) return;
      
      // Validate Inputs
      if (!validation.validateInputs(cleanedData, customerExist, items, itemTable, organizationExists, defaultAccount, res)) return;
  
      // Tax Type 
      calculation.taxType(cleanedData, customerExist, organizationExists);

      //Default Account
      const { defAcc, error } = await accounts.defaultAccounting( cleanedData, defaultAccount, organizationExists );
      if (error) { 
        res.status(400).json({ message: error }); 
        return false; 
      }
  
      // Calculate Sales Order
      if (!calculation.calculateSalesOrder(cleanedData, res)) return;

      //Sales Journal      
      if (!accounts.salesJournal( cleanedData, res )) return; 
  
    //   // Ensure `salesInvoice` field matches the existing order
    //   const salesInvoice = cleanedData.salesInvoice;
    //   if (salesInvoice !== existingSalesOrder.salesInvoice) {
    //     console.error("Mismatched salesInvoice values.");
    //     return res.status(400).json({
    //         message: `The provided salesInvoice does not match the existing record. Expected: ${existingSalesOrder.salesInvoice}`
    //     });
    // }

    //   // Update Sales Order Fields (Ensure system-managed fields are untouched)
    //   existingSalesInvoice.set({
    //     ...cleanedData,
    //     lastModifiedDate: new Date(),
    //   });

    //   // Save Updated Sales Invoice
    //   const updateSalesInvoice = await existingSalesInvoice.save();
    //   if (!updateSalesInvoice) {
    //       console.error("Failed to save updated sales invoice.");
    //       return res.status(500).json({ message: "Failed to update sales invoice" });
    //   }

      // Create a new sales invoice with the same `createdDateTime`
      const newSalesInvoiceData = {
        ...cleanedData,
        createdDateTime: existingSalesInvoice.createdDateTime, // Keep the original createdDateTime
        // lastModifiedDate: new Date(), // Add the current date as the lastModifiedDate
      };
  
      const newSalesInvoice = new SalesInvoice(newSalesInvoiceData);
  
      // Save the new Sales Invoice
      const savedSalesInvoice = await newSalesInvoice.save();
      if (!savedSalesInvoice) {
        console.error("Failed to save new sales invoice.");
        return res.status(500).json({ message: "Failed to save new sales invoice" });
      }

      //Journal
      await accounts.journal( savedSalesInvoice, defAcc, customerAccount );

      //Item Track
    //   await saleInvoice.itemTrack( savedSalesInvoice, itemTable );
  
      res.status(200).json({ message: "Sale invoice updated successfully", savedSalesInvoice });
      console.log("Sale invoice updated successfully:", savedSalesInvoice);
  
    } catch (error) {
      console.error("Error updating sale invoice:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  };