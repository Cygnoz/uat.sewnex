const BMCR = require('../database/model/bmcr');
const Organization = require('../database/model/organization');
const Item = require("../database/model/item"); 





exports.addBmcr = async (req, res) => {
    console.log("Add BMCR:", req.body);
    try {
    const organizationId = req.user.organizationId;
    const { type, name, description, uploadImage } = req.body;

    if (!['brand', 'manufacturer', 'category', 'rack'].includes(type)) {
        return res.status(400).json({ message: "Invalid type provided." });
    }

    // Validate if name is provided
    if (!name || name.trim() === "") {
        return res.status(400).json({ message: `The ${type} name is required.` });
    }

        // Check if an Organization exists
        const existingOrganization = await Organization.findOne({ organizationId });

        if (!existingOrganization) {
            return res.status(404).json({
                message: "No Organization Found.",
            });
        }

        let existingEntity;
        let addFields = {};

        // Determine the type and set the appropriate field and query
        switch (type) {
            case 'brand':
                existingEntity = await BMCR.findOne({ organizationId, brandName: name });
                addFields = { brandName: name, description, uploadImage };
                break;
            case 'manufacturer':
                existingEntity = await BMCR.findOne({ organizationId, manufacturerName: name });
                addFields = { manufacturerName: name, description, uploadImage };
                break;
            case 'category':
                existingEntity = await BMCR.findOne({ organizationId, categoriesName: name });
                addFields = { categoriesName: name, description, uploadImage };
                break;
            case 'rack':
                existingEntity = await BMCR.findOne({ organizationId, rackName: name });
                addFields = { rackName: name, description };
                break;
            default:
                return res.status(400).json({ message: "Invalid type provided." });
        }

        // Check if the entity already exists
        if (existingEntity) {
            console.log(`A ${type.charAt(0).toUpperCase() + type.slice(1)} with this name already exists`);
            return res.status(409).json({
                message: `A ${type.charAt(0).toUpperCase() + type.slice(1)} with this name already exists`,
            });
        }

        // Create a new document with the appropriate fields
        const newBmcr = new BMCR({
            organizationId,
            type,
            ...addFields
        });

        // Save the new document
        await newBmcr.save();
        console.log(`${type.charAt(0).toUpperCase() + type.slice(1)} added successfully.`);
        res.status(201).json(`${type.charAt(0).toUpperCase() + type.slice(1)} added successfully.`);
    } catch (error) {
        console.error(`Error adding ${type}:`, error);
        res.status(500).json({ message: "Internal server error.", error : error.message, stack: error.stack });
    }
};



// Get all BMCR
exports.getAllBmcr = async (req, res) => {
    try {
    const organizationId = req.user.organizationId;
    const { type } = req.body;
    

        // Check if the Organization exists
        const existingOrganization = await Organization.findOne({ organizationId });

        if (!existingOrganization) {
            return res.status(404).json({
                message: "No Organization Found.",
            });
        }

        // Fetch all BMCR documents for the given organizationId and type
        const bmcrData = await BMCR.find({ organizationId, type });

        if (!bmcrData || bmcrData.length === 0) {
            return res.status(404).json({
                message: `No data found for the provided organizationId and type: ${type}.`,
            });
        } 
        // Prepare the response object
        let response = bmcrData.map((item) => {
            switch (type) {
                case 'brand':
                    return { brandName: item.brandName, description: item.description, uploadImage: item.uploadImage, id: item._id };
                case 'manufacturer':
                    return { manufacturerName: item.manufacturerName, description: item.description, uploadImage: item.uploadImage, id: item._id };
                case 'category':
                    return { categoriesName: item.categoriesName, description: item.description, uploadImage: item.uploadImage, id: item._id };
                case 'rack':
                    return { rackName: item.rackName, description: item.description, id: item._id };
                default:
                    return null;
            }
        });
        // Filter out null values from the response array
        response = response.filter(item => item !== null);       

        // Send the response back to the client
        res.status(200).json(response);
    } catch (error) {
        console.error("Error fetching BMCR data:", error);
        res.status(500).json({ message: "Internal server error.", error : error.message, stack: error.stack });
    }
};



