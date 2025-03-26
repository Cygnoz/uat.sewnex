const Supplier = require("../database/model/supplier");
const Organization = require("../database/model/organization");
const PurchaseOrder = require('../database/model/purchaseOrder');
const Bills = require('../database/model/bills');
const Items = require('../database/model/item');


const moment = require("moment-timezone");

const { singleCustomDateTime, multiCustomDateTime } = require("../services/timeConverter");
const { cleanData } = require("../services/cleanData");

const dataExist = async ( organizationId, supplierId ) => {    
  const [organizationExists ,purchaseOrder, allBills ] = await Promise.all([
    Organization.findOne({ organizationId },{ timeZoneExp: 1, dateFormatExp: 1, dateSplit: 1, organizationCountry: 1 }).lean(),
    PurchaseOrder.find({ organizationId , supplierId: supplierId })
    .populate('items.itemId', 'itemName cgst sgst igst vat purchaseAccountId')    
    .populate('supplierId', 'supplierDisplayName')    
    .lean(),
    Bills.find({ organizationId , supplierId: supplierId })
    .populate('items.itemId', 'itemName itemImage') 
    .populate('supplierId', 'supplierDisplayName')    
    .lean(),  
  ]);
  return { organizationExists, purchaseOrder, allBills };
};




//Main stats
exports.getSupplierStats = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const { date } = req.params;

    const formattedDate = moment(date, "YYYY-MM-DD");
    const givenMonthYear = formattedDate.format("MMMM/YYYY");

    const countSuppliersByStatus = async (status) => {
      const query = { organizationId };
      if (status) query.status = status;
      return await Supplier.countDocuments(query);
    };

    const totalSuppliers = await countSuppliersByStatus();
    const activeSuppliers = await countSuppliersByStatus("Active");

    const recentlyAddedSuppliers = await Supplier.find({
      organizationId,
      createdDate: { $regex: new RegExp(givenMonthYear) },
    }).sort({ _id: -1 });

    res.status(200).json({
      totalSuppliers,
      activeSuppliers,
      newSuppliersCount: recentlyAddedSuppliers.length,
    });
  } catch (error) {
    res.status(500).json({ message: "Internal server error.",error:error.message, stack:error.stack });
  }
};




//Purchase bill
exports.supplierBills = async (req, res) => {
  try {
    const { supplierId } = req.params; 
    const { organizationId } = req.user;


    const { organizationExists, allBills } = await dataExist( organizationId, supplierId );


    if (!organizationExists) {
      return res.status(404).json({ message: "Organization not found" });
    }

    if (!allBills) {
      return res.status(404).json({ message: "No Invoice found" });
    }

    const transformedBill = allBills.map(data => {
      return {
          ...data,
          supplierId: data.supplierId?._id,  
          supplierDisplayName: data.supplierId?.supplierDisplayName,
          items: data.items.map(item => ({
            ...item,
            itemId: item.itemId?._id,
            itemName: item.itemId?.itemName,
          })),  
      };
    });

    const formattedObjects = multiCustomDateTime(transformedBill, organizationExists.dateFormatExp, organizationExists.timeZoneExp, organizationExists.dateSplit );

    res.status(200).json( formattedObjects );    
  } catch (error) {
    console.log(error);    
    res.status(500).json({ message: "Internal server error.",error:error.message, stack:error.stack });
  }
};
