const mongoose = require('mongoose');
const TrialBalance = require('../database/model/trialBalance');
const Account = require('../database/model/account');
const ItemTrack = require('../database/model/itemTrack');
const Organization = require("../database/model/organization");
const moment = require('moment-timezone');

const { singleCustomDateTime, multiCustomDateTime } = require("../services/timeConverter");



// Fetch existing data
const dataExist = async ( organizationId ) => {
    const [organizationExists ] = await Promise.all([
        Organization.findOne({ organizationId },{ timeZoneExp: 1, dateFormatExp: 1, dateSplit: 1, organizationCountry: 1 }).lean(),
    ]);
    return { organizationExists };
};


// Helper function to validate dates
function validateDates(startDate, endDate) {
    if (isNaN(startDate) || isNaN(endDate)) {
        throw new Error("Invalid date format. Please use DD-MM-YYYY format.");
    }
}

// Helper function to parse dates
function parseDate( timezone, dateStr, isEndDate = false ) {
    const [day, month, year] = dateStr.split('-');
    let date = moment.tz(`${year}-${month}-${day}`, timezone);
    if (isEndDate) {
        date = date.endOf('day');
    }
    return date.toDate();
}

// 1. Opening Balance
async function getOpeningBalance( organizationExists, organizationId, startDate) {
    const openingStock = await calculateOpeningStock( organizationExists, organizationId, startDate);
    return {
        items: openingStock.items,
        total: openingStock.total
    };
}

// 2. Closing Balance
async function getClosingBalance( organizationExists, organizationId, endDate) {
    const closingStock = await calculateClosingStock( organizationExists, organizationId, endDate);
    return {
        items: closingStock.items,
        total: closingStock.total
    };
}




