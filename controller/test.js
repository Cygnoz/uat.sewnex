const mongoose = require('mongoose');
const TrialBalance = require('../database/model/trialBalance');
const Account = require('../database/model/account');
const ItemTrack = require('../database/model/itemTrack');
const Organization = require("../database/model/organization");
const moment = require('moment-timezone');


// Fetch existing data
const dataExist = async ( organizationId ) => {
    const [organizationExists ] = await Promise.all([
      Organization.findOne({ organizationId }, { organizationId: 1, timeZoneExp: 1 }),
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
async function getOpeningBalance(organizationId, startDate) {
    const openingStock = await calculateOpeningStock(organizationId, startDate);
    return {
        items: openingStock.items,
        total: openingStock.total
    };
}

// 2. Closing Balance
async function getClosingBalance(organizationId, endDate) {
    const closingStock = await calculateClosingStock(organizationId, endDate);
    return {
        items: closingStock.items,
        total: closingStock.total
    };
}

// 3. Purchase Account (Cost of Goods Sold)//
async function getPurchaseAccount(organizationId, startDate, endDate) {
    const purchases = await TrialBalance.aggregate([
        {
            $match: {
                organizationId,
                createdDateTime: { $gte: startDate, $lte: endDate },
                $or: [
                    { debitAmount: { $gt: 0 } },
                    { creditAmount: { $gt: 0 } }
                ]            
            }
        },
        {
            $addFields: {
                totalDebit: "$debitAmount",
                totalCredit: "$creditAmount"
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
        {
            $match: {
                'account.accountSubhead': 'Cost of Goods Sold'
            }
        },
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
                        transactionId:'$transactionId',
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
                        $cond: {
                            if: { $gt: ['$totalDebit', '$totalCredit'] },
                            then: { $subtract: ['$totalDebit', '$totalCredit'] },
                            else: 0
                        }
                    },
                    netCredit: {
                        $cond: {
                            if: { $gt: ['$totalCredit', '$totalDebit'] },
                            then: { $subtract: ['$totalCredit', '$totalDebit'] },
                            else: 0
                        }
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
        // **Compute Overall Totals**
        {
            $group: {
                _id: null,
                purchases: { $push: "$$ROOT" },
                overallTotalDebit: { $sum: { $ifNull: ["$totalDebit", 0] } },
                overallTotalCredit: { $sum: { $ifNull: ["$totalCredit", 0] } },
                overallNetDebit: { $sum: { $ifNull: ["$netDebit", 0] } },
                overallNetCredit: { $sum: { $ifNull: ["$netCredit", 0] } }
            }
        },
        {
            $project: {
                _id: 0,
                purchases: 1,
                overallTotalDebit: { $ifNull: ["$overallTotalDebit", 0] },
                overallTotalCredit: { $ifNull: ["$overallTotalCredit", 0] },
                overallNetDebit: { $ifNull: ["$overallNetDebit", 0] },
                overallNetCredit: { $ifNull: ["$overallNetCredit", 0] }
            }
        }
    ]);

    return purchases.length > 0 ? purchases[0] : {
        purchases: [],
        overallTotalDebit: 0,
        overallTotalCredit: 0,
        overallNetDebit: 0,
        overallNetCredit: 0
    };
}

// 4. Sales Account(Sales)//
async function getSalesAccount(organizationId, startDate, endDate) {
    const sales = await TrialBalance.aggregate([
        {
            $match: {
                organizationId,
                createdDateTime: { $gte: startDate, $lte: endDate },
                $or: [
                    { debitAmount: { $gt: 0 } },
                    { creditAmount: { $gt: 0 } }
                ]            
            }
        },
        {
            $addFields: {
                totalDebit: "$debitAmount",
                totalCredit: "$creditAmount"
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
        {
            $match: {
                'account.accountSubhead': 'Sales'
            }
        },
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
                        transactionId:'$transactionId',
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
                        $cond: {
                            if: { $gt: ['$totalDebit', '$totalCredit'] },
                            then: { $subtract: ['$totalDebit', '$totalCredit'] },
                            else: 0
                        }
                    },
                    netCredit: {
                        $cond: {
                            if: { $gt: ['$totalCredit', '$totalDebit'] },
                            then: { $subtract: ['$totalCredit', '$totalDebit'] },
                            else: 0
                        }
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
                sales: { $push: "$$ROOT" },
                overallTotalDebit: { $sum: { $ifNull: ["$totalDebit", 0] } },
                overallTotalCredit: { $sum: { $ifNull: ["$totalCredit", 0] } },
                overallNetDebit: { $sum: { $ifNull: ["$netDebit", 0] } },
                overallNetCredit: { $sum: { $ifNull: ["$netCredit", 0] } }
            }
        },
        {
            $project: {
                _id: 0,
                sales: 1,
                overallTotalDebit: { $ifNull: ["$overallTotalDebit", 0] },
                overallTotalCredit: { $ifNull: ["$overallTotalCredit", 0] },
                overallNetDebit: { $ifNull: ["$overallNetDebit", 0] },
                overallNetCredit: { $ifNull: ["$overallNetCredit", 0] }
            }
        }
    ]);

    return sales.length > 0 ? sales[0] : {
        sales: [],
        overallTotalDebit: 0,
        overallTotalCredit: 0,
        overallNetDebit: 0,
        overallNetCredit: 0
    };
}


// 5. Direct Expense Account(Direct Expense)//
async function getDirectExpenseAccount(organizationId, startDate, endDate) {
    const directExpenses = await TrialBalance.aggregate([
        {
            $match: {
                organizationId,
                createdDateTime: { $gte: startDate, $lte: endDate },
                $or: [
                    { debitAmount: { $gt: 0 } },
                    { creditAmount: { $gt: 0 } }
                ]            
            }
        },
        {
            $addFields: {
                totalDebit: "$debitAmount",
                totalCredit: "$creditAmount"
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
        {
            $match: {
                'account.accountSubhead': 'Direct Expense'
            }
        },
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
                        transactionId:'$transactionId',
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
                        $cond: {
                            if: { $gt: ['$totalDebit', '$totalCredit'] },
                            then: { $subtract: ['$totalDebit', '$totalCredit'] },
                            else: 0
                        }
                    },
                    netCredit: {
                        $cond: {
                            if: { $gt: ['$totalCredit', '$totalDebit'] },
                            then: { $subtract: ['$totalCredit', '$totalDebit'] },
                            else: 0
                        }
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
                directExpenses: { $push: "$$ROOT" },
                overallTotalDebit: { $sum: { $ifNull: ["$totalDebit", 0] } },
                overallTotalCredit: { $sum: { $ifNull: ["$totalCredit", 0] } },
                overallNetDebit: { $sum: { $ifNull: ["$netDebit", 0] } },
                overallNetCredit: { $sum: { $ifNull: ["$netCredit", 0] } }
            }
        },
        {
            $project: {
                _id: 0,
                directExpenses: 1,
                overallTotalDebit: { $ifNull: ["$overallTotalDebit", 0] },
                overallTotalCredit: { $ifNull: ["$overallTotalCredit", 0] },
                overallNetDebit: { $ifNull: ["$overallNetDebit", 0] },
                overallNetCredit: { $ifNull: ["$overallNetCredit", 0] }
            }
        }
    ]);

    return directExpenses.length > 0 ? directExpenses[0] : {
        directExpenses: [],
        overallTotalDebit: 0,
        overallTotalCredit: 0,
        overallNetDebit: 0,
        overallNetCredit: 0
    };
}

// 6. Indirect Expense Account(Indirect Expense)//
async function getIndirectExpenseAccount(organizationId, startDate, endDate) {
    const indirectExpenses = await TrialBalance.aggregate([
        {
            $match: {
                organizationId,
                createdDateTime: { $gte: startDate, $lte: endDate },
                $or: [
                    { debitAmount: { $gt: 0 } },
                    { creditAmount: { $gt: 0 } }
                ]            
            }
        },
        {
            $addFields: {
                totalDebit: "$debitAmount",
                totalCredit: "$creditAmount"
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
        {
            $match: {
                'account.accountSubhead': 'Indirect Expense'
            }
        },
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
                        transactionId:'$transactionId',
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
                        $cond: {
                            if: { $gt: ['$totalDebit', '$totalCredit'] },
                            then: { $subtract: ['$totalDebit', '$totalCredit'] },
                            else: 0
                        }
                    },
                    netCredit: {
                        $cond: {
                            if: { $gt: ['$totalCredit', '$totalDebit'] },
                            then: { $subtract: ['$totalCredit', '$totalDebit'] },
                            else: 0
                        }
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
                indirectExpenses: { $push: "$$ROOT" },
                overallTotalDebit: { $sum: { $ifNull: ["$totalDebit", 0] } },
                overallTotalCredit: { $sum: { $ifNull: ["$totalCredit", 0] } },
                overallNetDebit: { $sum: { $ifNull: ["$netDebit", 0] } },
                overallNetCredit: { $sum: { $ifNull: ["$netCredit", 0] } }
            }
        },
        {
            $project: {
                _id: 0,
                indirectExpenses: 1,
                overallTotalDebit: { $ifNull: ["$overallTotalDebit", 0] },
                overallTotalCredit: { $ifNull: ["$overallTotalCredit", 0] },
                overallNetDebit: { $ifNull: ["$overallNetDebit", 0] },
                overallNetCredit: { $ifNull: ["$overallNetCredit", 0] }
            }
        }
    ]);

    return indirectExpenses.length > 0 ? indirectExpenses[0] : {
        indirectExpenses: [],
        overallTotalDebit: 0,
        overallTotalCredit: 0,
        overallNetDebit: 0,
        overallNetCredit: 0
    };
}

// 7. Indirect Income Account(Indirect Income)//
async function getIndirectIncomeAccount(organizationId, startDate, endDate) {
    const indirectIncome = await TrialBalance.aggregate([
        {
            $match: {
                organizationId,
                createdDateTime: { $gte: startDate, $lte: endDate },
                $or: [
                    { debitAmount: { $gt: 0 } },
                    { creditAmount: { $gt: 0 } }
                ]            
            }
        },
        {
            $addFields: {
                totalDebit: "$debitAmount",
                totalCredit: "$creditAmount"
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
        {
            $match: {
                'account.accountSubhead': 'Indirect Income'
            }
        },
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
                        transactionId:'$transactionId',
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
                        $cond: {
                            if: { $gt: ['$totalDebit', '$totalCredit'] },
                            then: { $subtract: ['$totalDebit', '$totalCredit'] },
                            else: 0
                        }
                    },
                    netCredit: {
                        $cond: {
                            if: { $gt: ['$totalCredit', '$totalDebit'] },
                            then: { $subtract: ['$totalCredit', '$totalDebit'] },
                            else: 0
                        }
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
                indirectIncome: { $push: "$$ROOT" },
                overallTotalDebit: { $sum: { $ifNull: ["$totalDebit", 0] } },
                overallTotalCredit: { $sum: { $ifNull: ["$totalCredit", 0] } },
                overallNetDebit: { $sum: { $ifNull: ["$netDebit", 0] } },
                overallNetCredit: { $sum: { $ifNull: ["$netCredit", 0] } }
            }
        },
        {
            $project: {
                _id: 0,
                indirectIncome: 1,
                overallTotalDebit: { $ifNull: ["$overallTotalDebit", 0] },
                overallTotalCredit: { $ifNull: ["$overallTotalCredit", 0] },
                overallNetDebit: { $ifNull: ["$overallNetDebit", 0] },
                overallNetCredit: { $ifNull: ["$overallNetCredit", 0] }
            }
        }
    ]);

    return indirectIncome.length > 0 ? indirectIncome[0] : {
        indirectIncome: [],
        overallTotalDebit: 0,
        overallTotalCredit: 0,
        overallNetDebit: 0,
        overallNetCredit: 0
    };
}

// 8. Equity Account(Equity)//
async function getEquityAccount(organizationId, startDate, endDate) {
    const equity = await TrialBalance.aggregate([
        {
            $match: {
                organizationId,
                createdDateTime: { $gte: startDate, $lte: endDate },
                $or: [
                    { debitAmount: { $gt: 0 } },
                    { creditAmount: { $gt: 0 } }
                ]            
            }
        },
        {
            $addFields: {
                totalDebit: "$debitAmount",
                totalCredit: "$creditAmount"
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
        {
            $match: {
                'account.accountSubhead': 'Equity'
            }
        },
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
                        transactionId:'$transactionId',
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
                        $cond: {
                            if: { $gt: ['$totalDebit', '$totalCredit'] },
                            then: { $subtract: ['$totalDebit', '$totalCredit'] },
                            else: 0
                        }
                    },
                    netCredit: {
                        $cond: {
                            if: { $gt: ['$totalCredit', '$totalDebit'] },
                            then: { $subtract: ['$totalCredit', '$totalDebit'] },
                            else: 0
                        }
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
        // **Compute Overall Totals**
        {
            $group: {
                _id: null,
                equity: { $push: "$$ROOT" },
                overallTotalDebit: { $sum: { $ifNull: ["$totalDebit", 0] } },
                overallTotalCredit: { $sum: { $ifNull: ["$totalCredit", 0] } },
                overallNetDebit: { $sum: { $ifNull: ["$netDebit", 0] } },
                overallNetCredit: { $sum: { $ifNull: ["$netCredit", 0] } }
            }
        },
        {
            $project: {
                _id: 0,
                equity: 1,
                overallTotalDebit: { $ifNull: ["$overallTotalDebit", 0] },
                overallTotalCredit: { $ifNull: ["$overallTotalCredit", 0] },
                overallNetDebit: { $ifNull: ["$overallNetDebit", 0] },
                overallNetCredit: { $ifNull: ["$overallNetCredit", 0] }
            }
        }
    ]);

    return equity.length > 0 ? equity[0] : {
        equity: [],
        overallTotalDebit: 0,
        overallTotalCredit: 0,
        overallNetDebit: 0,
        overallNetCredit: 0
    };
}

// 9. Current Liability Account(Current Liability)//
async function getCurrentLiabilityAccount(organizationId, startDate, endDate) {
    const currentLiabilities = await TrialBalance.aggregate([
        {
            $match: {
                organizationId,
                createdDateTime: { $gte: startDate, $lte: endDate },
                $or: [
                    { debitAmount: { $gt: 0 } },
                    { creditAmount: { $gt: 0 } }
                ]            
            }
        },
        {
            $addFields: {
                totalDebit: "$debitAmount",
                totalCredit: "$creditAmount"
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
        {
            $match: {
                'account.accountSubhead': 'Current Liability'
            }
        },
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
                        transactionId:'$transactionId',
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
                        $cond: {
                            if: { $gt: ['$totalDebit', '$totalCredit'] },
                            then: { $subtract: ['$totalDebit', '$totalCredit'] },
                            else: 0
                        }
                    },
                    netCredit: {
                        $cond: {
                            if: { $gt: ['$totalCredit', '$totalDebit'] },
                            then: { $subtract: ['$totalCredit', '$totalDebit'] },
                            else: 0
                        }
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
        // **Compute Overall Totals**
        {
            $group: {
                _id: null,
                currentLiabilities: { $push: "$$ROOT" },
                overallTotalDebit: { $sum: { $ifNull: ["$totalDebit", 0] } },
                overallTotalCredit: { $sum: { $ifNull: ["$totalCredit", 0] } },
                overallNetDebit: { $sum: { $ifNull: ["$netDebit", 0] } },
                overallNetCredit: { $sum: { $ifNull: ["$netCredit", 0] } }
            }
        },
        {
            $project: {
                _id: 0,
                currentLiabilities: 1,
                overallTotalDebit: { $ifNull: ["$overallTotalDebit", 0] },
                overallTotalCredit: { $ifNull: ["$overallTotalCredit", 0] },
                overallNetDebit: { $ifNull: ["$overallNetDebit", 0] },
                overallNetCredit: { $ifNull: ["$overallNetCredit", 0] }
            }
        }
    ]);

    return currentLiabilities.length > 0 ? currentLiabilities[0] : {
        currentLiabilities: [],
        overallTotalDebit: 0,
        overallTotalCredit: 0,
        overallNetDebit: 0,
        overallNetCredit: 0
    };
}

// 10. Non-Current Liability Account(Non-Current Liability)//
async function getNonCurrentLiabilityAccount(organizationId, startDate, endDate) {
    const nonCurrentLiabilities = await TrialBalance.aggregate([
        {
            $match: {
                organizationId,
                createdDateTime: { $gte: startDate, $lte: endDate },
                $or: [
                    { debitAmount: { $gt: 0 } },
                    { creditAmount: { $gt: 0 } }
                ]            
            }
        },
        {
            $addFields: {
                totalDebit: "$debitAmount",
                totalCredit: "$creditAmount"
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
        {
            $match: {
                'account.accountSubhead': 'Non-Current Liability'
            }
        },
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
                        transactionId:'$transactionId',
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
                        $cond: {
                            if: { $gt: ['$totalDebit', '$totalCredit'] },
                            then: { $subtract: ['$totalDebit', '$totalCredit'] },
                            else: 0
                        }
                    },
                    netCredit: {
                        $cond: {
                            if: { $gt: ['$totalCredit', '$totalDebit'] },
                            then: { $subtract: ['$totalCredit', '$totalDebit'] },
                            else: 0
                        }
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
        // **Compute Overall Totals**
        {
            $group: {
                _id: null,
                nonCurrentLiabilities: { $push: "$$ROOT" },
                overallTotalDebit: { $sum: { $ifNull: ["$totalDebit", 0] } },
                overallTotalCredit: { $sum: { $ifNull: ["$totalCredit", 0] } },
                overallNetDebit: { $sum: { $ifNull: ["$netDebit", 0] } },
                overallNetCredit: { $sum: { $ifNull: ["$netCredit", 0] } }
            }
        },
        {
            $project: {
                _id: 0,
                nonCurrentLiabilities: 1,
                overallTotalDebit: { $ifNull: ["$overallTotalDebit", 0] },
                overallTotalCredit: { $ifNull: ["$overallTotalCredit", 0] },
                overallNetDebit: { $ifNull: ["$overallNetDebit", 0] },
                overallNetCredit: { $ifNull: ["$overallNetCredit", 0] }
            }
        }
    ]);

    return nonCurrentLiabilities.length > 0 ? nonCurrentLiabilities[0] : {
        nonCurrentLiabilities: [],
        overallTotalDebit: 0,
        overallTotalCredit: 0,
        overallNetDebit: 0,
        overallNetCredit: 0
    };
}

// 11. Current Asset Account (including Cash and Bank)('account.accountSubhead': { $in: ['Current Asset', 'Cash', 'Bank'] })//
async function getCurrentAssetAccount(organizationId, startDate, endDate) {
    const currentAssets = await TrialBalance.aggregate([
        {
            $match: {
                organizationId,
                createdDateTime: { $gte: startDate, $lte: endDate },
                $or: [
                    { debitAmount: { $gt: 0 } },
                    { creditAmount: { $gt: 0 } }
                ]            
            }
        },
        {
            $addFields: {
                totalDebit: "$debitAmount",
                totalCredit: "$creditAmount"
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
        {
            $match: {
                'account.accountSubhead': { $in: ['Current Asset', 'Cash', 'Bank'] }
            }
        },
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
                        transactionId:'$transactionId',
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
                        $cond: {
                            if: { $gt: ['$totalDebit', '$totalCredit'] },
                            then: { $subtract: ['$totalDebit', '$totalCredit'] },
                            else: 0
                        }
                    },
                    netCredit: {
                        $cond: {
                            if: { $gt: ['$totalCredit', '$totalDebit'] },
                            then: { $subtract: ['$totalCredit', '$totalDebit'] },
                            else: 0
                        }
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
        // **Compute Overall Totals**
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

    return currentAssets.length > 0 ? currentAssets[0] : {
        currentAssets: [],
        overallTotalDebit: 0,
        overallTotalCredit: 0,
        overallNetDebit: 0,
        overallNetCredit: 0
    };
}

// 12. Non-Current Asset Account(Non-Current Asset)//
async function getNonCurrentAssetAccount(organizationId, startDate, endDate) {
    const nonCurrentAssets = await TrialBalance.aggregate([
        {
            $match: {
                organizationId,
                createdDateTime: { $gte: startDate, $lte: endDate },
                $or: [
                    { debitAmount: { $gt: 0 } },
                    { creditAmount: { $gt: 0 } }
                ]            
            }
        },
        {
            $addFields: {
                totalDebit: "$debitAmount",
                totalCredit: "$creditAmount"
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
        {
            $match: {
                'account.accountSubhead': 'Non-Current Asset'
            }
        },
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
                        transactionId:'$transactionId',
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
                        $cond: {
                            if: { $gt: ['$totalDebit', '$totalCredit'] },
                            then: { $subtract: ['$totalDebit', '$totalCredit'] },
                            else: 0
                        }
                    },
                    netCredit: {
                        $cond: {
                            if: { $gt: ['$totalCredit', '$totalDebit'] },
                            then: { $subtract: ['$totalCredit', '$totalDebit'] },
                            else: 0
                        }
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
        // **Compute Overall Totals**
        {
            $group: {
                _id: null,
                nonCurrentAssets: { $push: "$$ROOT" },
                overallTotalDebit: { $sum: { $ifNull: ["$totalDebit", 0] } },
                overallTotalCredit: { $sum: { $ifNull: ["$totalCredit", 0] } },
                overallNetDebit: { $sum: { $ifNull: ["$netDebit", 0] } },
                overallNetCredit: { $sum: { $ifNull: ["$netCredit", 0] } }
            }
        },
        {
            $project: {
                _id: 0,
                nonCurrentAssets: 1,
                overallTotalDebit: { $ifNull: ["$overallTotalDebit", 0] },
                overallTotalCredit: { $ifNull: ["$overallTotalCredit", 0] },
                overallNetDebit: { $ifNull: ["$overallNetDebit", 0] },
                overallNetCredit: { $ifNull: ["$overallNetCredit", 0] }
            }
        }
    ]);

    return nonCurrentAssets.length > 0 ? nonCurrentAssets[0] : {
        nonCurrentAssets: [],
        overallTotalDebit: 0,
        overallTotalCredit: 0,
        overallNetDebit: 0,
        overallNetCredit: 0
    };
}































exports.calculateTradingAccount = async (req, res) => {
    try {
        const { organizationId } = req.user;
        const { startDate, endDate } = req.params;

        const { organizationExists } = await dataExist(organizationId);   

        const start = parseDate(organizationExists.timeZoneExp, startDate);
        const end = parseDate(organizationExists.timeZoneExp, endDate, true);
        
        validateDates(start, end);

        const openingStock = await getOpeningBalance(organizationId, start);
        const closingStock = await getClosingBalance(organizationId, end);
        const purchases = await getPurchaseAccount(organizationId, start, end);
        const sales = await getSalesAccount(organizationId, start, end);
        const directExpenses = await getDirectExpenseAccount(organizationId, start, end);        
                
        const totalDebit = openingStock.total + purchases.overallTotalDebit + directExpenses.overallTotalDebit;
        const totalCredit = sales.overallTotalCredit + closingStock.total;

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

        const finalDebit = openingStock.total + purchases.overallTotalDebit + directExpenses.overallTotalDebit + grossProfit;
        const finalCredit = sales.overallTotalCredit + closingStock.total + grossLoss;

        const result = {
            debit: [
                { openingStock },
                { purchases },
                { directExpenses },
                ...(carryForwardType === "debit" ? [{ grossProfit: carryForward }] : [])
            ],
            credit: [
                { sales },
                { closingStock },
                ...(carryForwardType === "credit" ? [{ grossLoss: carryForward }] : [])
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

















exports.calculateProfitAndLoss11 = async (req, res) => {
    try {
        const { organizationId } = req.user;
        const { startDate, endDate } = req.params;

        const { organizationExists } = await dataExist(organizationId);   

        const start = parseDate(organizationExists.timeZoneExp, startDate);
        const end = parseDate(organizationExists.timeZoneExp, endDate, true);

        validateDates(start, end);

        // Trading Account Calculations
        const openingStock = await getOpeningBalance(organizationId, start);
        const closingStock = await getClosingBalance(organizationId, end);
        const purchases = await getPurchaseAccount(organizationId, start, end);
        const sales = await getSalesAccount(organizationId, start, end);
        const directExpenses = await getDirectExpenseAccount(organizationId, start, end);
        
        // Profit and Loss Calculations
        const indirectIncome = await getIndirectIncomeAccount(organizationId, start, end);
        const indirectExpenses = await getIndirectExpenseAccount(organizationId, start, end);

        // Calculate total debit and credit for gross profit/loss
        const totalDebit = openingStock.total + purchases.overallTotalDebit + directExpenses.overallTotalDebit;
        const totalCredit = sales.overallTotalCredit + closingStock.total;

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



        // Prepare the debit and credit structure for P&L
        const result = {
            debit: [
                ...(grossLoss > 0 ? [{ "Gross Loss (c/d)": carryForward }] : []),
                {
                    "Indirect Expense": [
                        {
                            "overallTotalDebit": indirectExpenses.overallTotalDebit,
                            "overallTotalCredit": indirectExpenses.overallTotalCredit,
                            "overallNetDebit": indirectExpenses.overallNetDebit,
                            "overallNetCredit": indirectExpenses.overallNetCredit
                        }
                    ]
                },
                ...(grossProfit > 0 ? [{ "Net Profit": grossProfit }] : []),
                ...(grossLoss > 0 ? [{ "Net Loss": grossLoss }] : [])
            ],
            credit: [
                ...(grossProfit > 0 ? [{ "Gross Profit (c/d)": carryForward }] : []),
                {
                    "Indirect Income": [
                        {
                            "overallTotalDebit": indirectIncome.overallTotalDebit,
                            "overallTotalCredit": indirectIncome.overallTotalCredit,
                            "overallNetDebit": indirectIncome.overallNetDebit,
                            "overallNetCredit": indirectIncome.overallNetCredit
                        }
                    ]
                },
                ...(grossProfit > 0 ? [{ "Net Profit": grossProfit }] : []),
                ...(grossLoss > 0 ? [{ "Net Loss": grossLoss }] : [])
            ],
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
        const openingStock = await getOpeningBalance(organizationId, start);
        const closingStock = await getClosingBalance(organizationId, end);
        const purchases = await getPurchaseAccount(organizationId, start, end);
        const sales = await getSalesAccount(organizationId, start, end);
        const directExpenses = await getDirectExpenseAccount(organizationId, start, end);

        // Profit and Loss Calculations
        const indirectIncome = await getIndirectIncomeAccount(organizationId, start, end);
        const indirectExpenses = await getIndirectExpenseAccount(organizationId, start, end);

        // Gross Profit/Loss Calculation
        const totalDebitTradingAccount = openingStock.total + purchases.overallTotalDebit + directExpenses.overallTotalDebit;
        const totalCreditTradingAccount = sales.overallTotalCredit + closingStock.total;

        
        let grossProfit = 0, grossLoss = 0;
        
        if (totalCreditTradingAccount > totalDebitTradingAccount) {
            grossProfit = totalCreditTradingAccount - totalDebitTradingAccount;
        } else if (totalDebitTradingAccount > totalCreditTradingAccount) {
            grossLoss = totalDebitTradingAccount - totalCreditTradingAccount;
        }

        // Net Profit/Loss Calculation
        const totalDebitPL = grossLoss + indirectExpenses.overallTotalDebit;
        const totalCreditPL = grossProfit + indirectIncome.overallTotalCredit;

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
                    ...(grossLoss > 0 ? [{ "Gross Loss (c/d)": grossLoss }] : []),
                    { indirectExpenses },
                    ...(netProfit > 0 ? [{ netProfit: netProfit }] : [])
                ],
                credit: [
                    ...(grossProfit > 0 ? [{ "Gross Profit (c/d)": grossProfit }] : []),
                    { indirectIncome },
                    ...(netLoss > 0 ? [{ netLoss: netLoss }] : [])
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
        const openingStock = await getOpeningBalance(organizationId, start);
        const closingStock = await getClosingBalance(organizationId, end);
        const purchases = await getPurchaseAccount(organizationId, start, end);
        const sales = await getSalesAccount(organizationId, start, end);
        const directExpenses = await getDirectExpenseAccount(organizationId, start, end);

        // Profit and Loss Calculations
        const indirectIncome = await getIndirectIncomeAccount(organizationId, start, end);
        const indirectExpenses = await getIndirectExpenseAccount(organizationId, start, end);

        //Balance Sheet Calculations
        const currentAssets = await getCurrentAssetAccount(organizationId, start, end);
        const nonCurrentAssets = await getNonCurrentAssetAccount(organizationId, start, end);
        const currentLiabilities = await getCurrentLiabilityAccount(organizationId, start, end);
        const nonCurrentLiabilities = await getNonCurrentLiabilityAccount(organizationId, start, end);
        const equity = await getEquityAccount(organizationId, start, end);



        // Gross Profit/Loss Calculation
        const totalDebitTradingAccount = openingStock.total + purchases.overallNetDebit + directExpenses.overallNetDebit;
        const totalCreditTradingAccount = sales.overallNetCredit + closingStock.total;

        
        let grossProfit = 0, grossLoss = 0;
        
        if (totalCreditTradingAccount > totalDebitTradingAccount) {
            grossProfit = totalCreditTradingAccount - totalDebitTradingAccount;
        } else if (totalDebitTradingAccount > totalCreditTradingAccount) {
            grossLoss = totalDebitTradingAccount - totalCreditTradingAccount;
        }

        // Net Profit/Loss Calculation
        const totalDebitPL = grossLoss + indirectExpenses.overallNetDebit;
        const totalCreditPL = grossProfit + indirectIncome.overallNetCredit;

        let netProfit = 0, netLoss = 0;

        if (totalCreditPL > totalDebitPL) {
            netProfit = totalCreditPL - totalDebitPL;
        } else if (totalDebitPL > totalCreditPL) {
            netLoss = totalDebitPL - totalCreditPL;
        }


        //Balance sheet calculation
        const totalDebitBS = netLoss +  equity.overallNetDebit +  currentLiabilities.overallNetDebit + nonCurrentLiabilities.overallNetDebit ;
        const totalCreditBS = netProfit + currentAssets.overallNetCredit +  nonCurrentAssets.overallNetCredit;

        let finalProfit = 0, finalLoss = 0;

        if (totalCreditBS > totalDebitBS) {
            finalProfit = totalCreditBS - totalDebitBS;
        } else if (totalDebitBS > totalCreditBS) {
            finalLoss = totalDebitBS - totalCreditBS;
        } 


        // Calculate final debit and credit totals
        const finalDebit = totalDebitBS ;
        const finalCredit = totalCreditBS ;




        // const totalAssets = currentAssets.totalDebit + nonCurrentAssets.totalDebit;
        // const totalLiabilities = currentLiabilities.totalCredit + nonCurrentLiabilities.totalCredit;
        // const totalEquity = equity.totalCredit;

        const result = {
            debit: [
                { equity },
                { currentLiabilities },
                { nonCurrentLiabilities },
                ...(netLoss > 0 ? [{ "Net Loss (c/d)": netLoss }] : [])
            ],
            credit: [
                { currentAssets },
                { nonCurrentAssets },
                ...(netProfit > 0 ? [{ "Net Profit (c/d)": netProfit }] : [])
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
















async function calculateOpeningStock(organizationId, startDate) {
    try {
        
        if (!startDate || isNaN(new Date(startDate).getTime())) {
            throw new Error("Invalid startDate.");
        }

        // Ensure startDate is a Date object
        const formattedStartDate = new Date(startDate);

        // Aggregate to calculate opening stock
        const itemStocks = await ItemTrack.aggregate([
            {
                $match: {
                    organizationId: organizationId, 
                    createdDateTime: { $lt: formattedStartDate }
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

        console.log("calculateOpeningStock result:", JSON.stringify(result, null, 2));
        return result;
    } catch (error) {
        console.error("Error in calculateOpeningStock:", error);
        throw error;
    }
}


async function calculateClosingStock(organizationId, endDate) {
    try {
        // Validate input
        if (!organizationId || !endDate || isNaN(endDate)) {
            throw new Error("Invalid organizationId or endDate.");
        }

        // Aggregate to calculate closing stock
        const itemStocks = await ItemTrack.aggregate([
            {
                $match: {
                    organizationId: organizationId,
                    createdDateTime: { $lte: endDate }
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

        console.log('calculateClosingStock result:', JSON.stringify(result, null, 2));
        return result;
    } catch (error) {
        console.error('Error in calculateClosingStock:', error);
        throw error;
    }
}





















































