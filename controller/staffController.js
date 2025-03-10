const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const Staff = require('../database/model/staff');
const Users = require('../database/model/user');
const Role = require('../database/model/role');
const Organization = require('../database/model/organization');
const { cleanData } = require('../services/cleanData');
const mongoose = require('mongoose');
const Service = require('../Sewnex/model/service');

const { singleCustomDateTime, multiCustomDateTime } = require("../services/timeConverter");


const key = Buffer.from(process.env.ENCRYPTION_KEY, 'utf8'); 
const iv = Buffer.from(process.env.ENCRYPTION_IV, 'utf8'); 

const dataExist = async ( organizationId, email, staffId ) => {
    const [ organizationExists, existingUser, allRole, allStaff, staff, allService ] = await Promise.all([
      Organization.findOne({ organizationId }, { organizationId: 1, organizationCountry: 1, state: 1, timeZoneExp: 1 }),
      Users.findOne({ organizationId, userEmail: email }, { organizationId: 1, userEmail: 1 }),
      Role.find({ organizationId }, { roleName: 1 }),
      Staff.find({ organizationId })
      .populate('service.serviceId', 'serviceName')
      .lean(),
      Staff.findOne({ _id: staffId, organizationId })
      .populate('service.serviceId', 'serviceName')
      .lean(),
      Service.find({ organizationId },{ serviceName: 1 })
      .lean(),
    ]);
    return { organizationExists, existingUser, allRole ,allStaff, staff, allService };
};




// Add Staff
exports.addStaff = async (req, res) => {
    console.log("Add Staff :", req.body);
    try {
        const cleanedData = cleanData(req.body);

        const { organizationId } = req.user;

        const { email, password } = cleanedData;

        const { organizationExists, existingUser, allRole, allService } = await dataExist( organizationId, email, null );   
        
        if (!validateDataExist( organizationExists, res )) return;
        
        if (existingUser) return res.status(409).json({ message: 'User with this email already exists.' });

        cleanedData.department = "Manufacture";
      
        if (!validateInputs( cleanedData, organizationExists, allRole, allService, res)) return;

        if(cleanedData.password){ cleanedData.password = encrypt(cleanedData.password); }       
        
        const staff = await Staff.create({ ...cleanedData, organizationId });
        
        if (!staff) return res.status(500).json({ message: 'Error adding staff' });

        if(cleanedData.enablePortal === true){

          const hashedPassword = await bcrypt.hash(password, 10);
        
          const user = await Users.create({
            organizationId,
            userName: cleanedData.staffName,
            userNum: cleanedData.contactNumber,
            userEmail: cleanedData.email,
            password: hashedPassword,
            role: cleanedData.department,
          });

          if (!user) return res.status(500).json({ message: 'Error adding user' });
        }
        console.log( "Staff Added Successfully",staff);        
        res.status(201).json({ message: 'Staff added successfully', staff });
    } catch (error) {
        console.error("Error in addStaff:", error);
        res.status(500).json({ message: 'Error adding staff', error: error.message });
    }
};

