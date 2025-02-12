const MembershipPlan = require('../model/membershipPlan');
const Organization = require('../../database/model/organization');
const Service = require('../model/service');
const mongoose = require("mongoose");
const { cleanData } = require("../../services/cleanData");
const { singleCustomDateTime, multiCustomDateTime } = require("../../services/timeConverter");


const dataExist = async ( organizationId, membershipId ) => {    
    const [organizationExists, allCPS, cps, serviceExists ] = await Promise.all([
      Organization.findOne({ organizationId }, { organizationId: 1, organizationCountry: 1, state: 1, timeZoneExp: 1, dateFormatExp: 1, dateSplit: 1}),
      MembershipPlan.find({ organizationId })
      .populate('serviceId', 'serviceName')
      .lean(),
      MembershipPlan.findOne({ organizationId , _id: membershipId })
      .populate('categoryId', 'name')
      .lean(),
      Service.findOne({ organizationId }, { organizationId: 1, serviceImage: 1, serviceName: 1, grandTotal: 1}),
    ]);
    return { organizationExists, allCPS, cps, serviceExists };
};

  

// Add Membership Plan
exports.addMembershipPlan = async (req, res) => {
    console.log("Add Membership Plan:", req.body);
    try {
        const { organizationId, id: userId, userName } = req.user;
    } catch (errorMessage) {
        
    }
}