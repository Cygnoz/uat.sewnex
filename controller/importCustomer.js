// // v1.0

// const express = require("express");
// const multer = require('multer');
// const path = require('path');
// const fs = require('fs').promises;
// const ExcelJS = require('exceljs');
// const Papa = require('papaparse')
// const moment = require('moment-timezone');

// const Organization = require("../database/model/organization");
// const Account = require("../database/model/account");
// const Customer = require("../database/model/customer");
// const Currency = require("../database/model/currency");
// const Tax = require('../database/model/tax');



// // Function to generate time and date for storing in the database
// function generateTimeAndDateForDB(timeZone, dateFormat, dateSplit, baseTime = new Date(), timeFormat = 'HH:mm:ss', timeSplit = ':') {
//     // Convert the base time to the desired time zone
//     const localDate = moment.tz(baseTime, timeZone);
  
//     // Format date and time according to the specified formats
//     let formattedDate = localDate.format(dateFormat);
    
//     // Handle date split if specified
//     if (dateSplit) {
//       // Replace default split characters with specified split characters
//       formattedDate = formattedDate.replace(/[-/]/g, dateSplit); // Adjust regex based on your date format separators
//     }
  
//     const formattedTime = localDate.format(timeFormat);
//     const timeZoneName = localDate.format('z'); // Get time zone abbreviation
  
//     // Combine the formatted date and time with the split characters and time zone
//     const dateTime = `${formattedDate} ${formattedTime.split(':').join(timeSplit)} (${timeZoneName})`;
  
//     return {
//       date: formattedDate,
//       time: `${formattedTime} (${timeZoneName})`,
//       dateTime: dateTime
//     };
//   }
  





// // Function to sanitize the file name and prevent malicious paths
// function sanitizeFileName(fileName) {
//   return path.basename(fileName).replace(/[^a-z0-9\-_\.]/gi, '_');  // Allow only letters, numbers, hyphens, and underscores
// }






// exports.importCustomer = async (req, res) => {
//   try {
//     // Multer storage configuration
//     const storage = multer.diskStorage({
//       destination: (req, file, cb) => {
//         // Use a fixed upload directory, avoiding user-controlled input
//         cb(null, path.resolve(__dirname, '..', 'public', 'upload')); // Ensuring an absolute path
//       },
//       filename: (req, file, cb) => {
//         // Sanitize the filename to prevent any harmful characters or sequences
//         const safeFileName = sanitizeFileName('customer.xlsx');  // Static name, could also be generated dynamically
//         cb(null, safeFileName);
//       }
//     });

//     // Multer file filter to accept only XLSX files
//     const fileFilter = (req, file, cb) => {
//       const isValid = file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' &&
//                       path.extname(file.originalname).toLowerCase() === '.xlsx';
//       if (isValid) {
//         cb(null, true);
//       } else {
//         cb(new Error('Only .xlsx files are allowed!'), false);
//       }
//     };

//     const upload = multer({ 
//       storage: storage,
//       limits: { fileSize: 10 * 1024 * 1024 },  // 10MB limit
//       files: 1,                          // Limit to a single file per request
//       fieldSize: 10 * 1024 * 1024,       // Limit each field to 10 MB, if needed
//       fileFilter: fileFilter 
//     });

//     // Use Multer to handle file upload
//     upload.single('file')(req, res, async (err) => {
//       if (err instanceof multer.MulterError) {
//         console.error('Multer Error:', err.message);
//         return res.status(500).json({ message: err.message });
//       } else if (err) {
//         console.error('Error:', err.message);
//         return res.status(400).json({ message: err.message });
//       }

//       if (!req.file) {
//         console.error('No file uploaded');
//         return res.status(400).json({ message: "No file uploaded" });
//       }

//       try {
//         // Path to the uploaded XLSX file
//         const xlsxFilePath = path.resolve(__dirname, '..', 'public', 'upload', 'customer.xlsx');
//         const csvFilePath = path.resolve(__dirname, '..', 'public', 'upload', 'customer.csv');