// Edit Staff
exports.editStaff = async (req, res) => {
  console.log("Edit Staff:", req.body);
    try {
        const { staffId } = req.params;

        const { organizationId } = req.user;

        const cleanedData = cleanData(req.body);
        const { email, password } = cleanedData;

        const { organizationExists, existingUser, allRole, allService, staff } = await dataExist( organizationId, email, staffId );  
        
        if (!validateDataExist( organizationExists, res )) return;

        if (!staff) return res.status(409).json({ message: 'Staff not found' });

        if (!validateInputs( cleanedData, organizationExists, allRole, allService, res)) return;

        // Check if email exists in Users collection (excluding the current user)
        const emailExists = await Users.findOne({
          userEmail: email,
          _id: { $ne: existingUser?._id }, 
        });
      
        if (emailExists) {
          return res.status(400).json({ message: "Email already in use by another user" });
        }

        //Password Encryption
        if(staff.enablePortal === true && cleanedData.enablePortal === true){
          
          cleanedData.password = encrypt(cleanedData.password); 
          const hashedPassword = await bcrypt.hash(password, 10);          
          
          //User Update
          if (existingUser) {
            existingUser.userName = cleanedData.staffName;
            existingUser.userNum = cleanedData.contactNumber;
            existingUser.userEmail = cleanedData.email;
            existingUser.password = hashedPassword;
            existingUser.role = cleanedData.department;
            
            const updateUser = await existingUser.save(); 
            
            if (!updateUser) return res.status(500).json({ message: 'Error updating user' });
            
          }
        }else if(staff.enablePortal === false && cleanedData.enablePortal === true){
          
          cleanedData.password = encrypt(cleanedData.password); 
          const hashedPassword = await bcrypt.hash(password, 10);
          
          const user = await Users.create({
            organizationId,
            userName: cleanedData.staffName,
            userNum: cleanedData.contactNumber,
            userEmail: cleanedData.email,
            password: hashedPassword,
            role: cleanedData.department,
          });

          if (!user) return res.status(500).json({ message: 'Error adding user' });

        }else if(staff.enablePortal === true && cleanedData.enablePortal === false){

          await Users.findOneAndDelete({ userEmail: staff.email });

        }

        const mongooseDocument = Staff.hydrate(staff);

        Object.assign(mongooseDocument, cleanedData);
        const savedStaff = await mongooseDocument.save();
        
        if (!savedStaff) {
          console.error("Staff could not be saved.");
          return res.status(500).json({ message: "Failed to Update Staff." });
        }
        
        console.log( "Staff Edited Successfully",savedStaff);        
        res.status(201).json({ message: 'Staff Edited successfully', savedStaff });   
        
    } catch (error) {
      console.error("Error in editStaff:", error);
      res.status(500).json({ message: 'Error Editing Staff', error: error.message });
    }
};


