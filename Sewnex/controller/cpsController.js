const CPS = require('../model/cps');
const Organization = require('../../database/model/organization');
const Service = require('../model/service');
const mongoose = require("mongoose");
const { cleanData } = require("../../services/cleanData");
const { singleCustomDateTime, multiCustomDateTime } = require("../../services/timeConverter");


const dataExist = async ( organizationId, cpsId ) => {    
    const [organizationExists, allCPS, cps ] = await Promise.all([
      Organization.findOne({ organizationId }, { organizationId: 1, organizationCountry: 1, state: 1, timeZoneExp: 1, dateFormatExp: 1, dateSplit: 1}),
      CPS.find({ organizationId })
      .populate('categoryId', 'name')
      .lean(),
      CPS.findOne({ organizationId , _id: cpsId })
      .populate('categoryId', 'name')
      .lean()
    ]);
    return { organizationExists, allCPS, cps };
  };



// Add CPS
exports.addCPS = async (req, res) => {
    console.log("Add CPS:", req.body);

    try {
      const { organizationId, id: userId, userName } = req.user;
      const { type } = req.params;

      // Validate Type
      if (!validateType(type, res)) return;

      //Clean Data
      const cleanedData = cleanData(req.body);

      const { name } = cleanedData;

      const { organizationExists } = await dataExist( organizationId );

      //Data Exist Validation
      if (!validateOrganization( organizationExists, res )) return;
      
      //Validate Inputs  
      if (!validateInputs( cleanedData, res)) return;

      const existingEntity = await CPS.findOne({ organizationId, name, type });
      if (existingEntity) {
        return res.status(409).json({ message: `A ${type} name already exists.` });
      }

      // Create a new document with the appropriate fields
      const savedCPS = await createNewCps(cleanedData, organizationId, type, userId, userName );

      res.status(201).json({
        message: `${type.charAt(0).toUpperCase() + type.slice(1)} deleted successfully.`,
        data: savedCPS
      });
      // console.log(`${type} added successfully.`, savedCPS);
    } catch (error) {
        console.error(`Error adding ${req.params.type}:`, error);
        res.status(400).json({ message: "Server error", error: error.message });
    }
};