//         // Log file paths
//         console.log('XLSX file path:', xlsxFilePath);
//         console.log('CSV file path:', csvFilePath);

//         // Check if the file exists
//         try {
//           await fs.access(xlsxFilePath);
//         } catch (error) {
//           console.error('XLSX file not found:', xlsxFilePath);
//           return res.status(404).json({ message: "XLSX file not found" });
//         }

//         // Read the XLSX file using exceljs
//         const workbook = new ExcelJS.Workbook();
//         await workbook.xlsx.readFile(xlsxFilePath);
//         const worksheet = workbook.worksheets[0];

//         // Convert the sheet to CSV format
//         const csvData = [];
//         worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
//           if (rowNumber === 1) {
//             // Add header row
//             csvData.push(row.values.slice(1).join(','));
//           } else {
//             // Add data rows
//             csvData.push(row.values.slice(1).join(','));
//           }
//         });

//         // Write the CSV data to a file
//         await fs.writeFile(csvFilePath, csvData.join('\n'), 'utf8');
//         console.log('CSV file saved:', csvFilePath);

//         // Log CSV file path
//         console.log('Converted CSV file path:', csvFilePath);

//         // Parse the CSV file using PapaParse
//         const csvFileContent = await fs.readFile(csvFilePath, 'utf8');
//         Papa.parse(csvFileContent, {
//           header: true,
//           skipEmptyLines: true,
//           complete: async (result) => {
//             const response = result.data;

//             // Validate organizationId
//             const organizationId = "INDORG0001";
//             // const organizationId = req.user.organizationId;

//             const organizationExists = await Organization.findOne({
//                 organizationId: organizationId,
//               });
//             if (!organizationExists) {
//               return res.status(404).json({
//                 message: "Organization not found",
//               });
//             }

//             const taxExists = await Tax.findOne({
//                 organizationId: organizationId,
//               });
//             if (!taxExists) {
//               return res.status(404).json({
//                 message: "Tax not found",
//               });
//             }

//             const currencyExists = await Currency.find(
//               {organizationId: organizationId},
//               { currencyCode: 1, _id: 0 }
//             );
//           if (!currencyExists) {
//             return res.status(404).json({
//               message: "Currency not found",
//             });
//           }
        
//             const timeZoneExp = organizationExists.timeZoneExp;
//             const dateFormatExp = organizationExists.dateFormatExp;
//             const dateSplit = organizationExists.dateSplit;
//             const generatedDateTime = generateTimeAndDateForDB(timeZoneExp, dateFormatExp, dateSplit);
//             const openingDate = generatedDateTime.dateTime;

//             const validSalutations = ['Mr.', 'Mrs.', 'Ms.', 'Miss.', 'Dr.'];
//             const validCustomerTypes = ['Individual', 'Business'];
//             const validGSTTreatments = ["Registered Business - Regular","Registered Business - Composition","Unregistered Business","Consumer","Overseas","Special Economic Zone","Deemed Export","Tax Deductor","SEZ Developer"];
             
//             const validCurrencies = currencyExists.map(currency => currency.currencyCode);
//             const validTaxTypes = ['None',taxExists.taxType];                      

//             const validCountries = {
//                   "United Arab Emirates": ["Abu Dhabi", "Dubai", "Sharjah", "Ajman", "Umm Al-Quwain", "Fujairah", "Ras Al Khaimah"],
//                   "India": ["Andaman and Nicobar Island", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chandigarh", "Chhattisgarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir", "Jharkhand", "Karnataka", "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal"],
//                   "Saudi Arabia":["Asir","Al Bahah", "Al Jawf", "Al Madinah", "Al-Qassim", "Eastern Province", "Hail", "Jazan", "Makkah","Medina", "Najran", "Northern Borders", "Riyadh", "Tabuk"],
//                 };            

//             function isAlphabets(value) {
//               return /^[A-Za-z\s]+$/.test(value);
//               }
        