// Get All Staff
exports.getAllStaff = async (req, res) => {
    try {
      const organizationId = req.user.organizationId;

      const { organizationExists, allStaff } = await dataExist(organizationId, null, null);

      if (!allStaff.length) {
        return res.status(404).json({ message: "No Staff found for the provided organization" });
      }      

      const transformedData = allStaff.map(data => ({
        ...data,
        service: Array.isArray(data.service)
            ? data.service.map(item => ({
                serviceId: item.serviceId?._id || null,
                serviceName: item.serviceId?.serviceName || null,
            }))
            : [] 
    }));
       

      const formattedObjects = multiCustomDateTime(transformedData, organizationExists.dateFormatExp, organizationExists.timeZoneExp, organizationExists.dateSplit );          

      
    res.status(200).json(formattedObjects);
    } catch (error) {
      console.error("Error in getAllStaff:", error);
      res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// Get One Staff
exports.getOneStaff = async (req, res) => {
    try {
        const { staffId } = req.params;

        const organizationId = req.user.organizationId;

        const { organizationExists, staff } = await dataExist( organizationId, null, staffId );

        if(!organizationExists) return res.status(404).json({ message: 'Organization not found' });

        if(!staff) return res.status(404).json({ message: 'Staff not found' });

        const transformedData = {
          ...staff,
          service: Array.isArray(staff.service)
            ? staff.service.map(item => ({
                serviceId: item.serviceId?._id || null,
                serviceName: item.serviceId?.serviceName || null,
            }))
            : []  
        };

        if (staff.password && typeof staff.password === "string" && staff.password.trim() !== "") {
          try {
              transformedData.password = decrypt(staff.password);
          } catch (decryptError) {
              console.error("Decryption error:", decryptError);
              transformedData.password = null; 
          }
        }
      
      
        res.status(200).json(transformedData);
    } catch (error) {
      console.error("Error in getAllStaff:", error);
      res.status(500).json({ message: 'Server Error', error: error.message });
    }
};



// Delete Staff
exports.deleteStaff = async (req, res) => {
  try {
      const { staffId } = req.params;

      const staff = await Staff.findById(staffId);
      if (!staff) return res.status(404).json({ message: "Staff not found" });

      console.log("Staff:", staff.enablePortal);
      

      if(staff.enablePortal === true){      
        await Users.findOneAndDelete({ userEmail: staff.email });
      }
      await Staff.findByIdAndDelete(staffId);


      res.status(200).json({ message: "Staff deleted successfully" });
  } catch (error) {
      console.error("Error deleting staff:", error);
      res.status(500).json({ message: "Server Error", error: error.message });
  }
};















//encryption 
function encrypt(text) {
  try {
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const authTag = cipher.getAuthTag().toString('hex'); // Get authentication tag

      return `${iv.toString('hex')}:${encrypted}:${authTag}`; // Return IV, encrypted text, and tag
  } catch (error) {
      console.error("Encryption error:", error);
      throw error;
  }
}


//decryption
function decrypt(encryptedText) {
  try {
      // Split the encrypted text to get the IV, encrypted data, and authentication tag
      const [ivHex, encryptedData, authTagHex] = encryptedText.split(':');
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');

      // Create the decipher with the algorithm, key, and IV
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(authTag); // Set the authentication tag

      let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
  } catch (error) {
      console.error("Decryption error:", error);
      throw error;
  }
}











// Validate Organization Tax Currency
function validateDataExist( organizationExists, res ) {
    if (!organizationExists) {
      res.status(404).json({ message: "Organization not found" });
      return false;
    }
    return true;
  }





//Validate inputs
function validateInputs( data, organizationExists, allRole, allService, res ) {
    const validationErrors = validateData(data, organizationExists, allRole, allService); 
  
    if (validationErrors.length > 0) {
      res.status(400).json({ message: validationErrors.join(", ") });
      return false;
    }
    return true;
}


function validateData( data, organizationExists, allRole, allService ) {
    const errors = [];

  
    //Basic Info
    validateReqFields( data, allRole, errors );

    validateService( data, allService, errors );


    

    
    //OtherDetails
    //validateAlphanumericFields([''], data, errors);
    validateIntegerFields([''], data, errors);
    validateFloatFields([''], data, errors);
    //validateAlphabetsFields([''], data, errors);
  
    return errors;
  }
  




// Field validation utility
function validateField(condition, errorMsg, errors) {
    if (condition) errors.push(errorMsg);
  }



function validateReqFields( data, allRole, errors ) {  

  validateField( typeof data.staffName === 'undefined', "Please enter the staff name.", errors  );
  validateField( typeof data.contactNumber === 'undefined', "Please enter the staff contact number.", errors  );
  
  
  if(data.enablePortal === true){
    validateField( typeof data.email === 'undefined', "Please enter the email.", errors );
    validateField( typeof data.password === 'undefined', "Please enter the password.", errors );
    
    validateField( typeof data.department === 'undefined', "Please select the department.", errors );   
    validateField( !allRole.find( role => role.roleName === data.department ), `Invalid role  ${data.department}. `, errors  );
  }
  

}
    


function validateService(data, allService, errors) {

  if (data.service.length > 0) {

    data.service.forEach(serviceItem => {
      const isValidService = allService.some(service => service._id.toString() === serviceItem.serviceId);
      validateField(!isValidService, `Invalid service selected.`, errors);
    });
  }
}





  //Valid Alphanumeric Fields
function validateAlphanumericFields(fields, data, errors) {
    fields.forEach((field) => {
      validateField(data[field] && !isAlphanumeric(data[field]), "Invalid " + field + ": " + data[field], errors);
    });
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
  //Valid Alphabets Fields 
  function validateAlphabetsFields(fields, data, errors) {
    fields.forEach((field) => {
      if (data[field] !== undefined) {
        validateField(!isAlphabets(data[field]),
          field.charAt(0).toUpperCase() + field.slice(1) + " should contain only alphabets.", errors);
      }
    });
  }