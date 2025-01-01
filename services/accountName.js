
const Accounts = require("../database/model/account"); 


// Single function to fetch account name
async function singleAccountName(data, organizationId) {
  if (!data || !data.accountId || !organizationId) {
    throw new Error("Missing required parameters: data.accountId or organizationId.");
  }

  // Fetch account from the database
  const account = await Accounts.findOne({ accountId: data.accountId, organizationId });
  
  if (!account) {
    throw new Error(`No account found for accountId: ${data.accountId} and organizationId: ${organizationId}`);
  }

  return { 
    ...data,
    accountName: account.accountName 
  };
}

// Multiple function to fetch account names
async function multiAccountName(dataArray, organizationId) {
  if (!Array.isArray(dataArray)) {
    throw new Error("The first parameter must be an array of objects.");
  }

  if (!organizationId) {
    throw new Error("Missing required parameter: organizationId.");
  }

  // Iterate over each data object and fetch the account name
  const results = await Promise.all(
    dataArray.map(async (data) => {
      if (!data.accountId) {
        throw new Error("Each object must have an accountId property.");
      }

      const account = await Accounts.findOne({ _id: data.accountId, organizationId });

      if (!account) {
        throw new Error(`No account found for accountId: ${data.accountId} and organizationId: ${organizationId}`);
      }

      return {
        ...data,
        accountName: account.accountName
      };
    })
  );

  return results;
}

module.exports = { singleAccountName, multiAccountName };