//             function isInteger(value) {
//               return /^[0-9]+$/.test(value);
//               }
//             function isFloat(value) {
//               return /^-?\d+(\.\d+)?$/.test(value);
//               }        
//             function isValidDate(value) {
//               return !isNaN(Date.parse(value));
//               }
        
//             function isAlphanumeric(value) {
//               return /^[A-Za-z0-9]+$/.test(value);
//               }
        
//             function isValidEmail(value) {
//               return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/i.test(value);
//             }
            
//             let userData = [];
//             let insertedCustomers = [];
            

//             for (let x = 0; x < response.length; x++) {
//                 const salutation = response[x]['Salutation'];
//                 const customerType = response[x]['Customer Type'];
//                 const firstName = response[x]['First Name'];
//                 const lastName = response[x]['Last Name'];
//                 const companyName = response[x]['Company Name'];
//                 const customerDisplayName = response[x]['Customer Display Name'];
//                 const customerEmail = response[x]['Customer Email'];
//                 const workPhone = response[x]['Work Phone'];
//                 const mobile = response[x]['Mobile'];
//                 const dob = response[x]['DOB'];
//                 const cardNumber = response[x]['Card Number'];
//                 const pan = response[x]['PAN'];
//                 const currency = response[x]['Currency'];
//                 const openingBalance = response[x]['Opening Balance'];         
//                 const department = response[x]['Department'];
//                 const designation = response[x]['Designation'];
//                 const websiteUrl = response[x]['Website URL'];
//                 const taxType = response[x]['Tax Type'];
//                 let gstTreatment = response[x]['GST Treatment'];
//                 let gstin_uin = response[x]['GSTIN/UIN'];
//                 let vatNumber = response[x]['VAT Number'];
//                 const billingCountry = response[x]['Billing Country'];
//                 const billingState= response[x]['Billing State'];
//                 const shippingCountry = response[x]['Shipping Country'];
//                 const shippingState= response[x]['Shipping State'];
//                 const placeOfSupply = response[x]['Place Of Supply'];
//                 const businessLegalName = response[x]['Business Legal Name'];
//                 const businessTradeName = response[x]['Business Trade Name'];
//                 const billingPinCode = response[x]['Billing PinCode'];
//                 const billingPhone= response[x]['Billing Phone'];
//                 const billingFaxNumber= response[x]['Billing FaxNumber'];
//                 const shippingPinCode= response[x]['Shipping PinCode'];
//                 const shippingPhone= response[x]['Shipping Phone'];
//                 const shippingFaxNumber= response[x]['Shipping FaxNumber'];


                              


