

// const Organization = require("../database/model/organization");
// const Supplier = require('../database/model/supplier');
//const PurchasePayment = require('../database/model/paymentMade')
// const Customer = require("../database/model/customer");
// const moment = require("moment-timezone");
// const Settings = require("../database/model/settings")
 const mongoose = require('mongoose');

// const dataExist = async (organizationId, unpaidBill , supplierId, supplierName ) => {
//     const [organizationExists, supplierExists, unpaidBill ] = await Promise.all([
//         Organization.findOne({ organizationId }),
//         Supplier.findOne({ organizationId,_id: supplierId , supplierDisplayName:supplierName},{ _id:1 , supplierDisplayName:1}),
//         Promise.all(itemTable.map(item => Item.findOne({ _id: item.itemId }))),
//         unpaidBill.findOne({ organizationId , _id: billId , }, { _id:1, date: 1, dueDate:1 , billAmount:1 , dueAmount :1 , payment : 1 })
//     ]);
//  
//     return { organizationExists, supplierExists, unpaidBill  };
//   };

//  //add purchasePayment
// exports.addPayment = async (req,res)=>{
//     try{

//         const cleanedData = cleanCustomerData(req.body);
//         const { supplierId , supplierName } = cleanedData

            // Validate PaymentId
//   if (!mongoose.Types.ObjectId.isValid(paymentId) || paymentId.length !== 24) {
//     return  res.status(400).json({message: `Invalid payment ID: ${paymentId}`}) 
//   }

//   // Validate SupplierId
//   if (!mongoose.Types.ObjectId.isValid(supplierId) || supplierId.length !== 24) {
//     return  res.status(400).json({message: `Invalid supplier ID: ${supplierId}`}) 
//   }


//     }
// }