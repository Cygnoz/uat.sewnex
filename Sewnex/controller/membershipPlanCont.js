const MembershipPlan = require('../model/membershipPlan');
const Organization = require('../../database/model/organization');
const Service = require('../model/service');
const mongoose = require("mongoose");
const { cleanData } = require("../../services/cleanData");
const { singleCustomDateTime, multiCustomDateTime } = require("../../services/timeConverter");


const dataExist = async ( organizationId, membershipId ) => {    
  const [organizationExists, allMembershipPlan, membershipPlan, serviceExist ] = await Promise.all([
    Organization.findOne({ organizationId }, { organizationId: 1, organizationCountry: 1, state: 1, timeZoneExp: 1, dateFormatExp: 1, dateSplit: 1}).lean(),
    MembershipPlan.find({ organizationId })
    .populate('serviceId', 'serviceName')
    .lean(),
    MembershipPlan.findOne({ organizationId , _id: membershipId })
    .populate('serviceId', 'serviceName')
    .lean(),
    Service.findOne({ organizationId }, { organizationId: 1, serviceImage: 1, serviceName: 1, grandTotal: 1}).lean(),
  ]);
  return { organizationExists, allMembershipPlan, membershipPlan, serviceExist };
};

  

// Add Membership Plan
exports.addMembershipPlan = async (req, res) => {
  console.log("Add Membership Plan:", req.body);
  try {
    const { organizationId, id: userId, userName } = req.user;

    //Clean Data
    const cleanedData = cleanData(req.body);
    cleanedData.services = cleanedData.services?.map(data => cleanData(data)) || [];

    cleanedData.services = cleanedData.services
      ?.map(data => cleanData(data))
      .filter(service => service.serviceId !== undefined && service.serviceId !== '') || []; 

      const { services } = cleanedData; 

      const serviceIds = services.map(service => service.serviceId); 

      // Check for duplicate serviceIds
      const uniqueServiceIds = new Set(serviceIds);
      if (uniqueServiceIds.size !== serviceIds.length) {
        return res.status(400).json({ message: "Duplicate service found!" });
      }

      if ( typeof serviceIds[0] === 'undefined' ) {
        return res.status(400).json({ message: "Select an Service" });
      }

      // Validate ServiceIds
      const invalidServiceIds = serviceIds.filter(serviceId => !mongoose.Types.ObjectId.isValid(serviceId) || serviceId.length !== 24);
        if (invalidServiceIds.length > 0) {
          return res.status(400).json({ message: `Invalid Service IDs: ${invalidServiceIds.join(', ')}` });
      } 

      const { organizationExists, serviceExist } = await dataExist( organizationId );

      //Data Exist Validation
      if (!validateOrganizationService( organizationExists, serviceExist, res )) return;
      
      //Validate Inputs  
      if (!validateInputs( cleanedData, serviceExist, services, res)) return;

      // Calculate Membership Plan 
      if (!calculateMembershipPlan( cleanedData, res )) return;

      const savedMembershipPlan = await createNewMembershipPlan(cleanedData, organizationId, userId, userName );

      res.status(201).json({ message: "Membership plan created successfully", data: savedMembershipPlan });
      console.log( "Membership plan created successfully:", savedMembershipPlan );
  } catch (errorMessage) {
    console.error("Error Creating Membership Plan:", error);
    res.status(500).json({ message: "Internal server error." });
  }
}




// Get All Membership Plan
exports.getAllMembershipPlan = async (req, res) => {
    try {
      const organizationId = req.user.organizationId;
  
      const { organizationExists, allMembershipPlan } = await dataExist( organizationId, null );
  
      if (!organizationExists) {
        return res.status(404).json({ message: "Organization not found" });
      }
  
      if (!allMembershipPlan) {
        return res.status(404).json({ message: "No Membership found" });
      }      
      
      const transformedMembership = allMembershipPlan.map(data => {
        return {
            ...data,
            services: data.services.map(service => ({
              ...service,
              serviceId: service.serviceId._id,  
              serviceName: service.serviceId.serviceName,
            })),  
        };}); 
    
     const formattedObjects = multiCustomDateTime(transformedMembership, organizationExists.dateFormatExp, organizationExists.timeZoneExp, organizationExists.dateSplit );    
  
      res.status(200).json( formattedObjects );
    } catch (error) {
      console.error("Error fetching Membership Plan:", error);
      res.status(500).json({ message: "Internal server error." });
    }
  };