//Get one bmcr
exports.getABmcr = async (req, res) => {
    try {
    const { id } = req.params; // Get the BMCR document ID from the route parameters
    const organizationId = req.user.organizationId;

        // Check if the Organization exists
        const existingOrganization = await Organization.findOne({ organizationId });

        if (!existingOrganization) {
            return res.status(404).json({
                message: "No Organization Found.",
            });
        }

        // Find the BMCR document by ID and validate the type and organizationId
        const bmcrData = await BMCR.findOne({ 
            _id: id, 
            organizationId,             
        });

        if (!bmcrData) {
            return res.status(404).json({
                message: `No ${type} found with the provided ID in the given organization.`,
            });
        }        

        // Send the response back to the client
        res.status(200).json(bmcrData);

    } catch (error) {
        console.error("Error fetching BMCR data:", error);
        res.status(500).json({ message: "Internal server error.", error : error.message, stack: error.stack });
    }
};



// Update BMCR using findOneAndUpdate
// exports.updateBmcr = async (req, res) => {
//     console.log("Update BMCR:", req.body);
//     const organizationId = req.user.organizationId;


//     try {
//         const { _id, type, name, description } = req.body;

//         // Validate the type
//         const validTypes = ['brand', 'manufacturer', 'category', 'rack'];
//         if (!validTypes.includes(type)) {
//             return res.status(400).json({ message: "Invalid type provided." });
//         }

//         // Check if an Organization exists
//         const existingOrganization = await Organization.findOne({ organizationId });
//         if (!existingOrganization) {
//             return res.status(404).json({ message: "No Organization Found." });
//         }

//         // Set the fields to update based on type
//         let updateFields = {};
//         let existingEntity;

//         switch (type) {
//             case 'brand':
//                 // Check if another brand with the same name exists in the organization
//                 existingEntity = await BMCR.findOne({ organizationId, brandName: name, _id: { $ne: _id } });
//                 if (existingEntity) {
//                     return res.status(409).json({ message: `A brand with the name "${name}" already exists in this organization.` });
//                 }

//                 // Handle special case for updating associated items when brandName changes
//                 const bmcrDocB = await BMCR.findOne({ _id, organizationId });
//                 if (bmcrDocB && bmcrDocB.brandName !== name) {
//                     const oldBrandName = bmcrDocB.brandName;

//                     // Update items with the new rack name
//                     await Item.updateMany(
//                         { brand: oldBrandName, organizationId },
//                         { $set: { brand: name } }
//                     );
//                 }

//                 updateFields = { brandName: name, description };
//                 break;

//             case 'manufacturer':
//                 // Check if another manufacturer with the same name exists in the organization
//                 existingEntity = await BMCR.findOne({ organizationId, manufacturerName: name, _id: { $ne: _id } });
//                 if (existingEntity) {
//                     return res.status(409).json({ message: `A manufacturer with the name "${name}" already exists in this organization.` });
//                 }

//                 // Handle special case for updating associated items when manufacturerName changes
//                 const bmcrDocM = await BMCR.findOne({ _id, organizationId });
//                 if (bmcrDocM && bmcrDocM.manufacturerName !== name) {
//                     const oldManufacturerName = bmcrDocM.manufacturerName;

//                     // Update items with the new rack name
//                     await Item.updateMany(
//                         { manufacturer: oldManufacturerName, organizationId },
//                         { $set: { manufacturer: name } }
//                     );
//                 }

//                 updateFields = { manufacturerName: name, description };
//                 break;

//             case 'category':
//                 // Check if another category with the same name exists in the organization
//                 existingEntity = await BMCR.findOne({ organizationId, categoriesName: name, _id: { $ne: _id } });
//                 if (existingEntity) {
//                     return res.status(409).json({ message: `A category with the name "${name}" already exists in this organization.` });
//                 }

