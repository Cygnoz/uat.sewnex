const Organization = require("../database/model/organization");
const Unit = require("../database/model/unit");
const Item = require("../database/model/item");


//1. Add unit
exports.addUnit = async (req, res) => {
    console.log("Add Unit:", req.body);
    const organizationId = req.user.organizationId;
    try {
      const {          
        unitName,
        symbol,
        quantityCode,
        precision
      } = req.body;
  
      // // Check if an unit with the same organizationId already exists
      const existingUnit = await Unit.findOne({
        unitName,
        organizationId,
      });

      if (existingUnit) {
          return res.status(409).json({
              message: "This unit name already exists in the given organization.",
          });
      }
  
      // Create a new unit
      const newUnit = new Unit({
        organizationId,
        unitName,
        symbol,
        quantityCode,
        precision
      //   unitConversion: Array.isArray(unitConversion) ? unitConversion.map((field) => ({
      //     targetUnit: field.targetUnit,
      //     unitConversionRate: field.unitConversionRate,
      // })) : [],
      });
      await newUnit.save();
  
      res.status(201).json({
        message: "New unit created successfully."
      });
      console.log("New unit created successfully:");
    } catch (error) {
      console.error("Error creating unit:", error);
      res.status(500).json({ message: "Internal server error." });
    }
  };


//2. Get all unit
exports.getAllUnit = async (req, res) => {
    try {
      const organizationId = req.user.organizationId;

        // Check if an Organization already exists
        const existingOrganization = await Organization.findOne({ organizationId });
    
        if (!existingOrganization) {
          return res.status(404).json({
            message: "No Organization Found.",
          });
        }

        // Find all unit where organizationId matches
        const allUnit = await Unit.find({ organizationId })
        if (allUnit.length > 0) {
          res.status(200).json(allUnit);
        } else {
          return res.status(404).json({ message: "No unit found " });
        }
    } catch (error) {
        console.error("Error fetching unit:", error);
        res.status(500).json({ message: "Internal server error." });
    }
};