// Get One Membership Plan
exports.getOneMembershipPlan = async (req, res) => {
    try {
      const organizationId = req.user.organizationId;
      const { membershipId } = req.params;
    
      const { organizationExists, membershipPlan } = await dataExist( organizationId, membershipId );
    
      if (!organizationExists) {
        return res.status(404).json({
          message: "Organization not found",
        });
      }
    
      if (!membershipPlan) {
        return res.status(404).json({
          message: "No Membership found",
        });
      }
      const transformedMembership = {
            ...membershipPlan,
            services: membershipPlan.services.map(service => ({
                ...service,
                serviceId: service.serviceId._id,  
                serviceName: service.serviceId.serviceName,
            })),  
        };
      
      const formattedObjects = singleCustomDateTime(transformedMembership, organizationExists.dateFormatExp, organizationExists.timeZoneExp, organizationExists.dateSplit );    
    
    
      res.status(200).json(formattedObjects);
    } catch (error) {
      console.error("Error fetching Membership Plan:", error);
      res.status(500).json({ message: "Internal server error." });
    }
};



// Edit Membership Plan
exports.editMembershipPlan = async (req, res) => {
    console.log("Editing Membership Plan:", req.params, req.body);
  
    try {
      const { organizationId } = req.user;
      const { membershipId } = req.params;
  
      // Validate Membership ID format
      if (!mongoose.Types.ObjectId.isValid(membershipId)) {
          return res.status(400).json({ message: `Invalid Membership ID: ${membershipId}` });
      }
  
      // Fetch existing membership entry
      const existingMembership = await MembershipPlan.findOne({ _id: membershipId, organizationId });
      if (!existingMembership) {
          console.log("Membership not found with ID:", membershipId);
          return res.status(404).json({ message: `No membership found with the given ID.` });
      }
  
      // Clean Data
      const cleanedData = cleanData(req.body);
      cleanedData.services = cleanedData.services?.map(data => cleanData(data)) || [];

      cleanedData.services = cleanedData.services
      ?.map(data => cleanData(data))
      .filter(service => service.serviceId !== undefined && service.serviceId !== '') || []; 

      const { services } = cleanedData; 

      const serviceIds = services.map(service => service.serviceId); 

      // Check for duplicate serviceIds
      const uniqueServiceIds = new Set(serviceIds);
      if (uniqueServiceIds.size !== serviceIds.length) {
        return res.status(400).json({ message: "Duplicate service found!" });
      }

      if ( typeof serviceIds[0] === 'undefined' ) {
        return res.status(400).json({ message: "Select an Service" });
      }
  
      // Validate ServiceIds
      const invalidServiceIds = serviceIds.filter(serviceId => !mongoose.Types.ObjectId.isValid(serviceId) || serviceId.length !== 24);
        if (invalidServiceIds.length > 0) {
          return res.status(400).json({ message: `Invalid Service IDs: ${invalidServiceIds.join(', ')}` });
      } 

      const { organizationExists, serviceExist } = await dataExist( organizationId );

      //Data Exist Validation
      if (!validateOrganizationService( organizationExists, serviceExist, res )) return;
      
      //Validate Inputs  
      if (!validateInputs( cleanedData, serviceExist, services, res)) return;

      // Calculate Membership Plan 
      if (!calculateMembershipPlan( cleanedData, res )) return;
  
      // Check if another Membership Plan entry with the same name exists (excluding current ID)
      const existingEntity = await MembershipPlan.findOne({ organizationId, name: cleanedData.planName, _id: { $ne: membershipId } });
      if (existingEntity) {
          return res.status(409).json({ message: `Membership with this name already exists.` });
      }
  
      // Update CPS entry with new data
      cleanedData.lastModifiedDate = new Date();
  
      const updatedMembershipPlan = await MembershipPlan.findByIdAndUpdate(membershipId, cleanedData, { new: true });
  
      res.status(200).json({ message: "Membership plan updated successfully.", updatedMembershipPlan });
      // console.log("Membership plan updated successfully.", updatedMembershipPlan);
    } catch (error) {
      console.error("Error editing membership plan:", error);
        res.status(500).json({ error: error.message });
    }
  };