//                 // Handle special case for updating associated items when categoriesName changes
//                 const bmcrDocC = await BMCR.findOne({ _id, organizationId });
//                 if (bmcrDocC && bmcrDocC.categoriesName !== name) {
//                     const oldCategoryName = bmcrDocC.categoriesName;

//                     // Update items with the new rack name
//                     await Item.updateMany(
//                         { categories: oldCategoryName, organizationId },
//                         { $set: { categories: name } }
//                     );
//                 }

//                 updateFields = { categoriesName: name, description };
//                 break;

//             case 'rack':
//                 // Check if another rack with the same name exists in the organization
//                 existingEntity = await BMCR.findOne({ organizationId, rackName: name, _id: { $ne: _id } });
//                 if (existingEntity) {
//                     return res.status(409).json({ message: `A rack with the name "${name}" already exists in this organization.` });
//                 }

//                 // Handle special case for updating associated items when rackName changes
//                 const bmcrDocR = await BMCR.findOne({ _id, organizationId });
//                 if (bmcrDocR && bmcrDocR.rackName !== name) {
//                     const oldRackName = bmcrDocR.rackName;

//                     // Update items with the new rack name
//                     await Item.updateMany(
//                         { rack: oldRackName, organizationId },
//                         { $set: { rack: name } }
//                     );
//                 }

//                 updateFields = { rackName: name, description };
//                 break;

//             default:
//                 return res.status(400).json({ message: "Invalid type provided." });
//         }

//         // Use findOneAndUpdate to update the document directly
//         const updatedBmcr = await BMCR.findOneAndUpdate(
//             { _id, organizationId },
//             { $set: updateFields },
//             { new: true, runValidators: true }
//         );

//         if (!updatedBmcr) {
//             return res.status(404).json({ message: `No ${type} found for the provided organizationId and _id.` });
//         }

//         res.status(200).json({ message: `${type.charAt(0).toUpperCase() + type.slice(1)} updated successfully.` });
//         console.log(`${type.charAt(0).toUpperCase() + type.slice(1)} updated successfully:`, updatedBmcr);

//     } catch (error) {
//         console.error(`Error updating ${type}:`, error);
//         res.status(500).json({ message: "Internal server error." });
//     }
// };



// delete bmcr
// exports.deleteBmcr = async (req, res) => {
//     const organizationId = req.user.organizationId;
//     const { id } = req.params;

    
//     // Check if the Organization exists
//     const existingOrganization = await Organization.findOne({ organizationId });
//     if (!existingOrganization) {
//         return res.status(404).json({ message: "No Organization Found." });
//     }

//     try {
//         // Find the BMCR document by _id
//         const bmcrDoc = await BMCR.findOne({ _id: id });
//         if (!bmcrDoc) {
//             return res.status(404).json({ message: "No data found." });
//         }

//         const type = bmcrDoc.type;
//         console.log(bmcrDoc);
        
//         let relatedItems = [];

//         // Fetch related items based on the type
//         if (type === "rack") {
//             const rackName = bmcrDoc.rackName;
//             if (rackName) {
//                 relatedItems = await Item.find({ rack: rackName, organizationId });
//             }
//         } else if (type === "brand") {
//             const brandName = bmcrDoc.brandName;
//             if (brandName) {
//                 relatedItems = await Item.find({ brand: brandName, organizationId });
//             }
//         } else if (type === "category") {
//             const categoryName = bmcrDoc.categoriesName;
//             if (categoryName) {
//                 relatedItems = await Item.find({ categories: categoryName, organizationId });
//             }
//         } else if (type === "manufacturer") {
//             const manufacturerName = bmcrDoc.manufacturerName;
//             if (manufacturerName) {
//                 relatedItems = await Item.find({ manufacturer: manufacturerName, organizationId });
//             }
//         }

//         // If there are related items, don't allow deletion
//         if (relatedItems.length > 0) {
//             return res.status(400).json({
//                 message: `Cannot delete ${type}, as related items exist.`,
//             });
//         }

//         // Delete the BMCR document
//         await BMCR.deleteOne({ _id: id });