//                 // Validation checks
//                   if (!validSalutations.includes(salutation)) {
//                       console.error(`Invalid Salutation at row ${x + 1}: ${salutation}`);
//                       continue;
//                   }              
//                   if (!validCustomerTypes.includes(customerType)) {
//                       console.error(`Invalid Customer type at row ${x + 1}: ${customerType}`);
//                       continue;
//                   }              
//                   if (!isAlphabets(firstName)) {
//                       console.error(`Invalid First Name fields at row ${x + 1},${firstName}`);
//                       continue;
//                   }
//                   if (!isAlphabets(lastName)) {
//                     console.error(`Invalid Last Name fields at row ${x + 1},${lastName}`);
//                     continue;
//                   }
//                   // if (!isAlphanumeric(companyName)) {
//                   //   console.error(`Invalid Company Name fields at row ${x + 1},${companyName}`);
//                   //   continue;
//                   // }
//                   // if (!isAlphanumeric(customerDisplayName)) {
//                   //   console.error(`Invalid Customer Display Name fields at row ${x + 1},${customerDisplayName}`);
//                   //   continue;
//                   // }              
//                   if (!isValidEmail(customerEmail)) {
//                       console.error(`Invalid email at row ${x + 1}: ${customerEmail}`);
//                       continue;
//                   }              
//                   if (!isInteger(workPhone)) {
//                       console.error(`Invalid Work Phone numbers at row ${x + 1},${workPhone}`);
//                       continue;
//                   }
//                   if (!isInteger(mobile)) {
//                     console.error(`Invalid Mobile numbers at row ${x + 1},${mobile}`);
//                     continue;
//                   }              
//                   if (!isValidDate(dob)) {
//                       console.error(`Invalid Date of birth at row ${x + 1},${dob}`);
//                       continue;
//                   }              
//                   if (!isInteger(cardNumber)) {
//                       console.error(`Invalid Card Number fields at row ${x + 1},${cardNumber}`);
//                       continue;
//                   }
//                   if (!isAlphanumeric(pan)) {
//                     console.error(`Invalid Pan Card fields at row ${x + 1},${pan}`);
//                     continue;
//                   }
//                   if (!isFloat(openingBalance)) {
//                     console.error(`Invalid Opening Balance fields at row ${x + 1},${openingBalance}`);
//                     continue;
//                   }              
//                   if (!validCurrencies.includes(currency)) {
//                       console.error(`Invalid Currency at row ${x + 1},${currency}`);
//                       continue;
//                   }              
//                   if (!isAlphabets(department)) {
//                       console.error(`Invalid Department at row ${x + 1},${department}`);
//                       continue;
//                   }
//                   if (!isAlphabets(designation)) {
//                     console.error(`Invalid Designation at row ${x + 1},${designation}`);
//                     continue;
//                   }              
//                   // if (!isValidUrl(websiteUrl)) {
//                   //     console.error(`Invalid Website URL at row ${x + 1},${websiteUrl}`);
//                   //     continue;
//                   // }      
//                   if (!validCountries[billingCountry] || !validCountries[billingCountry].includes(billingState)) {
//                     console.error(`Invalid Billing Country or State at row ${x + 1}: ${billingCountry}, ${billingState}`);
//                     continue;
//                   }
//                   if (!validCountries[shippingCountry] || !validCountries[shippingCountry].includes(shippingState)) {
//                     console.error(`Invalid Shipping Country or State at row ${x + 1}: ${shippingCountry}, ${shippingState}`);
//                     continue;
//                   }
//                   if (!isInteger(billingPinCode)) {
//                     console.error(`Invalid Billing Pin Code Number fields at row ${x + 1},${billingPinCode}`);
//                     continue;
//                   }
//                   if (!isInteger(billingPhone)) {
//                     console.error(`Invalid Billing Phone Number fields at row ${x + 1},${billingPhone}`);
//                     continue;
//                   }
//                   if (!isInteger(billingFaxNumber)) {
//                     console.error(`Invalid Billing Fax Number fields at row ${x + 1},${billingFaxNumber}`);
//                     continue;
//                   }
//                   if (!isInteger(shippingPinCode)) {
//                     console.error(`Invalid Shipping Pin Code Number fields at row ${x + 1},${shippingPinCode}`);
//                     continue;
//                   }
//                   if (!isInteger(shippingPhone)) {
//                     console.error(`Invalid Shipping Phone Number fields at row ${x + 1},${shippingPhone}`);
//                     continue;
//                   }
//                   if (!isInteger(shippingFaxNumber)) {
//                     console.error(`Invalid Shipping Fax Number fields at row ${x + 1},${shippingFaxNumber}`);
//                     continue;
//                   }
                  

//                   if (!validTaxTypes.includes(taxType)) {
//                     console.error(`Invalid Tax Type at row ${x + 1}: ${taxType}`);
//                     continue;
//                 }                 
                                
//                   if (taxType === "GST") {                  
//                       if (!validGSTTreatments.includes(gstTreatment)) {
//                           console.error(`Invalid GST treatment at row ${x + 1},${gstTreatment}`);
//                           continue;
//                       }
              