// Report for single subhead
async function getReportAccount(organizationExists,organizationId, startDate, endDate, accountSubHead) {
    try {
        const openingBalances = await TrialBalance.aggregate([
            {
                $match: {
                    organizationId: organizationId,
                    createdDateTime: { $lt: startDate }
                }
            },
            {
                $lookup: {
                    from: "accounts",
                    localField: "accountId",
                    foreignField: "_id",
                    as: "accountDetails"
                }
            },
            { $unwind: "$accountDetails" },
            { 
                $match: { 
                    "accountDetails.accountSubhead": accountSubHead,
                    "accountDetails.accountName": { 
                        $nin: ["Sales Discount", "Purchase Discount","Sales Discount(Cash Discount)","Purchase Discounts(Cash Discount)"] 
                    } 
                } 
            },
            {
                $group: {
                    _id: "$accountId",
                    accountName: { $first: "$accountDetails.accountName" },
                    totalDebit: { $sum: "$debitAmount" },
                    totalCredit: { $sum: "$creditAmount" }
                }
            },
            {
                $set: {
                    totalDebit: {
                        $cond: {
                            if: { $gt: ["$totalDebit", "$totalCredit"] },
                            then: { $subtract: ["$totalDebit", "$totalCredit"] },
                            else: 0
                        }
                    },
                    totalCredit: {
                        $cond: {
                            if: { $gt: ["$totalCredit", "$totalDebit"] },
                            then: { $subtract: ["$totalCredit", "$totalDebit"] },
                            else: 0
                        }
                    }
                }
            }
        ]);
        

        const transactions = await TrialBalance.aggregate([
            {
                $match: {
                    organizationId: organizationId,
                    createdDateTime: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $lookup: {
                    from: "accounts",
                    localField: "accountId",
                    foreignField: "_id",
                    as: "accountDetails"
                }
            },
            { $unwind: "$accountDetails" },
            { 
                $match: { 
                    "accountDetails.accountSubhead": accountSubHead,
                    "accountDetails.accountName": { 
                        $nin: ["Sales Discount", "Purchase Discount","Sales Discount(Cash Discount)","Purchase Discounts(Cash Discount)"] 
                    } 
                } 
            },
            {
                $match: {
                    $or: [{ debitAmount: { $ne: 0 } }, { creditAmount: { $ne: 0 } }]
                }
            },
            {
                $project: {
                    accountId: 1,
                    accountName: "$accountDetails.accountName",
                    transactionId: 1,
                    operationId: 1,
                    date: "$createdDateTime",
                    debitAmount: 1,
                    creditAmount: 1
                }
            },
            {
                $addFields: {
                    month: {
                        $dateToString: {
                            format: "%B %Y",
                            date: "$date"
                        }
                    }
                }
            },
            {
                $group: {
                    _id: { accountId: "$accountId", accountName: "$accountName", month: "$month" },
                    transactions: {
                        $push: {
                            transactionId: "$transactionId",
                            operationId: "$operationId",
                            createdDateTime: "$date",
                            createdDate: null,
                            createdTime:null,
                            debitAmount: "$debitAmount",
                            creditAmount: "$creditAmount"
                        }
                    },
                    totalDebit: { $sum: "$debitAmount" },
                    totalCredit: { $sum: "$creditAmount" }
                }
            },
            {
                $set: {
                    totalDebit: {
                        $cond: {
                            if: { $gt: ["$totalDebit", "$totalCredit"] },
                            then: { $subtract: ["$totalDebit", "$totalCredit"] },
                            else: 0
                        }
                    },
                    totalCredit: {
                        $cond: {
                            if: { $gt: ["$totalCredit", "$totalDebit"] },
                            then: { $subtract: ["$totalCredit", "$totalDebit"] },
                            else: 0
                        }
                    }
                }
            },
            {
                $group: {
                    _id: "$_id.accountId",
                    accountName: { $first: "$_id.accountName" },
                    overallNetDebit: { $sum: "$totalDebit" },
                    overallNetCredit: { $sum: "$totalCredit" },
                    entries: {
                        $push: {
                            date: "$_id.month",
                            transactions: "$transactions",
                            overAllNetDebit: "$totalDebit",
                            overAllNetCredit: "$totalCredit"
                        }
                    }
                }
            },
            {
                $set: {
                    overallNetDebit: {
                        $cond: {
                            if: { $gt: ["$overallNetDebit", "$overallNetCredit"] },
                            then: { $subtract: ["$overallNetDebit", "$overallNetCredit"] },
                            else: 0
                        }
                    },
                    overallNetCredit: {
                        $cond: {
                            if: { $gt: ["$overallNetCredit", "$overallNetDebit"] },
                            then: { $subtract: ["$overallNetCredit", "$overallNetDebit"] },
                            else: 0
                        }
                    }
                }
            }
        ]);

        // Apply formatting after aggregation
        const formattedTransactions = transactions.map(account => {
            
            // Ensure entries exist
            if (!Array.isArray(account.entries)) {
                account.entries = [];
            }
            
            // Loop through each entry and format its transactions
            account.entries.forEach(entry => {
                if (!Array.isArray(entry.transactions)) {
                    entry.transactions = []; // Ensure transactions is an array
                }
                
                entry.transactions = entry.transactions.map(transaction => {
                    const { dateFormatExp, timeZoneExp, dateSplit } = organizationExists;                   
                    
                    const formattedData = singleCustomDateTime( transaction, dateFormatExp, timeZoneExp, dateSplit );
        
                    return {
                        ...transaction,
                        createdDate: formattedData.createdDate,
                        createdTime: formattedData.createdTime,
                    };
                });
            });
        
            return account;
        });
                

        let overallNetDebit = 0;
        let overallNetCredit = 0;

        const finalResult = formattedTransactions.map((account) => {
            const openingBalance = openingBalances.find(ob => ob._id.equals(account._id)) || { totalDebit: 0, totalCredit: 0 };

            const openingEntry = {
                date: "Opening Balance",
                transactions: [],
                overAllNetDebit: openingBalance.totalDebit,
                overAllNetCredit: openingBalance.totalCredit
            };

            account.entries.unshift(openingEntry);
            account.overallNetDebit += openingBalance.totalDebit;
            account.overallNetCredit += openingBalance.totalCredit;

            overallNetDebit += account.overallNetDebit;
            overallNetCredit += account.overallNetCredit;

            return {
                accountId: account._id,
                accountName: account.accountName,
                overallNetDebit: account.overallNetDebit,
                overallNetCredit: account.overallNetCredit,
                entries: account.entries
            };
        });

        // Adjusting overallNetDebit and overallNetCredit based on the condition
        if (overallNetDebit > overallNetCredit) {
            overallNetDebit -= overallNetCredit;
            overallNetCredit = 0;
        } else if (overallNetCredit > overallNetDebit) {
            overallNetCredit -= overallNetDebit;
            overallNetDebit = 0;
        }

        return {
            overallNetDebit,
            overallNetCredit,
            data: finalResult
        };

    } catch (error) {
        console.error("Error fetching data:", error);
        return { overallNetDebit: 0, overallNetCredit: 0, data: [] };
    }
}



//Report for Current Asset
async function getReportAccountForAssets( organizationExists, organizationId, startDate, endDate) {
    try {
        const accountSubHeadFilter = { $in: ['Current Asset', 'Cash', 'Bank','Sundry Debtors'] };

        const openingBalances = await TrialBalance.aggregate([
            {
                $match: {
                    organizationId: organizationId,
                    createdDateTime: { $lt: startDate }
                }
            },
            {
                $lookup: {
                    from: "accounts",
                    localField: "accountId",
                    foreignField: "_id",
                    as: "accountDetails"
                }
            },
            { $unwind: "$accountDetails" },
            { $match: { "accountDetails.accountSubhead": accountSubHeadFilter } }, // Updated match condition
            {
                $group: {
                    _id: "$accountId",
                    accountName: { $first: "$accountDetails.accountName" },
                    totalDebit: { $sum: "$debitAmount" },
                    totalCredit: { $sum: "$creditAmount" }
                }
            },
            {
                $set: {
                    totalDebit: {
                        $cond: {
                            if: { $gt: ["$totalDebit", "$totalCredit"] },
                            then: { $subtract: ["$totalDebit", "$totalCredit"] },
                            else: 0
                        }
                    },
                    totalCredit: {
                        $cond: {
                            if: { $gt: ["$totalCredit", "$totalDebit"] },
                            then: { $subtract: ["$totalCredit", "$totalDebit"] },
                            else: 0
                        }
                    }
                }
            }
        ]);

        const transactions = await TrialBalance.aggregate([
            {
                $match: {
                    organizationId: organizationId,
                    createdDateTime: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $lookup: {
                    from: "accounts",
                    localField: "accountId",
                    foreignField: "_id",
                    as: "accountDetails"
                }
            },
            { $unwind: "$accountDetails" },
            { $match: { "accountDetails.accountSubhead": accountSubHeadFilter } }, // Updated match condition
            {
                $match: {
                    $or: [{ debitAmount: { $ne: 0 } }, { creditAmount: { $ne: 0 } }]
                }
            },
            {
                $project: {
                    accountId: "$accountId",
                    accountName: "$accountDetails.accountName",
                    transactionId: "$transactionId",
                    operationId: "$operationId",
                    date: "$createdDateTime",
                    debitAmount: "$debitAmount",
                    creditAmount: "$creditAmount"
                }
            },
            {
                $addFields: {
                    month: {
                        $dateToString: {
                            format: "%B %Y",
                            date: "$date"
                        }
                    }
                }
            },
            {
                $group: {
                    _id: { accountId: "$accountId", accountName: "$accountName", month: "$month" },
                    transactions: {
                        $push: {
                            transactionId: "$transactionId",
                            operationId: "$operationId",
                            createdDateTime: "$date",
                            createdDate: null,
                            createdTime:null,
                            debitAmount: "$debitAmount",
                            creditAmount: "$creditAmount"
                        }
                    },
                    totalDebit: { $sum: "$debitAmount" },
                    totalCredit: { $sum: "$creditAmount" }
                }
            },
            {
                $set: {
                    totalDebit: {
                        $cond: {
                            if: { $gt: ["$totalDebit", "$totalCredit"] },
                            then: { $subtract: ["$totalDebit", "$totalCredit"] },
                            else: 0
                        }
                    },
                    totalCredit: {
                        $cond: {
                            if: { $gt: ["$totalCredit", "$totalDebit"] },
                            then: { $subtract: ["$totalCredit", "$totalDebit"] },
                            else: 0
                        }
                    }
                }
            },
            {
                $group: {
                    _id: "$_id.accountId",
                    accountName: { $first: "$_id.accountName" },
                    overallNetDebit: { $sum: "$totalDebit" },
                    overallNetCredit: { $sum: "$totalCredit" },
                    entries: {
                        $push: {
                            date: "$_id.month",
                            transactions: "$transactions",
                            overAllNetDebit: "$totalDebit",
                            overAllNetCredit: "$totalCredit"
                        }
                    }
                }
            },
            {
                $set: {
                    overallNetDebit: {
                        $cond: {
                            if: { $gt: ["$overallNetDebit", "$overallNetCredit"] },
                            then: { $subtract: ["$overallNetDebit", "$overallNetCredit"] },
                            else: 0
                        }
                    },
                    overallNetCredit: {
                        $cond: {
                            if: { $gt: ["$overallNetCredit", "$overallNetDebit"] },
                            then: { $subtract: ["$overallNetCredit", "$overallNetDebit"] },
                            else: 0
                        }
                    }
                }
            }
        ]);

        // Apply formatting after aggregation
        const formattedTransactions = transactions.map(account => {
            
            // Ensure entries exist
            if (!Array.isArray(account.entries)) {
                account.entries = [];
            }
            
            // Loop through each entry and format its transactions
            account.entries.forEach(entry => {
                if (!Array.isArray(entry.transactions)) {
                    entry.transactions = []; // Ensure transactions is an array
                }
                
                entry.transactions = entry.transactions.map(transaction => {
                    const { dateFormatExp, timeZoneExp, dateSplit } = organizationExists;
                    
                    const formattedData = singleCustomDateTime( transaction, dateFormatExp, timeZoneExp, dateSplit );
        
                    return {
                        ...transaction,
                        createdDate: formattedData.createdDate,
                        createdTime: formattedData.createdTime,
                    };
                });
            });
        
            return account;
        });

        let overallNetDebit = 0;
        let overallNetCredit = 0;

        const finalResult = formattedTransactions.map((account) => {
            const openingBalance = openingBalances.find(ob => ob._id.equals(account._id)) || { totalDebit: 0, totalCredit: 0 };
            const openingEntry = {
                date: "Opening Balance",
                transactions: [],
                overAllNetDebit: openingBalance.totalDebit,
                overAllNetCredit: openingBalance.totalCredit
            };

            account.entries.unshift(openingEntry);
            account.overallNetDebit += openingEntry.overAllNetDebit;
            account.overallNetCredit += openingEntry.overAllNetCredit;

            overallNetDebit += account.overallNetDebit;
            overallNetCredit += account.overallNetCredit;

            return {
                accountId: account._id,
                accountName: account.accountName,
                overallNetDebit: account.overallNetDebit,
                overallNetCredit: account.overallNetCredit,
                entries: account.entries
            };
        });

        // Adjusting overallNetDebit and overallNetCredit based on the condition
        if (overallNetDebit > overallNetCredit) {
            overallNetDebit -= overallNetCredit;
            overallNetCredit = 0;
        } else if (overallNetCredit > overallNetDebit) {
            overallNetCredit -= overallNetDebit;
            overallNetDebit = 0;
        }

        return {
            overallNetDebit,
            overallNetCredit,
            data: finalResult
        };

    } catch (error) {
        console.error("Error fetching asset accounts report:", error);
        return { overallNetDebit: 0, overallNetCredit: 0, data: [] };
    }
}


//Report for Current Liability
async function getReportAccountForLiability( organizationExists, organizationId, startDate, endDate) {
    try {
        const accountSubHeadFilter = { $in: ['Current Liability', 'Sundry Creditors'] };

        const openingBalances = await TrialBalance.aggregate([
            {
                $match: {
                    organizationId: organizationId,
                    createdDateTime: { $lt: startDate }
                }
            },
            {
                $lookup: {
                    from: "accounts",
                    localField: "accountId",
                    foreignField: "_id",
                    as: "accountDetails"
                }
            },
            { $unwind: "$accountDetails" },
            { $match: { "accountDetails.accountSubhead": accountSubHeadFilter } }, // Updated match condition
            {
                $group: {
                    _id: "$accountId",
                    accountName: { $first: "$accountDetails.accountName" },
                    totalDebit: { $sum: "$debitAmount" },
                    totalCredit: { $sum: "$creditAmount" }
                }
            },
            {
                $set: {
                    totalDebit: {
                        $cond: {
                            if: { $gt: ["$totalDebit", "$totalCredit"] },
                            then: { $subtract: ["$totalDebit", "$totalCredit"] },
                            else: 0
                        }
                    },
                    totalCredit: {
                        $cond: {
                            if: { $gt: ["$totalCredit", "$totalDebit"] },
                            then: { $subtract: ["$totalCredit", "$totalDebit"] },
                            else: 0
                        }
                    }
                }
            }
        ]);

        const transactions = await TrialBalance.aggregate([
            {
                $match: {
                    organizationId: organizationId,
                    createdDateTime: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $lookup: {
                    from: "accounts",
                    localField: "accountId",
                    foreignField: "_id",
                    as: "accountDetails"
                }
            },
            { $unwind: "$accountDetails" },
            { $match: { "accountDetails.accountSubhead": accountSubHeadFilter } }, // Updated match condition
            {
                $match: {
                    $or: [{ debitAmount: { $ne: 0 } }, { creditAmount: { $ne: 0 } }]
                }
            },
            {
                $project: {
                    accountId: "$accountId",
                    accountName: "$accountDetails.accountName",
                    transactionId: "$transactionId",
                    operationId: "$operationId",
                    date: "$createdDateTime",
                    debitAmount: "$debitAmount",
                    creditAmount: "$creditAmount"
                }
            },
            {
                $addFields: {
                    month: {
                        $dateToString: {
                            format: "%B %Y",
                            date: "$date"
                        }
                    }
                }
            },
            {
                $group: {
                    _id: { accountId: "$accountId", accountName: "$accountName", month: "$month" },
                    transactions: {
                        $push: {
                            transactionId: "$transactionId",
                            operationId: "$operationId",
                            createdDateTime: "$date",
                            createdDate: null,
                            createdTime:null,
                            debitAmount: "$debitAmount",
                            creditAmount: "$creditAmount"
                        }
                    },
                    totalDebit: { $sum: "$debitAmount" },
                    totalCredit: { $sum: "$creditAmount" }
                }
            },
            {
                $set: {
                    totalDebit: {
                        $cond: {
                            if: { $gt: ["$totalDebit", "$totalCredit"] },
                            then: { $subtract: ["$totalDebit", "$totalCredit"] },
                            else: 0
                        }
                    },
                    totalCredit: {
                        $cond: {
                            if: { $gt: ["$totalCredit", "$totalDebit"] },
                            then: { $subtract: ["$totalCredit", "$totalDebit"] },
                            else: 0
                        }
                    }
                }
            },
            {
                $group: {
                    _id: "$_id.accountId",
                    accountName: { $first: "$_id.accountName" },
                    overallNetDebit: { $sum: "$totalDebit" },
                    overallNetCredit: { $sum: "$totalCredit" },
                    entries: {
                        $push: {
                            date: "$_id.month",
                            transactions: "$transactions",
                            overAllNetDebit: "$totalDebit",
                            overAllNetCredit: "$totalCredit"
                        }
                    }
                }
            },
            {
                $set: {
                    overallNetDebit: {
                        $cond: {
                            if: { $gt: ["$overallNetDebit", "$overallNetCredit"] },
                            then: { $subtract: ["$overallNetDebit", "$overallNetCredit"] },
                            else: 0
                        }
                    },
                    overallNetCredit: {
                        $cond: {
                            if: { $gt: ["$overallNetCredit", "$overallNetDebit"] },
                            then: { $subtract: ["$overallNetCredit", "$overallNetDebit"] },
                            else: 0
                        }
                    }
                }
            }
        ]);

        // Apply formatting after aggregation
        const formattedTransactions = transactions.map(account => {
            
            // Ensure entries exist
            if (!Array.isArray(account.entries)) {
                account.entries = [];
            }
            
            // Loop through each entry and format its transactions
            account.entries.forEach(entry => {
                if (!Array.isArray(entry.transactions)) {
                    entry.transactions = []; // Ensure transactions is an array
                }
                
                entry.transactions = entry.transactions.map(transaction => {
                    const { dateFormatExp, timeZoneExp, dateSplit } = organizationExists;
                    
                    const formattedData = singleCustomDateTime( transaction, dateFormatExp, timeZoneExp, dateSplit );
        
                    return {
                        ...transaction,
                        createdDate: formattedData.createdDate,
                        createdTime: formattedData.createdTime,
                    };
                });
            });
        
            return account;
        });

        let overallNetDebit = 0;
        let overallNetCredit = 0;

        const finalResult = formattedTransactions.map((account) => {
            const openingBalance = openingBalances.find(ob => ob._id.equals(account._id)) || { totalDebit: 0, totalCredit: 0 };
            const openingEntry = {
                date: "Opening Balance",
                transactions: [],
                overAllNetDebit: openingBalance.totalDebit,
                overAllNetCredit: openingBalance.totalCredit
            };

            account.entries.unshift(openingEntry);
            account.overallNetDebit += openingEntry.overAllNetDebit;
            account.overallNetCredit += openingEntry.overAllNetCredit;

            overallNetDebit += account.overallNetDebit;
            overallNetCredit += account.overallNetCredit;

            return {
                accountId: account._id,
                accountName: account.accountName,
                overallNetDebit: account.overallNetDebit,
                overallNetCredit: account.overallNetCredit,
                entries: account.entries
            };
        });

        // Adjusting overallNetDebit and overallNetCredit based on the condition
        if (overallNetDebit > overallNetCredit) {
            overallNetDebit -= overallNetCredit;
            overallNetCredit = 0;
        } else if (overallNetCredit > overallNetDebit) {
            overallNetCredit -= overallNetDebit;
            overallNetDebit = 0;
        }

        return {
            overallNetDebit,
            overallNetCredit,
            data: finalResult
        };

    } catch (error) {
        console.error("Error fetching asset accounts report:", error);
        return { overallNetDebit: 0, overallNetCredit: 0, data: [] };
    }
}

    


















































exports.calculateTradingAccount = async (req, res) => {
    try {
        const { organizationId } = req.user;
        const { startDate, endDate } = req.params;

        const { organizationExists } = await dataExist(organizationId);   

        const start = parseDate(organizationExists.timeZoneExp, startDate);
        const end = parseDate(organizationExists.timeZoneExp, endDate, true);
        
        validateDates(start, end);

        const openingStock = await getOpeningBalance( organizationExists, organizationId, start);
        const closingStock = await getClosingBalance( organizationExists, organizationId, end);

        const purchases = await getReportAccount( organizationExists, organizationId, start, end,'Cost of Goods Sold');
        const sales = await getReportAccount( organizationExists, organizationId, start, end,'Sales');
        const directExpenses = await getReportAccount( organizationExists, organizationId, start, end,'Direct Expense');        
                
        const totalDebit = openingStock.total + purchases.overallNetDebit + directExpenses.overallNetDebit - purchases.overallNetCredit - directExpenses.overallNetCredit;
        const totalCredit = sales.overallNetCredit + closingStock.total - sales.overallNetDebit;
        
        let grossProfit = 0, grossLoss = 0, carryForward = 0, carryForwardType = "";

        if (totalCredit > totalDebit) {
            grossProfit = totalCredit - totalDebit;
            carryForward = grossProfit;
            carryForwardType = "debit"; 
        } else if (totalDebit > totalCredit) {
            grossLoss = totalDebit - totalCredit;
            carryForward = grossLoss;
            carryForwardType = "credit"; 
        }
                
        const finalCredit = totalCredit + grossLoss;
        const finalDebit = totalDebit + grossProfit;

        const result = {
            debit: [
                { openingStock },
                { purchases },
                { directExpenses },
                ...(carryForwardType === "debit" ? [{ grossProfit: carryForward }] : [{ grossProfit: 0 }])
            ],
            credit: [
                { sales },
                { closingStock },
                ...(carryForwardType === "credit" ? [{ grossLoss: carryForward }] : [{ grossLoss: 0 }])
            ],
            finalDebit,
            finalCredit,
            grossProfit,
            grossLoss
        };

        res.status(200).json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};








exports.calculateProfitAndLoss = async (req, res) => {
    try {
        const { organizationId } = req.user;
        const { startDate, endDate } = req.params;

        const { organizationExists } = await dataExist(organizationId);
        const start = parseDate(organizationExists.timeZoneExp, startDate);
        const end = parseDate(organizationExists.timeZoneExp, endDate, true);

        validateDates(start, end);

        // Trading Account Calculations
        const openingStock = await getOpeningBalance( organizationExists, organizationId, start);
        const closingStock = await getClosingBalance( organizationExists, organizationId, end);

        const purchases = await getReportAccount( organizationExists, organizationId, start, end,'Cost of Goods Sold');
        const sales = await getReportAccount( organizationExists, organizationId, start, end,'Sales');
        const directExpenses = await getReportAccount( organizationExists, organizationId, start, end,'Direct Expense'); 

        // Profit and Loss Calculations
        const indirectIncome = await getReportAccount( organizationExists, organizationId, start, end,'Indirect Income');
        const indirectExpenses = await getReportAccount( organizationExists, organizationId, start, end,'Indirect Expense');

        // Gross Profit/Loss Calculation
        const totalDebitTradingAccount = openingStock.total + purchases.overallNetDebit + directExpenses.overallNetDebit - purchases.overallNetCredit - directExpenses.overallNetCredit;
        const totalCreditTradingAccount = sales.overallNetCredit + closingStock.total - sales.overallNetDebit;

        
        let grossProfit = 0, grossLoss = 0;
        
        if (totalCreditTradingAccount > totalDebitTradingAccount) {
            grossProfit = totalCreditTradingAccount - totalDebitTradingAccount;
        } else if (totalDebitTradingAccount > totalCreditTradingAccount) {
            grossLoss = totalDebitTradingAccount - totalCreditTradingAccount;
        }

        // Net Profit/Loss Calculation
        const totalDebitPL = grossLoss + indirectExpenses.overallNetDebit - indirectExpenses.overallNetCredit;
        const totalCreditPL = grossProfit + indirectIncome.overallNetCredit - indirectIncome.overallNetDebit;

        let netProfit = 0, netLoss = 0;

        if (totalCreditPL > totalDebitPL) {
            netProfit = totalCreditPL - totalDebitPL;
        } else if (totalDebitPL > totalCreditPL) {
            netLoss = totalDebitPL - totalCreditPL;
        }

         

        // Calculate final debit and credit totals
        const finalDebit = totalDebitPL + netProfit;
        const finalCredit = totalCreditPL + netLoss;

        const result = {
            // tradingAccount: {
            //     debit: [
            //         { openingStock },
            //         { purchases },
            //         { directExpenses },
            //         ...(carryForwardType === "debit" ? [{ grossProfit: carryForward }] : [])
            //     ],
            //     credit: [
            //         { sales },
            //         { closingStock },
            //         ...(carryForwardType === "credit" ? [{ grossLoss: carryForward }] : [])
            //     ]
            // },
            // profitAndLossAccount: {
                debit: [
                    ...(grossLoss > 0 ? [{ "grossLossCd": grossLoss }] : [{ "grossLossCd" : 0 }]),
                    { indirectExpenses },
                    ...(netProfit > 0 ? [{ netProfit: netProfit }] : [{ netProfit: 0 }])
                ],
                credit: [
                    ...(grossProfit > 0 ? [{ "grossProfitCd": grossProfit }] : [{ "grossProfitCd": 0 }]),
                    { indirectIncome },
                    ...(netLoss > 0 ? [{ netLoss: netLoss }] : [{ netLoss: 0 }])
                ],
            // },
            summary: {
                finalDebit,
                finalCredit,
                grossProfit,
                grossLoss,
                netProfit, 
                netLoss
            }
        };

        res.status(200).json({ success: true, data: result });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: error.message });
    }
};

  

















exports.calculateBalanceSheet = async (req, res) => {
    try {
        const { organizationId } = req.user;
        const { startDate, endDate } = req.params;

        const { organizationExists } = await dataExist(organizationId);
        const start = parseDate(organizationExists.timeZoneExp, startDate);
        const end = parseDate(organizationExists.timeZoneExp, endDate, true);

        validateDates(start, end);

        // Trading Account Calculations
        const openingStock = await getOpeningBalance( organizationExists, organizationId, start);
        const closingStock = await getClosingBalance( organizationExists, organizationId, end);

        const purchases = await getReportAccount(organizationExists, organizationId, start, end, 'Cost of Goods Sold');
        const sales = await getReportAccount(organizationExists, organizationId, start, end, 'Sales');
        const directExpenses = await getReportAccount(organizationExists, organizationId, start, end, 'Direct Expense');

        // Profit and Loss Calculations
        const indirectIncome = await getReportAccount(organizationExists, organizationId, start, end, 'Indirect Income');
        const indirectExpenses = await getReportAccount(organizationExists, organizationId, start, end, 'Indirect Expense');

        // Balance Sheet Calculations
        const currentAssets = await getReportAccountForAssets(organizationExists, organizationId, start, end);
        const nonCurrentAssets = await getReportAccount(organizationExists, organizationId, start, end, 'Non-Current Asset');
        const nonCurrentLiabilities = await getReportAccount(organizationExists, organizationId, start, end, 'Non-Current Liability');
        const currentLiabilities = await getReportAccountForLiability(organizationExists, organizationId, start, end);
        const equity = await getReportAccount(organizationExists, organizationId, start, end, 'Equity');

        // Gross Profit/Loss Calculation
        const totalDebitTradingAccount = openingStock.total + purchases.overallNetDebit + directExpenses.overallNetDebit - purchases.overallNetCredit - directExpenses.overallNetCredit;
        const totalCreditTradingAccount = sales.overallNetCredit + closingStock.total - sales.overallNetDebit;

        let grossProfit = 0, grossLoss = 0;

        if (totalCreditTradingAccount > totalDebitTradingAccount) {
            grossProfit = totalCreditTradingAccount - totalDebitTradingAccount;
        } else if (totalDebitTradingAccount > totalCreditTradingAccount) {
            grossLoss = totalDebitTradingAccount - totalCreditTradingAccount;
        }

        // Net Profit/Loss Calculation
        const totalDebitPL = grossLoss + indirectExpenses.overallNetDebit - indirectExpenses.overallNetCredit;
        const totalCreditPL = grossProfit + indirectIncome.overallNetCredit - indirectIncome.overallNetDebit;

        let netProfit = 0, netLoss = 0;

        if (totalCreditPL > totalDebitPL) {
            netProfit = totalCreditPL - totalDebitPL;
        } else if (totalDebitPL > totalCreditPL) {
            netLoss = totalDebitPL - totalCreditPL;
        }

        // Balance sheet calculation
        const totalCreditBS = netProfit + equity.overallNetCredit + currentLiabilities.overallNetCredit + nonCurrentLiabilities.overallNetCredit - equity.overallNetDebit - currentLiabilities.overallNetDebit - nonCurrentLiabilities.overallNetDebit;
        const totalDebitBS = netLoss + currentAssets.overallNetDebit + nonCurrentAssets.overallNetDebit - currentAssets.overallNetCredit - nonCurrentAssets.overallNetCredit + closingStock.total;

        // Calculate final debit and credit totals
        const finalDebit = totalDebitBS;
        const finalCredit = totalCreditBS;        

        // Add closing stock to current assets
        currentAssets.overallNetDebit += closingStock.total;
        currentAssets.data.unshift({
            accountName: "Closing Stock",
            overallNetDebit: closingStock.total,
            overallNetCredit: 0,
            entries: closingStock.items
        });

        const result = {
            debit: [
                { currentAssets },
                { nonCurrentAssets },
                ...(netLoss > 0 ? [{ "netLossCd": netLoss }] : [{ "netLossCd": 0 }])

            ],
            credit: [
                { equity },
                { currentLiabilities },
                { nonCurrentLiabilities },
                ...(netProfit > 0 ? [{ "netProfitCd": netProfit }] : [{ "netProfitCd": 0 }])

            ],
            summary: {
                grossProfit,
                grossLoss,
                netProfit,
                netLoss,
                finalDebit,
                finalCredit,
                isBalanced: finalDebit === finalCredit
            }
        };

        res.status(200).json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};















async function calculateOpeningStock( organizationExists, organizationId, startDate) {
    try {
        
        if (!startDate || isNaN(new Date(startDate).getTime())) {
            throw new Error("Invalid startDate.");
        }

        // Ensure startDate is a Date object
        const formattedStartDate = new Date(startDate);

        // Convert the date to the organization's timezone and format
        const convertedStartDate = convertToOrganizationTime(formattedStartDate, organizationExists.timeZoneExp, organizationExists.dateFormatExp, organizationExists.dateSplit);

        // Aggregate to calculate opening stock
        const itemStocks = await ItemTrack.aggregate([
            {
                $match: {
                    organizationId: organizationId, 
                    createdDateTime: { $lt: convertedStartDate }
                }
            },
            {
                $sort: { createdDateTime: 1 }
            },
            {
                $group: {
                    _id: "$itemId",
                    totalDebit: { $sum: { $ifNull: ["$debitQuantity", 0] } },
                    totalCredit: { $sum: { $ifNull: ["$creditQuantity", 0] } },
                    lastCostPrice: {
                        $last: {
                            $cond: [
                                { $ne: ["$costPrice", null] },
                                "$costPrice",
                                0
                            ]
                        }
                    },
                    entries: {
                        $push: {
                            createdDateTime: "$createdDateTime",
                            debitQuantity: { $ifNull: ["$debitQuantity", 0] },
                            creditQuantity: { $ifNull: ["$creditQuantity", 0] },
                            costPrice: { $ifNull: ["$costPrice", 0] }
                        }
                    }
                }
            },
            {
                $lookup: {
                    from: "items",
                    localField: "_id",
                    foreignField: "_id",
                    as: "itemDetails"
                }
            },
            {
                $unwind: {
                    path: "$itemDetails",
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $project: {
                    _id: 1,
                    totalDebit: 1,
                    totalCredit: 1,
                    lastCostPrice: 1,
                    entries: 1,
                    itemName: "$itemDetails.itemName"
                }
            }
        ]);

        // Calculate total opening stock value
        const total = itemStocks.reduce((total, item) => {
            const quantity = (item.totalDebit || 0) - (item.totalCredit || 0);
            const value = quantity * (item.lastCostPrice || 0);
            return total + value;
        }, 0);

        // Prepare the result
        const result = {
            items: itemStocks || [],
            total: total || 0
        };

        // console.log("calculateOpeningStock result:", JSON.stringify(result, null, 2));
        return result;
    } catch (error) {
        console.error("Error in calculateOpeningStock:", error);
        throw error;
    }
}


async function calculateClosingStock( organizationExists, organizationId, endDate) {
    try {
        // Validate input
        if (!organizationId || !endDate || isNaN(endDate)) {
            throw new Error("Invalid organizationId or endDate.");
        }

        // Ensure endDate is a Date object
        const formattedEndDate = new Date(endDate);

        // Convert the date to the organization's timezone and format
        const convertedEndDate = convertToOrganizationTime(formattedEndDate, organizationExists.timeZoneExp, organizationExists.dateFormatExp, organizationExists.dateSplit);


        // Aggregate to calculate closing stock
        const itemStocks = await ItemTrack.aggregate([
            {
                $match: {
                    organizationId: organizationId,
                    createdDateTime: { $lte: convertedEndDate }
                }
            },
            {
                $sort: { createdDateTime: 1 } // Sort by date to ensure correct order
            },
            {
                $group: {
                    _id: "$itemId",
                    totalDebit: { $sum: { $ifNull: ["$debitQuantity", 0] } },
                    totalCredit: { $sum: { $ifNull: ["$creditQuantity", 0] } },
                    lastCostPrice: {
                        $last: {
                            $cond: [
                                { $ne: ["$costPrice", null] },
                                "$costPrice",
                                0
                            ]
                        }
                    },
                    entries: {
                        $push: {
                            createdDateTime: "$createdDateTime",
                            debitQuantity: { $ifNull: ["$debitQuantity", 0] },
                            creditQuantity: { $ifNull: ["$creditQuantity", 0] },
                            costPrice: { $ifNull: ["$costPrice", 0] }
                        }
                    }
                }
            },
            {
                $lookup: {
                    from: 'items',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'itemDetails'
                }
            },
            {
                $unwind: {
                    path: '$itemDetails',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $project: {
                    _id: 1,
                    totalDebit: 1,
                    totalCredit: 1,
                    lastCostPrice: 1,
                    entries: 1,
                    itemName: "$itemDetails.itemName"
                }
            }
        ]);

        // Calculate total closing stock value
        const total = itemStocks.reduce((total, item) => {
            const quantity = (item.totalDebit || 0) - (item.totalCredit || 0);
            return total + (quantity * (item.lastCostPrice || 0));
        }, 0);

        // Prepare the result
        const result = {
            items: itemStocks || [],
            total: total || 0
        };

        // console.log('calculateClosingStock result:', JSON.stringify(result, null, 2));
        return result;
    } catch (error) {
        console.error('Error in calculateClosingStock:', error);
        throw error;
    }
}




function convertToOrganizationTime(date, timeZone, dateFormat, dateSplit) {
    // Use moment-timezone to convert the date to the organization's timezone and format
    const format = dateFormat.replace(/-/g, dateSplit);
    const convertedDate = moment(date).tz(timeZone).format(format);
    return new Date(convertedDate);
}


















































async function getCurrentAssetAccount11(organizationId, startDate, endDate) {
    // Compute opening balance
    const openingBalanceData = await TrialBalance.aggregate([
        {
            $match: {
                organizationId,
                createdDateTime: { $lt: startDate },
                $or: [{ debitAmount: { $gt: 0 } }, { creditAmount: { $gt: 0 } }]
            }
        },
        {
            $lookup: {
                from: 'accounts',
                localField: 'accountId',
                foreignField: '_id',
                as: 'account'
            }
        },
        { $unwind: '$account' },
        { $match: { 'account.accountSubhead': { $in: ['Current Asset', 'Cash', 'Bank'] } } },
        {
            $group: {
                _id: null,
                totalDebit: { $sum: '$debitAmount' },
                totalCredit: { $sum: '$creditAmount' }
            }
        }
    ]);

    const openingBalance = openingBalanceData.length > 0 ? openingBalanceData[0] : {
        totalDebit: 0,
        totalCredit: 0
    };

    // Fetch sales data within the given date range
    const currentAssetsData = await TrialBalance.aggregate([
        {
            $match: {
                organizationId,
                createdDateTime: { $gte: startDate, $lte: endDate },
                $or: [{ debitAmount: { $gt: 0 } }, { creditAmount: { $gt: 0 } }]
            }
        },
        {
            $lookup: {
                from: 'accounts',
                localField: 'accountId',
                foreignField: '_id',
                as: 'account'
            }
        },
        { $unwind: '$account' },
        { $match: { 'account.accountSubhead': { $in: ['Current Asset', 'Cash', 'Bank'] } } },
        {
            $group: {
                _id: {
                    accountSubhead: '$account.accountSubhead',
                    accountId: '$accountId',
                    accountName: '$account.accountName',
                    month: { $dateToString: { format: "%B %Y", date: "$createdDateTime" } }
                },
                trialBalance: {
                    $push: {
                        _id: '$_id',
                        operationId: '$operationId',
                        transactionId: '$transactionId',
                        action: '$action',
                        remark: '$remark',
                        debitAmount: '$debitAmount',
                        creditAmount: '$creditAmount',
                        createdDateTime: '$createdDateTime'
                    }
                },
                totalDebit: { $sum: '$debitAmount' },
                totalCredit: { $sum: '$creditAmount' }
            }
        },
        {
            $project: {
                _id: 0,
                accountSubhead: '$_id.accountSubhead',
                accounts: {
                    accountName: '$_id.accountName',
                    accountId: '$_id.accountId',
                    month: '$_id.month',
                    trialBalance: '$trialBalance',
                    totalDebit: { $ifNull: ['$totalDebit', 0] },
                    totalCredit: { $ifNull: ['$totalCredit', 0] },
                    netDebit: {
                        $cond: { if: { $gt: ['$totalDebit', '$totalCredit'] }, then: { $subtract: ['$totalDebit', '$totalCredit'] }, else: 0 }
                    },
                    netCredit: {
                        $cond: { if: { $gt: ['$totalCredit', '$totalDebit'] }, then: { $subtract: ['$totalCredit', '$totalDebit'] }, else: 0 }
                    }
                }
            }
        },
        {
            $group: {
                _id: "$accountSubhead",
                accounts: { $push: "$accounts" },
                totalDebit: { $sum: "$accounts.totalDebit" },
                totalCredit: { $sum: "$accounts.totalCredit" },
                netDebit: { $sum: "$accounts.netDebit" },
                netCredit: { $sum: "$accounts.netCredit" }
            }
        },
        {
            $project: {
                _id: 0,
                accountSubhead: "$_id",
                accounts: 1,
                totalDebit: { $ifNull: ["$totalDebit", 0] },
                totalCredit: { $ifNull: ["$totalCredit", 0] },
                netDebit: { $ifNull: ["$netDebit", 0] },
                netCredit: { $ifNull: ["$netCredit", 0] }
            }
        },
        {
            $group: {
                _id: null,
                currentAssets: { $push: "$$ROOT" },
                overallTotalDebit: { $sum: { $ifNull: ["$totalDebit", 0] } },
                overallTotalCredit: { $sum: { $ifNull: ["$totalCredit", 0] } },
                overallNetDebit: { $sum: { $ifNull: ["$netDebit", 0] } },
                overallNetCredit: { $sum: { $ifNull: ["$netCredit", 0] } }
            }
        },
        {
            $project: {
                _id: 0,
                currentAssets: 1,
                overallTotalDebit: { $ifNull: ["$overallTotalDebit", 0] },
                overallTotalCredit: { $ifNull: ["$overallTotalCredit", 0] },
                overallNetDebit: { $ifNull: ["$overallNetDebit", 0] },
                overallNetCredit: { $ifNull: ["$overallNetCredit", 0] }
            }
        }
    ]);

    // Merge opening balance manually (outside aggregation)
    let result = currentAssetsData.length > 0 ? currentAssetsData[0] : {
        currentAssets: [],
        overallTotalDebit: 0,
        overallTotalCredit: 0,
        overallNetDebit: 0,
        overallNetCredit: 0
    };

    // **Updating overallNetDebit and overallNetCredit with opening balance**
    result.overallNetDebit += openingBalance.totalDebit;
    result.overallNetCredit += openingBalance.totalCredit;
    
    // Add opening balance to result
    result.openingBalance = openingBalance;

    return result;
}