const CreditNote = require('../database/model/creditNote');
const Organization = require('../database/model/organization');
const Invoice = require('../database/model/salesInvoice');
const Customer = require('../database/model/customer');
const Item = require('../database/model/item');
const Settings = require("../database/model/settings");
const ItemTrack = require("../database/model/itemTrack");
const Tax = require('../database/model/tax');  
const Prefix = require("../database/model/prefix");
const mongoose = require('mongoose');
const moment = require("moment-timezone");


// Fetch existing data
const dataExist = async ( organizationId, customerId, invoiceId ) => {
    const [organizationExists, customerExist, invoiceExist, settings, existingPrefix  ] = await Promise.all([
      Organization.findOne({ organizationId }, { organizationId: 1, organizationCountry: 1, state: 1 }),
      Customer.findOne({ organizationId , _id:customerId}, { _id: 1, customerDisplayName: 1, taxType: 1 }),
      Invoice.findOne({ organizationId, _id:invoiceId }, { _id: 1, salesInvoice: 1, salesInvoiceDate: 1, orderNumber: 1, supplierId: 1, sourceOfSupply: 1, destinationOfSupply: 1, itemTable: 1 }),
      Settings.findOne({ organizationId }),
      Prefix.findOne({ organizationId })
    ]);    
  return { organizationExists, supplierExist, billExist, settings, existingPrefix };
};