// Delete Membership Plan
exports.deleteMembershipPlan = async (req, res) => {
    console.log("Delete membership plan request received:", req.params);
  
    try {
        const { organizationId } = req.user;
        const { membershipId } = req.params;
  
        // Validate membershipId
        if (!mongoose.Types.ObjectId.isValid(membershipId) || membershipId.length !== 24) {
            return res.status(400).json({ message: `Invalid Membership ID: ${membershipId}` });
        }
  
        // Fetch existing membership entry
        const existingMembership = await MembershipPlan.findOne({ _id: membershipId, organizationId });
        if (!existingMembership) {
            console.log("Membership not found with ID:", membershipId);
            return res.status(404).json({ message: `No membership found with the given ID.` });
        }
  
        // Delete the membership plan
        const deletedMembership = await existingMembership.deleteOne();
        if (!deletedMembership) {
            console.error("Failed to delete membership plan.");
            return res.status(500).json({ message: "Failed to delete membership plan" });
        }
  
        res.status(200).json({ message: "Membership plan deleted successfully" });
        console.log("Membership plan deleted successfully with ID:", membershipId);
  
    } catch (error) {
        console.error("Error deleting membership plan:", error);
        res.status(500).json({ message: "Internal server error" });
    }
  };
















// Create New Membership Plan
function createNewMembershipPlan( data, organizationId, userId, userName ) {
    const newMembershipPlan = new MembershipPlan({ ...data, organizationId, userId, userName });
    return newMembershipPlan.save();
}





// Validate Organization and Service
function validateOrganizationService( organizationExists, serviceExist, res ) {
    if (!organizationExists) {
      res.status(404).json({ message: "Organization not found" });
      return false;
    }
    if (!serviceExist) {
      res.status(404).json({ message: "Service not found" });
      return false;
    }
    return true;
}




function calculateMembershipPlan(cleanedData, res) {
  const errors = [];
  let actualRate = 0;
  let sellingRate = 0;
//   let calculatedDiscountAmount = 0;

  // Utility function to round values to two decimal places
  const roundToTwoDecimals = (value) => Number(value.toFixed(2));

  cleanedData.services.forEach(service => {

    let calculatedTotal = 0;

    calculatedTotal = service.price * service.count;

    // Update total values
    actualRate += parseFloat(calculatedTotal);

    checkAmount(calculatedTotal, service.total, service.serviceId, 'Service Total',errors);

    console.log(`${service.serviceId} Service Total: ${calculatedTotal} , Provided ${service.total}`);
  });

  console.log(`Actual Rate, Calculated: ${actualRate} , Provided ${cleanedData.actualRate}`);
  console.log("Discount:",cleanedData.discount);

  // Calculate discount 
  const discountAmount = calculateDiscount(cleanedData, actualRate);
  console.log(`Discount Amount, Calculated: ${discountAmount} , Provided ${cleanedData.discountAmount}`);

  // Round the totals for comparison
  const roundedActualRate = roundToTwoDecimals(actualRate);
  const roundedDiscountAmount = roundToTwoDecimals(discountAmount);

  // Selling rate calculation
  sellingRate = (actualRate - discountAmount) || 0;

  // Round the totals for comparison
  const roundedSellingRate = roundToTwoDecimals(sellingRate);

  console.log(`Final Actual Rate: ${roundedActualRate} , Provided ${cleanedData.actualRate}` );
  console.log(`Final Discount Amount: ${roundedDiscountAmount} , Provided ${cleanedData.discountAmount}` );
  console.log(`Final Selling Rate: ${roundedSellingRate} , Provided ${cleanedData.sellingRate}` );

  validateAmount(roundedActualRate, cleanedData.actualRate, 'Actual Rate',errors);
  validateAmount(roundedDiscountAmount, cleanedData.discountAmount, 'Discount Amount',errors);
  validateAmount(roundedSellingRate, cleanedData.sellingRate, 'Selling Rate',errors);

  if (errors.length > 0) {
    res.status(400).json({ message: errors.join(", ") });
    return false;
  }

  return true;
}