// Get All CPS
exports.getAllCPS = async (req, res) => {
    console.log("Fetching all CPS:", req.params);

    try {
        const { organizationId } = req.user;
        const { type } = req.params;

        // Validate Type
        if (!validateType(type, res)) return;

        const { organizationExists, allCPS } = await dataExist( organizationId, null );

        //Data Exist Validation
        if (!validateOrganization( organizationExists, res )) return;

        if (!allCPS) {
          return res.status(404).json({ message:`No data found.`});
        }

        // Filter the data by type
        const filteredCPS = allCPS.filter(cps => cps.type === type);        

        if (!filteredCPS) {
            return res.status(404).json({ message: `No ${type} found.` });
        }

        const transformedData = filteredCPS.map(data => ({
            ...data,
            categoryId: data.categoryId ? data.categoryId._id : undefined,
            categoryName: data.categoryId ? data.categoryId.name : undefined
        }));
          
        const formattedObjects = multiCustomDateTime(transformedData, organizationExists.dateFormatExp, organizationExists.timeZoneExp, organizationExists.dateSplit );    
    
        res.status(200).json({ message: `${type.charAt(0).toUpperCase() + type.slice(1)} retrieved successfully.`, formattedObjects });
        // console.log(`${type} retrieved successfully.`, formattedObjects);
    } catch (error) {
        console.error(`Error fetching ${req.params.type}:`, error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};




// Get One CPS
exports.getOneCPS = async (req, res) => {
  console.log("Fetching single CPS:", req.params);

  try {
      const { organizationId } = req.user;
      const { type, cpsId } = req.params;

      // Validate Type
      if (!validateType(type, res)) return;

      // Fetch the CPS entry and organization details
      const { organizationExists, cps } = await dataExist(organizationId, cpsId);

      // Validate if the organization exists
      if (!validateOrganization(organizationExists, res)) return;

      // Validate if CPS exists and matches the requested type
      if (!cps || cps.type !== type) {
          return res.status(404).json({ message: `No ${type} found with the given ID.` });
      }      

      const transformedData = {
            ...cps,
            categoryId: cps.categoryId ? cps.categoryId : undefined,
            categoryName: cps.categoryId ? cps.categoryId.name : undefined
        };

      const formattedObjects = singleCustomDateTime(transformedData, organizationExists.dateFormatExp, organizationExists.timeZoneExp, organizationExists.dateSplit );    

      res.status(200).json({ message: `${type.charAt(0).toUpperCase() + type.slice(1)} retrieved successfully.`, formattedObjects });
      // console.log(`${type} retrieved successfully.`, formattedObjects);
  } catch (error) {
      console.error(`Error fetching ${req.params.type}:`, error);
      res.status(500).json({ message: "Server error", error: error.message });
  }
};



// Edit CPS
exports.editCPS = async (req, res) => {
  console.log("Editing CPS:", req.params, req.body);

  try {
    const { organizationId } = req.user;
    const { type, cpsId } = req.params;

    // Validate CPS ID format
    if (!mongoose.Types.ObjectId.isValid(cpsId)) {
        return res.status(400).json({ message: `Invalid CPS ID: ${cpsId}` });
    }

    // Validate Type
    if (!validateType(type, res)) return;

    // Fetch existing CPS entry
    const existingCPS = await CPS.findOne({ _id: cpsId, organizationId, type });
    if (!existingCPS) {
        console.log("Data not found with ID:", cpsId);
        return res.status(404).json({ message: `No ${type} found with the given ID.` });
    }

    // Clean Data
    const cleanedData = cleanData(req.body);

    // Fetch Organization Details
    const { organizationExists } = await dataExist(organizationId);
    if (!validateOrganization(organizationExists, res)) return;

    // Validate Inputs
    if (!validateInputs(cleanedData, res)) return;

    // Check if another CPS entry with the same name exists (excluding current ID)
    const existingEntity = await CPS.findOne({ organizationId, name: cleanedData.name, type, _id: { $ne: cpsId } });
    if (existingEntity) {
        return res.status(409).json({ message: `A ${type} with this name already exists.` });
    }

    // Prevent updating the `type` field
    if (cleanedData.type && cleanedData.type !== existingCPS.type) {
        return res.status(400).json({ message: "Type cannot be changed." });
    }

    // Update CPS entry with new data
    cleanedData.lastModifiedDate = new Date();

    const updatedCPS = await CPS.findByIdAndUpdate(cpsId, cleanedData, { new: true });

    res.status(200).json({ 
        message: `${type.charAt(0).toUpperCase() + type.slice(1)} updated successfully.`, 
        data: updatedCPS 
    });
    // console.log(`${type} updated successfully.`, updatedCPS);
  } catch (error) {
    console.error(`Error editing ${req.params.type}:`, error);
      res.status(500).json({ message: "Server error", error: error.message });
  }
};




// Delete CPS
exports.deleteCPS = async (req, res) => {
  console.log("Deleting CPS:", req.params);

  try {
      const { organizationId } = req.user;
      const { type, cpsId } = req.params;

      // Validate CPS ID format
      if (!mongoose.Types.ObjectId.isValid(cpsId)) {
          return res.status(400).json({ message: `Invalid CPS ID: ${cpsId}` });
      }

      // Validate Type
      if (!validateType(type, res)) return;

      // Fetch existing CPS entry
      const existingCPS = await CPS.findOne({ _id: cpsId, organizationId, type });
      if (!existingCPS) {
          console.log("Data not found with ID:", cpsId);
          return res.status(404).json({ message: `No ${type} found with the given ID.` });
      }

      // Dependency Checks
      if (type === 'category') {
          const isUsedInService = await Service.exists({ categoryId: cpsId });
          if (isUsedInService) {
              return res.status(400).json({ message: "Cannot delete category as it is used in services." });
          }
      }

      if (type === 'parameter-category') {
          const isUsedInParameter = await CPS.exists({ categoryId: cpsId, type: 'parameter' });
          if (isUsedInParameter) {
              return res.status(400).json({ message: "Cannot delete parameter-category as it is used in parameters." });
          }
      }

      if (type === 'style-category') {
          const isUsedInStyle = await CPS.exists({ categoryId: cpsId, type: 'style' });
          if (isUsedInStyle) {
              return res.status(400).json({ message: "Cannot delete style-category as it is used in styles." });
          }
      }

      // Delete the CPS entry
      await CPS.findByIdAndDelete(cpsId);

      res.status(200).json({ message: `${type.charAt(0).toUpperCase() + type.slice(1)} deleted successfully.`, savedCPS });
      // console.log(`${type} deleted successfully.`);
  } catch (error) {
      console.error(`Error deleting ${req.params.type}:`, error);
      res.status(500).json({ message: "Server error", error: error.message });
  }
};












// Validate Type Function
function validateType(type, res) {
  const validTypes = ['category', 'parameter-category', 'parameter', 'style-category', 'style'];
  
  if (!validTypes.includes(type)) {
      res.status(400).json({ message: "Invalid type provided!" });
      return false;
  }
  return true;
}


// Create New Order
function createNewCps( data, organizationId, type, userId, userName ) {
    const newCPS = new CPS({ ...data, organizationId, type, userId, userName });
    return newCPS.save();
}


// Validate Organization 
function validateOrganization( organizationExists, res ) {
    if (!organizationExists) {
      res.status(404).json({ message: "Organization not found!" });
      return false;
    }
    return true;
}


//Validate inputs
function validateInputs( data, res) {
    const validationErrors = validateCpsData(data );
    if (validationErrors.length > 0) {
      res.status(400).json({ message: validationErrors.join(", ") });
      return false;
    }
    return true;
}

//Validate Data
function validateCpsData( data ) {
    const errors = [];
    //Basic Info
    validateReqFields( data, errors );
    //OtherDetails
    validateFloatFields(['price'], data, errors);
    return errors;
}

// Field validation utility
function validateField(condition, errorMsg, errors) {
    if (condition) errors.push(errorMsg);
}

//Valid Req Fields
function validateReqFields( data, errors ) {
    validateField( typeof data.name === 'undefined', "Please enter the name", errors  );
}

//Valid Float Fields  
function validateFloatFields(fields, data, errors) {
    fields.forEach((balance) => {
      validateField(data[balance] && !isFloat(data[balance]),
        "Invalid " + balance.replace(/([A-Z])/g, " $1") + ": " + data[balance], errors);
    });
}