//         res.status(200).json({ message: `${type.charAt(0).toUpperCase() + type.slice(1)} deleted successfully.` });
//         console.log(`${type.charAt(0).toUpperCase() + type.slice(1)} deleted successfully:`, id);
//     } catch (error) {
//         console.error(`Error deleting ${type}:`, error);
//         res.status(500).json({ message: "Internal server error." });
//     }
// };



//New Edit BMCR
exports.updateBmcr = async (req, res) => {
    console.log("Update BMCR:", req.body);
    try {
    const organizationId = req.user.organizationId;
    const { _id, type, name, description, uploadImage } = req.body;

        const validTypes = {
            brand: "brandName",
            manufacturer: "manufacturerName",
            category: "categoriesName",
            rack: "rackName"
        };

        if (!validTypes[type]) {
            return res.status(400).json({ message: "Invalid type provided." });
        }

        const existingOrganization = await Organization.findOne({ organizationId });
        if (!existingOrganization) {
            return res.status(404).json({ message: "No Organization Found." });
        }

        const fieldKey = validTypes[type];
        const existingEntity = await BMCR.findOne({ organizationId, [fieldKey]: name, _id: { $ne: _id } });
        if (existingEntity) {
            return res.status(409).json({ message: `A ${type} with the name "${name}" already exists in this organization.` });
        }

        const bmcrDoc = await BMCR.findOne({ _id, organizationId });
        if (bmcrDoc && bmcrDoc[fieldKey] !== name) {
            await Item.updateMany(
                { [type]: bmcrDoc[fieldKey], organizationId },
                { $set: { [type]: name } }
            );
        }

        const updatedBmcr = await BMCR.findOneAndUpdate(
            { _id, organizationId },
            { $set: { [fieldKey]: name, description, uploadImage } },
            { new: true, runValidators: true }
        );

        if (!updatedBmcr) {
            return res.status(404).json({ message: `No ${type} found for the provided organizationId and _id.` });
        }

        console.log(`${type.charAt(0).toUpperCase() + type.slice(1)} updated successfully:`, updatedBmcr);
        res.status(200).json({ message: `${type.charAt(0).toUpperCase() + type.slice(1)} updated successfully.` });
    } catch (error) {
        console.error(`Error updating ${type}:`, error);
        res.status(500).json({ message: "Internal server error.", error : error.message, stack: error.stack });
    }
};



//New Delete BMCR
exports.deleteBmcr = async (req, res) => {
    try {
        const organizationId = req.user.organizationId;
        const { id } = req.params;

        // Check if the Organization exists
        const existingOrganization = await Organization.findOne({ organizationId });
        if (!existingOrganization) {
            return res.status(404).json({ message: "No Organization Found." });
        }

        // Find the BMCR document by _id
        const bmcrDoc = await BMCR.findOne({ _id: id });
        if (!bmcrDoc) {
            return res.status(404).json({ message: "No data found." });
        }

        const type = bmcrDoc.type;

        // Define field mapping for related items
        const typeFieldMap = {
            rack: "rackName",
            brand: "brandName",
            category: "categoriesName",
            manufacturer: "manufacturerName"
        };

        const fieldKey = typeFieldMap[type];
        if (fieldKey && bmcrDoc[fieldKey]) {
            const relatedItems = await Item.find({ [type]: bmcrDoc[fieldKey], organizationId });
            if (relatedItems.length > 0) {
                return res.status(400).json({ message: `Cannot delete ${type}, as related items exist.` });
            }
        }

        // Delete the BMCR document
        await BMCR.deleteOne({ _id: id });

        res.status(200).json({ message: `${type.charAt(0).toUpperCase() + type.slice(1)} deleted successfully.` });
        console.log(`${type.charAt(0).toUpperCase() + type.slice(1)} deleted successfully:`, id);
    } catch (error) {
        console.error(`Error deleting BMCR:`, error);
        res.status(500).json({ message: "Internal server error.", error : error.message, stack: error.stack });
    }
};