//                       if (!isAlphanumeric(gstin_uin)) {
//                           console.error(`Invalid GSTIN/UIN at row ${x + 1},${gstin_uin}`);
//                           continue;
//                       }
//                   } else if (taxType === "VAT") {
//                       if (!isAlphanumeric(vatNumber)) {
//                           console.error(`Invalid VAT number at row ${x + 1},${vatNumber}`);
//                           continue;
//                       }
//                   } else if (taxType === "None") {
//                     gstTreatment = undefined;
//                     gstin_uin = undefined;
//                     vatNumber = undefined;                    
//                 }
                  
                  
//                   if (!validCountries[billingCountry].includes(placeOfSupply)) {
//                       console.error(`Invalid Place of Supply at row ${x + 1},${placeOfSupply}`);
//                       continue;
//                   }
//                   // if (!isAlphabets(businessLegalName)) {
//                   //   console.error(`Invalid Business Legal Name at row ${x + 1},${businessLegalName}`);
//                   //   continue;
//                   // }
//                   // if (!isAlphabets(businessTradeName)) {
//                   //   console.error(`Invalid  Business Trade Name at row ${x + 1},${businessTradeName}`);
//                   //   continue;
//                   // }


//                 // Push valid data to userData array
//                 userData.push({
//                     customerType,
//                     salutation,
//                     firstName,
//                     lastName,
//                     companyName,
//                     customerDisplayName,
//                     customerEmail,
//                     workPhone,
//                     mobile,
//                     dob,
//                     cardNumber,
//                     pan,
//                     currency,
//                     openingBalance: openingBalance,
//                     department,
//                     designation,
//                     websiteUrl,
//                     taxType,
//                     gstTreatment,
//                     gstin_uin,
//                     placeOfSupply,
//                     businessLegalName,
//                     businessTradeName,
//                     vatNumber,
//                     billingAttention: response[x]['Billing Attention'],
//                     // billingCountry: response[x]['Billing Country'],
//                     billingAddressLine1: response[x]['Billing AddressLine1'],
//                     billingAddressLine2: response[x]['Billing AddressLine2'],
//                     billingCity: response[x]['Billing City'],
//                     // billingState: response[x]['Billing State'],
//                     // billingPinCode: response[x]['Billing PinCode'],
//                     // billingPhone: response[x]['Billing Phone'],
//                     // billingFaxNumber: response[x]['Billing FaxNumber'],
//                     shippingAttention: response[x]['Shipping Attention'],
//                     // shippingCountry: response[x]['Shipping Country'],
//                     shippingAddressLine1: response[x]['Shipping AddressLine1'],
//                     shippingAddressLine2: response[x]['Shipping AddressLine2'],
//                     shippingCity: response[x]['Shipping City'],
//                     // shippingState: response[x]['Shipping State'],
//                     // shippingPinCode: response[x]['Shipping PinCode'],
//                     // shippingPhone: response[x]['Shipping Phone'],
//                     // shippingFaxNumber: response[x]['Shipping FaxNumber'],
//                     remark: response[x]['Remark'],
//                     createdDate: openingDate,
//                     status: "Active"
//                 });
//             }
            
//             if (userData.length > 0) {                
//                 insertedCustomers = await Customer.insertMany(userData);
//             }
  
//             for (let x = 0; x < insertedCustomers.length; x++) {  
//               //console.log(insertedCustomers[x]);
                                    
//                         // Create a new Customer Account
//                         const newAccount = new Account({
//                           organizationId,
//                           accountName: insertedCustomers[x].customerDisplayName,
//                           accountCode: insertedCustomers[x]._id,

//                           accountSubhead: "Sundry Debtors",
//                           accountHead: "Asset",
//                           accountGroup: "Asset",

//                           openingBalance: insertedCustomers[x].openingBalance,
//                           openingBalanceDate: openingDate,
//                           description: "Customer",
//                         });

//                         await newAccount.save();                
                        

//             }
//             console.log("Customer & Account created successfully");
            
//             res.status(200).send({ success: true, msg: 'Customer XLSX Extracted Successfully' });
//           }
//         });
//       } catch (error) {
//         console.error("Error during Importing Customer process:", error);
//         res.status(500).json({ message: "Internal server error." });
//       }
//     });
//   } catch (error) {
//     console.error("Error processing request:", error);
//     res.status(500).json({ message: "Internal server error." });
//   }
// };