// Calculate discount
function calculateDiscount( cleanedData, actualRate ) {
    return cleanedData.planType === 'Currency'
      ? cleanedData.discount || 0
      : (actualRate * (cleanedData.discount || 0)) / 100;
  }


  //Mismatch Check
function checkAmount(calculatedTotal, providedAmount, serviceId, errors) {
    const roundToTwoDecimals = (value) => Number(value.toFixed(2)); // Round to two decimal places
    const roundedAmount = roundToTwoDecimals(calculatedTotal);
    console.log(`Service ID: ${serviceId}, Calculated ${calculatedTotal}: ${roundedAmount}, Provided data: ${providedAmount}`);
  
    
    if (Math.abs(roundedAmount - providedAmount) > 0.01) {
      const errorMessage = `Mismatch in total for service id ${serviceId}: Calculated ${calculatedTotal}, Provided ${providedAmount}`;
      errors.push(errorMessage);
      console.log(errorMessage);
    }
  }


  //Final Item Amount check
const validateAmount = (calculatedValue, cleanedValue, label, errors) => {
    const isCorrect = calculatedValue === parseFloat(cleanedValue);
    if (!isCorrect) {
      const errorMessage = `${label} is incorrect: ${cleanedValue}`;
      errors.push(errorMessage);
      console.log(errorMessage);
    }
  };












//Validate inputs
function validateInputs( cleanedData, serviceExist, services, res) {
    const validationErrors = validateMembershipData( cleanedData, serviceExist, services );
    if (validationErrors.length > 0) {
      res.status(400).json({ message: validationErrors.join(", ") });
      return false;
    }
    return true;
}

//Validate Data
function validateMembershipData( data, serviceExist, services ) {
    const errors = [];
    //Basic Info
    validateReqFields( data, errors );
    validateService(serviceExist, services, errors);
    validatePlanType(data.planType, errors);
    //OtherDetails
    validateFloatFields(['discount', 'actualRate', 'sellingRate'], data, errors);
    return errors;
}

// Field validation utility
function validateField(condition, errorMsg, errors) {
    if (condition) errors.push(errorMsg);
}

//Valid Req Fields
function validateReqFields( data, errors ) {
    validateField( typeof data.planName === 'undefined', "Please enter the plan name", errors  );
}

// Function to Validate Services 
function validateService(serviceExist, services, errors) {
    
    // Iterate through each service to validate individual fields 
    services.forEach((service) => {
      const fetchedService = serviceExist.find(i => i._id.toString() === service.serviceId.toString());  
    
      // Check if service exists in the serviceExist
      validateField( !fetchedService, `Service with ID ${service.serviceId} was not found.`, errors );
      if (!fetchedService) return; 
    
      // Validate service price
      validateField( service.price !== fetchedService.grandTotal, `Service price Mismatch for ${service.serviceId}:  ${service.price}`, errors );
    
      // Validate plan type
      validatePlanType(service.planType, errors);
    
      // Validate integer fields
      validateIntegerFields(['count'], service, errors);

      // Validate float fields
      validateFloatFields(['discount', 'actualRate', 'sellingRate'], service, errors);
    });
}

//Validate Discount Plan Type
function validatePlanType(planType, errors) {
    validateField(planType && !validPlanType.includes(planType),
      "Invalid Plan Type: " + planType, errors);
}

// Validate Integer Fields
function validateIntegerFields(fields, data, errors) {
    fields.forEach(field => {
      validateField(data[field] && !isInteger(data[field]), `Invalid ${field}: ${data[field]}`, errors);
    });
}
//Valid Float Fields  
function validateFloatFields(fields, data, errors) {
    fields.forEach((balance) => {
      validateField(data[balance] && !isFloat(data[balance]),
        "Invalid " + balance.replace(/([A-Z])/g, " $1") + ": " + data[balance], errors);
    });
}



// Utility Functions
const validPlanType = ["Currency", "Percentage"];