//3. get one unit
exports.getOneUnit = async (req, res) => {
  try {
    const { _id } = req.params;
    const organizationId = req.user.organizationId;

    // Log the ID being fetched
    console.log("Fetching Unit with ID:", _id);

    // Check if an Organization already exists
    const existingOrganization = await Organization.findOne({ organizationId });
 
    if (!existingOrganization) {
      return res.status(404).json({
        message: "No Organization Found.",
      });
    }

    const unit = await Unit.findById(_id);

    if (unit) {
      res.status(200).json(unit);
    } else {
      res.status(404).json({ message: "Unit not found" });
    }
  } catch (error) {
    console.error("Error fetching a unit:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
  

//4. edit unit
exports.updateUnit = async (req, res) => {
  console.log("Received request to update unit:", req.body);

  try {
    const organizationId = req.user.organizationId;
    const { _id } = req.params;
    const {      
      unitName,
      symbol,
      quantityCode,
      precision,
    } = req.body;

    // Log the ID being updated
    console.log("Updating unit with ID:", _id);

    // Find the unit by its ID to get the current unitName
    const currentUnit = await Unit.findById(_id);

    // if (!currentUnit) {
    //   console.log("Unit not found with ID:", _id);
    //   return res.status(404).json({ message: "Unit not found" });
    // }

    // Check if the new unitName already exists in the same organizationId, excluding the current unit being updated
    if (currentUnit.unitName !== unitName) {
      const existingUnit = await Unit.findOne({
        unitName,
        organizationId,
        _id: { $ne: _id } // Exclude the current unit from the check
      });

      if (existingUnit) {
        return res.status(409).json({
          message: "This unit name already exists in the given organization.",
        });
      }
    }

    // Update the unit
    const updatedUnit = await Unit.findByIdAndUpdate(
      _id,
      {
        organizationId,
        unitName,
        symbol,
        quantityCode,
        precision,
      },
      { new: true, runValidators: true }
    );

    if (!updatedUnit) {
      console.log("Unit not found with ID:", _id);
      return res.status(404).json({ message: "Unit not found" });
    }

    res.status(200).json({ message: "Unit updated successfully" });
    console.log("Unit updated successfully:", updatedUnit);
  } catch (error) {
    console.error("Error updating unit:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};



//5. delete Unit
exports.deleteUnit = async (req, res) => {
    try {
      const organizationId = req.user.organizationId;
      const { id } = req.params;
  
      // Check if the unit exists
      const unit = await Unit.findById(id);
  
      if (!unit) {
        return res.status(404).json({
          message: "Unit not found.",
        });
      }

      // Check if there are any items inside the unit
      const itemsInUnit = await Item.find({ 
        unit: unit.unitName, 
        organizationId: organizationId 
      });

      if (itemsInUnit.length > 0) {
        return res.status(400).json({
          message: "Unit cannot be deleted as it contains items.",
        });
      }
  
      // Delete the unit
      await Unit.findByIdAndDelete(id);
  
      res.status(200).json({
        message: "Unit deleted successfully.",
      });
      console.log("Unit deleted successfully:", id);
    } catch (error) {
      console.error("Error deleting Unit:", error);
      res.status(500).json({ message: "Internal server error." });
    }
  };


  

// // // unit conversion

//1.1. add unit conversion
exports.addUnitConversion = async (req, res) => {
  // console.log("Add Unit Conversion:", req.body);
  try {
    const organizationId = req.user.organizationId;
    const {         
      unitName,
      unitConversion
    } = req.body;

    // Find the unit to which the conversion needs to be added
    const unit = await Unit.findOne({ organizationId, unitName });

    // Check if the new target unit already exists in the unitConversion array
    const existingConversion = unit.unitConversion.find(conversion => 
      unitConversion.some(newConversion => newConversion.targetUnit === conversion.targetUnit)
    );

    if (existingConversion) {
      return res.status(409).json({ message: "Target unit already exists for this unit." });
    }

    // Ensure unitConversion is an array and add the new conversion
    if (Array.isArray(unitConversion)) {
      unit.unitConversion = unit.unitConversion.concat(
        unitConversion.map((field) => ({
          targetUnit: field.targetUnit,
          unitConversionRate: field.unitConversionRate,
        }))
      );
    }

    // Save the updated unit
    await unit.save();

    res.status(201).json({unit});
    // console.log("New unit conversion created successfully:", unit);
  } catch (error) {
    // console.error("Error creating unit conversion:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};


//1.2. Get all unit conversion
exports.getAllUnitConversion = async (req, res) => {
  try {
      const organizationId = req.user.organizationId;
      const { unitName } = req.body;

      // Find all unit conversion where organizationId matches
      const allUnit = await Unit.findOne({ organizationId, unitName })
      const allUnitConversion = allUnit.unitConversion
      if (allUnitConversion.length > 0) {
        res.status(200).json(allUnitConversion);
      } else {
        return res.status(404).json({ message: "No unit conversion found for the provided unit name" });
      }
  } catch (error) {
      console.error("Error fetching unit conversion:", error);
      res.status(500).json({ message: "Internal server error." });
  }
};


//1.3. get one unit conversion
exports.getOneUnitConversion = async (req, res) => {
  try {
    const { _id } = req.params;
    const organizationId = req.user.organizationId;

    // Log the ID being fetched
    console.log("Fetching Unit with ID:", _id);

    // Check if an Organization already exists
    const existingOrganization = await Organization.findOne({ organizationId });
 
    if (!existingOrganization) {
      return res.status(404).json({
        message: "No Organization Found.",
      });
    }

    // Find the unit containing the unitConversion with the specified _id
    const unit = await Unit.findOne({ "unitConversion._id": _id });

    if (unit) {
      // Find the specific unitConversion by _id
      const unitConversion = unit.unitConversion.id(_id);

      if (unitConversion) {
        res.status(200).json(unitConversion);
      } else {
        res.status(404).json({ message: "Unit conversion not found" });
      }
    }
  } catch (error) {
    console.error("Error fetching a unit conversion:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};


//1.4. edit unit conversion
exports.updateUnitConversion = async (req, res) => {
  console.log("Received request to update unit conversion:", req.body);

  try {
    const organizationId = req.user.organizationId;

    const {
      _id, // This should be the ID of the unit
      unitName,
      unitConversion: [
        { _id: conversionId, targetUnit, unitConversionRate }
      ]
    } = req.body;

    // Log the unit ID being updated
    console.log("Updating unit conversion within unit ID:", _id);

    // Find the unit by its ID, organizationId, and unitName
    const unit = await Unit.findOne({ _id, organizationId, unitName });

    if (!unit) {
      console.log("Unit not found with ID:", _id);
      return res.status(404).json({ message: "Unit not found" });
    }

    // Check if a unit conversion with the new targetUnit already exists in the same unit
    const existingConversion = unit.unitConversion.find(conversion =>
      conversion.targetUnit === targetUnit && conversion._id.toString() !== conversionId
    );

    if (existingConversion) {
      return res.status(409).json({ message: "This targetUnit already exists in the given unitName." });
    }

    // Find the specific unit conversion by its own ID (not the unit ID)
    const conversionToUpdate = unit.unitConversion.id(conversionId);
    if (conversionToUpdate) {
      conversionToUpdate.targetUnit = targetUnit;
      conversionToUpdate.unitConversionRate = unitConversionRate;

      // Save the updated unit
      await unit.save();

      res.status(200).json({ message: "Unit conversion updated successfully" });
      console.log("Unit conversion updated successfully:", conversionToUpdate);
    } else {
      console.log("Unit conversion not found with ID:", conversionId);
      return res.status(404).json({ message: "Unit conversion not found" });
    }
  } catch (error) {
    console.error("Error updating unit conversion:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};


//1.5. delete Unit conversion
exports.deleteUnitConversion = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const { id } = req.params;

    // Find the unit containing the unitConversion with the specified _id
    const unit = await Unit.findOne({ "unitConversion._id": id,organizationId });

    if (!unit) {
      return res.status(404).json({ message: "Unit not found containing the unit conversion" });
    }

    // Find the specific unitConversion by _id
    const unitConversion = unit.unitConversion.id(id);

    if (!unitConversion) {
      return res.status(404).json({ message: "Unit conversion not found" });
    }

    // Remove the unit conversion from the unit's unitConversion array
    unit.unitConversion.pull(id);

    // Save the updated unit
    await unit.save();

    res.status(200).json({
      message: "Unit Conversion deleted successfully.",
    });
    console.log("Unit Conversion deleted successfully:", id);
  } catch (error) {
    console.error("Error deleting Unit Conversion:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};
