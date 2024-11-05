// v1.0

const Account = require("../database/model/account")
const TrialBalance = require("../database/model/trialBalance")




//Add Account
exports.lifeWater = async (req, res) => {
    console.log("Life water Trial Entry:", req.body);

    try {
      const cleanedData = cleanCustomerData(req.body);

      if (typeof cleanedData.customerDisplayName ==='undefined'){
        return res.status(400).json({ message: "Customer Display Name is required" });
      }

      const newAccount = new Account({
        organizationId: "INDORG0010",
        accountName: cleanedData.customerDisplayName,
        accountSubhead: "Sundry Debtors",
        accountHead: "Asset",
        accountGroup: "Asset",
        description: "Customer",
      });
      await newAccount.save();



      const trialEntry = new TrialBalance({
        organizationId: "INDORG0010",
        operationId: newAccount._id,
        accountId: newAccount._id,
        accountName: newAccount.accountName,
        action: "Opening Balance",
        debitAmount: 0,
        creditAmount: 0,
      });
      await trialEntry.save();
  
      
      res.status(201).json({ message: "Account created successfully." });
      console.log("Life Water Account created successfully",newAccount,trialEntry);
    } catch (error) {
      console.error("Error creating Account:", error);
      res.status(500).json({ message: "Internal server error." });
    } 
};











//Clean Data 
function cleanCustomerData(data) {
    const cleanData = (value) => (value === null || value === undefined || value === "" || value === 0 ? undefined : value);
    return Object.keys(data).reduce((acc, key) => {
      acc[key] = cleanData(data[key]);
      return acc;
    }, {});
  }