const ItemTrack = require("../database/model/itemTrack");
const TrialBalance = require("../database/model/trialBalance");
const Account = require("../database/model/account");
const mongoose = require('mongoose');

// Trading Account Function
exports.calculateTradingAccount = async (req, res) => {
    try {
        const { organizationId } = req.user;
        const { startDate, endDate } = req.params;
        
        console.log('Trading Account Params:', { organizationId, startDate, endDate });
        
        // Fix date parsing
        const [startDay, startMonth, startYear] = startDate.split('-');
        const [endDay, endMonth, endYear] = endDate.split('-');
        
        const start = new Date(startYear, startMonth - 1, startDay, 0, 0, 0);
        const end = new Date(endYear, endMonth - 1, endDay, 23, 59, 59);

        console.log('Parsed Dates:', { 
            start: start.toISOString(), 
            end: end.toISOString(),
            isStartValid: !isNaN(start),
            isEndValid: !isNaN(end)
        });

        // Validate dates
        if (isNaN(start) || isNaN(end)) {
            return res.status(400).json({ 
                message: "Invalid date format. Please use DD-MM-YYYY format" 
            });
        }

        // Add data validation check
        const itemTrackCount = await ItemTrack.countDocuments({ organizationId });
        const trialBalanceCount = await TrialBalance.countDocuments({ organizationId });

        console.log('Data Validation:', {
            itemTrackCount,
            trialBalanceCount,
            organizationId
        });

        // Get Opening Stock Details
        console.log('Calculating Opening Stock...');
        const openingStockDetails = await calculateOpeningStock(organizationId, start);
        console.log('Opening Stock Details:', JSON.stringify(openingStockDetails, null, 2));

        // Add collection validation in helper functions
        if (openingStockDetails.items.length === 0) {
            console.log('No ItemTrack records found for opening stock calculation');
        }

        // Get Closing Stock Details
        console.log('Calculating Closing Stock...');
        const closingStockDetails = await calculateClosingStock(organizationId, end);
        console.log('Closing Stock Details:', JSON.stringify(closingStockDetails, null, 2));

        // Add collection validation in helper functions
        if (closingStockDetails.items.length === 0) {
            console.log('No ItemTrack records found for closing stock calculation');
        }

        // Get Trading Account Transactions
        console.log('Getting Trading Account Transactions...');
        const tradingAccountData = await getTradeAccountTransactions(organizationId, start, end);
        console.log('Trading Account Data:', JSON.stringify(tradingAccountData, null, 2));

        // Add collection validation in helper functions
        if (!tradingAccountData.sales.entries.length && !tradingAccountData.costOfGoodsSold.entries.length) {
            console.log('No TrialBalance records found for trading account transactions');
        }

        // Calculate Trading Account Result
        console.log('Calculating Trading Result with:', {
            openingStock: openingStockDetails.total,
            closingStock: closingStockDetails.total,
            sales: tradingAccountData.sales.total,
            costOfGoodsSold: tradingAccountData.costOfGoodsSold.total
        });

        const tradingResult = calculateTradingResult(
            openingStockDetails.total,
            closingStockDetails.total,
            tradingAccountData.sales.total,
            tradingAccountData.costOfGoodsSold.total
        );

        console.log('Trading Result:', tradingResult);

        // Prepare final result
        const result = {
            openingStock: {
                items: openingStockDetails.items.map(item => {
                    const quantity = Number(((item.totalDebit || 0) - (item.totalCredit || 0)).toFixed(2));
                    const costPrice = Number((item.lastCostPrice || 0).toFixed(2));
                    const value = Number((quantity * costPrice).toFixed(2));
                    
                    const mappedItem = {
                        itemId: item._id || null,
                        itemName: item.itemName || 'Unknown Item',
                        quantity,
                        costPrice,
                        value
                    };
                    console.log('Mapped Opening Stock Item:', mappedItem);
                    return mappedItem;
                }),
                total: Number((openingStockDetails.total || 0).toFixed(2))
            },
            closingStock: {
                items: closingStockDetails.items.map(item => {
                    const quantity = Number(((item.totalDebit || 0) - (item.totalCredit || 0)).toFixed(2));
                    const costPrice = Number((item.lastCostPrice || 0).toFixed(2));
                    const value = Number((quantity * costPrice).toFixed(2));
                    
                    const mappedItem = {
                        itemId: item._id || null,
                        itemName: item.itemName || 'Unknown Item',
                        quantity,
                        costPrice,
                        value
                    };
                    console.log('Mapped Closing Stock Item:', mappedItem);
                    return mappedItem;
                }),
                total: Number((closingStockDetails.total || 0).toFixed(2))
            },
            sales: {
                entries: tradingAccountData.sales.entries.map(entry => {
                    const mappedEntry = {
                        date: entry.createdDateTime || new Date(),
                        amount: Number((entry.creditAmount || 0).toFixed(2)),
                        reference: entry.transactionId || 'No Reference'
                    };
                    console.log('Mapped Sales Entry:', mappedEntry);
                    return mappedEntry;
                }),
                total: Number((tradingAccountData.sales.total || 0).toFixed(2))
            },
            costOfGoodsSold: {
                entries: tradingAccountData.costOfGoodsSold.entries.map(entry => {
                    const mappedEntry = {
                        date: entry.createdDateTime || new Date(),
                        amount: Number((entry.debitAmount || 0).toFixed(2)),
                        reference: entry.transactionId || 'No Reference'
                    };
                    console.log('Mapped COGS Entry:', mappedEntry);
                    return mappedEntry;
                }),
                total: Number((tradingAccountData.costOfGoodsSold.total || 0).toFixed(2))
            },
            summary: {
                totalDebit: Number((tradingResult.totalDebit || 0).toFixed(2)),
                totalCredit: Number((tradingResult.totalCredit || 0).toFixed(2)),
                grossProfit: Number((tradingResult.grossProfit || 0).toFixed(2)),
                grossLoss: Number((tradingResult.grossLoss || 0).toFixed(2))
            }
        };

        console.log('Final Trading Account Result:', JSON.stringify(result, null, 2));

        // Log MongoDB queries for debugging
        console.log('MongoDB Query for ItemTrack:', {
            organizationId,
            createdDateTime: { $lt: start }
        });

        console.log('MongoDB Query for TrialBalance:', {
            organizationId,
            createdDateTime: {
                $gte: start,
                $lte: end
            }
        });

        res.status(200).json(result);
    } catch (error) {
        console.error("Error calculating trading account:", error);
        console.error("Error stack:", error.stack);
        res.status(500).json({ message: "Internal server error" });
    }
};

async function calculateOpeningStock(organizationId, startDate) {
    console.log('calculateOpeningStock called with:', { 
        organizationId, 
        startDate: startDate.toISOString() 
    });
    
    // First check if we have any records at all
    const totalRecords = await ItemTrack.countDocuments({ organizationId });
    console.log(`Total ItemTrack records for org ${organizationId}:`, totalRecords);

    // Check date range
    const dateRange = await ItemTrack.aggregate([
        {
            $match: { organizationId }
        },
        {
            $group: {
                _id: null,
                minDate: { $min: "$createdDateTime" },
                maxDate: { $max: "$createdDateTime" }
            }
        }
    ]);
    console.log('ItemTrack date range:', dateRange);

    const itemStocks = await ItemTrack.aggregate([
        {
            $match: {
                organizationId,
                createdDateTime: { $lt: startDate }
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
    
    console.log('ItemTrack aggregate result:', JSON.stringify(itemStocks, null, 2));
    
    const total = itemStocks.reduce((total, item) => {
        const quantity = (item.totalDebit || 0) - (item.totalCredit || 0);
        const value = quantity * (item.lastCostPrice || 0);
        console.log('Item calculation:', {
            itemId: item._id,
            quantity,
            lastCostPrice: item.lastCostPrice,
            value
        });
        return total + value;
    }, 0);

    const result = { 
        items: itemStocks || [], 
        total: total || 0 
    };
    
    console.log('calculateOpeningStock result:', JSON.stringify(result, null, 2));
    return result;
}

async function calculateClosingStock(organizationId, endDate) {
    const itemStocks = await ItemTrack.aggregate([
        {
            $match: {
                organizationId,
                createdDateTime: { $lte: endDate }
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

    const total = itemStocks.reduce((total, item) => {
        const quantity = (item.totalDebit || 0) - (item.totalCredit || 0);
        return total + (quantity * (item.lastCostPrice || 0));
    }, 0);

    return { 
        items: itemStocks || [], 
        total: total || 0 
    };
}

async function getTradeAccountTransactions(organizationId, startDate, endDate) {
    console.log('getTradeAccountTransactions called with:', { 
        organizationId, 
        startDate: startDate.toISOString(), 
        endDate: endDate.toISOString() 
    });

    // Check if we have any trial balance records
    const totalRecords = await TrialBalance.countDocuments({ organizationId });
    console.log(`Total TrialBalance records for org ${organizationId}:`, totalRecords);

    // Check account mappings
    const accountMappings = await Account.find({
        organizationId,
        accountSubhead: { $in: ['Sales', 'Cost of Goods Sold'] }
    });
    console.log('Found account mappings:', accountMappings);

    const trialBalanceData = await TrialBalance.aggregate([
        {
            $match: {
                organizationId,
                createdDateTime: {
                    $gte: startDate,
                    $lte: endDate
                }
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
        {
            $unwind: '$account'
        },
        {
            $match: {
                'account.accountSubhead': {
                    $in: ['Sales', 'Cost of Goods Sold']
                }
            }
        },
        {
            $sort: { createdDateTime: 1 }
        },
        {
            $group: {
                _id: '$account.accountSubhead',
                entries: { 
                    $push: {
                        createdDateTime: '$createdDateTime',
                        debitAmount: { $ifNull: ['$debitAmount', 0] },
                        creditAmount: { $ifNull: ['$creditAmount', 0] },
                        transactionId: '$transactionId'
                    }
                },
                debitTotal: { $sum: { $ifNull: ['$debitAmount', 0] } },
                creditTotal: { $sum: { $ifNull: ['$creditAmount', 0] } }
            }
        }
    ]);
    
    console.log('TrialBalance aggregate result:', JSON.stringify(trialBalanceData, null, 2));
    
    const salesData = trialBalanceData.find(item => item._id === 'Sales') || { entries: [], creditTotal: 0 };
    const cogsData = trialBalanceData.find(item => item._id === 'Cost of Goods Sold') || { entries: [], debitTotal: 0 };

    console.log('Sales Data found:', JSON.stringify(salesData, null, 2));
    console.log('COGS Data found:', JSON.stringify(cogsData, null, 2));

    return {
        sales: {
            entries: salesData.entries,
            total: salesData.creditTotal
        },
        costOfGoodsSold: {
            entries: cogsData.entries,
            total: cogsData.debitTotal
        }
    };
}

function calculateTradingResult(openingStock, closingStock, sales, costOfGoodsSold) {
    const totalDebit = openingStock + costOfGoodsSold;
    const totalCredit = sales + closingStock;
    
    const grossProfit = totalCredit > totalDebit ? totalCredit - totalDebit : 0;
    const grossLoss = totalDebit > totalCredit ? totalDebit - totalCredit : 0;

    return {
        grossProfit,
        grossLoss,
        totalDebit: totalDebit + (grossProfit > 0 ? grossProfit : 0),
        totalCredit: totalCredit + (grossLoss > 0 ? grossLoss : 0)
    };
}

// Extract trading account calculation logic
async function getTradingAccountResult(organizationId, startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Get Opening Stock Details
    const openingStockDetails = await calculateOpeningStock(organizationId, start);

    // Get Closing Stock Details
    const closingStockDetails = await calculateClosingStock(organizationId, end);

    // Get Trading Account Transactions
    const tradingAccountData = await getTradeAccountTransactions(organizationId, start, end);

    // Calculate Trading Account Result
    const tradingResult = calculateTradingResult(
        openingStockDetails.total,
        closingStockDetails.total,
        tradingAccountData.sales.total,
        tradingAccountData.costOfGoodsSold.total
    );

    return {
        openingStock: openingStockDetails,
        closingStock: closingStockDetails,
        sales: tradingAccountData.sales,
        costOfGoodsSold: tradingAccountData.costOfGoodsSold,
        grossProfit: tradingResult.grossProfit,
        grossLoss: tradingResult.grossLoss
    };
}

// Profit and Loss Account Function
exports.calculateProfitAndLoss = async (req, res) => {
    try {
        const { organizationId } = req.user;
        const { startDate, endDate } = req.params;

        // Parse dates
        const [startDay, startMonth, startYear] = startDate.split('-');
        const [endDay, endMonth, endYear] = endDate.split('-');
        
        const start = new Date(startYear, startMonth - 1, startDay, 0, 0, 0);
        const end = new Date(endYear, endMonth - 1, endDay, 23, 59, 59);

        // Validate dates
        if (isNaN(start) || isNaN(end)) {
            return res.status(400).json({ 
                message: "Invalid date format. Please use DD-MM-YYYY format" 
            });
        }

        console.log('Calculating Trading Account Result...');
        const tradingResult = await getTradingAccountResult(organizationId, start, end);
        console.log('Trading Result:', tradingResult);
        
        // Get P&L related transactions
        console.log('Getting P&L Transactions...');
        const plData = await getProfitLossTransactions(organizationId, start, end);
        console.log('P&L Data:', plData);

        const result = {
            tradingResult: {
                grossProfit: Number((tradingResult.grossProfit || 0).toFixed(2)),
                grossLoss: Number((tradingResult.grossLoss || 0).toFixed(2))
            },
            income: {
                items: plData.income.map(item => ({
                    accountName: item._id || 'Unknown Account',
                    credit: Number((item.creditTotal || 0).toFixed(2)),
                    debit: Number((item.debitTotal || 0).toFixed(2)),
                    net: Number(((item.creditTotal || 0) - (item.debitTotal || 0)).toFixed(2)),
                    entries: (item.entries || []).map(entry => ({
                        date: entry.createdDateTime || new Date(),
                        credit: Number((entry.creditAmount || 0).toFixed(2)),
                        debit: Number((entry.debitAmount || 0).toFixed(2)),
                        reference: entry.transactionId || 'No Reference'
                    }))
                })),
                total: Number((plData.totalIncome || 0).toFixed(2))
            },
            expenses: {
                items: plData.expenses.map(item => ({
                    accountName: item._id || 'Unknown Account',
                    debit: Number((item.debitTotal || 0).toFixed(2)),
                    credit: Number((item.creditTotal || 0).toFixed(2)),
                    net: Number(((item.debitTotal || 0) - (item.creditTotal || 0)).toFixed(2)),
                    entries: (item.entries || []).map(entry => ({
                        date: entry.createdDateTime || new Date(),
                        debit: Number((entry.debitAmount || 0).toFixed(2)),
                        credit: Number((entry.creditAmount || 0).toFixed(2)),
                        reference: entry.transactionId || 'No Reference'
                    }))
                })),
                total: Number((plData.totalExpenses || 0).toFixed(2))
            },
            summary: {
                totalIncome: Number((tradingResult.grossProfit + (plData.totalIncome || 0)).toFixed(2)),
                totalExpenses: Number((plData.totalExpenses || 0).toFixed(2)),
                netProfit: Number((plData.netProfit || 0).toFixed(2)),
                netLoss: Number((plData.netLoss || 0).toFixed(2))
            }
        };

        console.log('Final P&L Result:', JSON.stringify(result, null, 2));
        res.status(200).json(result);

    } catch (error) {
        console.error("Error calculating P&L:", error);
        console.error("Error stack:", error.stack);
        res.status(500).json({ message: "Internal server error" });
    }
};

async function getProfitLossTransactions(organizationId, startDate, endDate) {
    // Get Income transactions (excluding Sales)
    const incomeData = await TrialBalance.aggregate([
        {
            $match: {
                organizationId,
                createdDateTime: {
                    $gte: startDate,
                    $lte: endDate
                }
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
        {
            $unwind: '$account'
        },
        {
            $match: {
                'account.accountHead': 'Income',
                'account.accountSubhead': { $ne: 'Sales' }
            }
        },
        {
            $sort: { createdDateTime: 1 }
        },
        {
            $group: {
                _id: '$account.accountName',
                entries: {
                    $push: {
                        createdDateTime: '$createdDateTime',
                        debitAmount: { $ifNull: ['$debitAmount', 0] },
                        creditAmount: { $ifNull: ['$creditAmount', 0] },
                        transactionId: '$transactionId'
                    }
                },
                debitTotal: { $sum: { $ifNull: ['$debitAmount', 0] } },
                creditTotal: { $sum: { $ifNull: ['$creditAmount', 0] } }
            }
        }
    ]);

    // Get Expense transactions (excluding COGS)
    const expenseData = await TrialBalance.aggregate([
        {
            $match: {
                organizationId,
                createdDateTime: {
                    $gte: startDate,
                    $lte: endDate
                }
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
        {
            $unwind: '$account'
        },
        {
            $match: {
                'account.accountHead': 'Expenses',
                'account.accountSubhead': { $ne: 'Cost of Goods Sold' }
            }
        },
        {
            $sort: { createdDateTime: 1 }
        },
        {
            $group: {
                _id: '$account.accountName',
                entries: {
                    $push: {
                        createdDateTime: '$createdDateTime',
                        debitAmount: { $ifNull: ['$debitAmount', 0] },
                        creditAmount: { $ifNull: ['$creditAmount', 0] },
                        transactionId: '$transactionId'
                    }
                },
                debitTotal: { $sum: { $ifNull: ['$debitAmount', 0] } },
                creditTotal: { $sum: { $ifNull: ['$creditAmount', 0] } }
            }
        }
    ]);

    const totalIncome = incomeData.reduce((total, item) => 
        total + (item.creditTotal - item.debitTotal), 0);
    const totalExpenses = expenseData.reduce((total, item) => 
        total + (item.debitTotal - item.creditTotal), 0);

    const netProfit = totalIncome > totalExpenses ? totalIncome - totalExpenses : 0;
    const netLoss = totalExpenses > totalIncome ? totalExpenses - totalIncome : 0;

    return {
        income: incomeData,
        expenses: expenseData,
        totalIncome,
        totalExpenses,
        netProfit,
        netLoss
    };
}

// Balance Sheet Function
exports.calculateBalanceSheet = async (req, res) => {
    try {
        const { organizationId } = req.user;
        const { endDate } = req.params;
        
        // Parse date
        const [day, month, year] = endDate.split('-');
        const end = new Date(year, month - 1, day, 23, 59, 59);

        // Validate date
        if (isNaN(end)) {
            return res.status(400).json({ 
                message: "Invalid date format. Please use DD-MM-YYYY format" 
            });
        }

        console.log('Calculating Balance Sheet for:', {
            organizationId,
            endDate: end.toISOString()
        });

        // Get balance sheet data with detailed transactions
        const balanceSheetData = await getBalanceSheetData(organizationId, end);
        console.log('Balance Sheet Data:', JSON.stringify(balanceSheetData, null, 2));
        
        // Get P&L result for current period
        const plResult = await getProfitLossForBalanceSheet(organizationId, end);
        console.log('P&L Result for Balance Sheet:', plResult);

        // Calculate totals with net profit/loss
        const result = {
            assets: {
                current: {
                    items: balanceSheetData.currentAssets.map(item => ({
                        accountName: item._id.accountName,
                        subhead: item._id.subhead,
                        balance: Number(Math.abs(item.balance).toFixed(2)),
                        transactions: item.entries.map(entry => ({
                            date: entry.createdDateTime,
                            debit: Number(entry.debitAmount.toFixed(2)),
                            credit: Number(entry.creditAmount.toFixed(2)),
                            reference: entry.transactionId
                        }))
                    })),
                    total: Number(balanceSheetData.currentAssetsTotal.toFixed(2))
                },
                fixed: {
                    items: balanceSheetData.fixedAssets.map(item => ({
                        accountName: item._id.accountName,
                        subhead: item._id.subhead,
                        balance: Number(Math.abs(item.balance).toFixed(2)),
                        transactions: item.entries.map(entry => ({
                            date: entry.createdDateTime,
                            debit: Number(entry.debitAmount.toFixed(2)),
                            credit: Number(entry.creditAmount.toFixed(2)),
                            reference: entry.transactionId
                        }))
                    })),
                    total: Number(balanceSheetData.fixedAssetsTotal.toFixed(2))
                }
            },
            liabilities: {
                current: {
                    items: balanceSheetData.currentLiabilities.map(item => ({
                        accountName: item._id.accountName,
                        subhead: item._id.subhead,
                        balance: Number(Math.abs(item.balance).toFixed(2)),
                        transactions: item.entries.map(entry => ({
                            date: entry.createdDateTime,
                            debit: Number(entry.debitAmount.toFixed(2)),
                            credit: Number(entry.creditAmount.toFixed(2)),
                            reference: entry.transactionId
                        }))
                    })),
                    total: Number(balanceSheetData.currentLiabilitiesTotal.toFixed(2))
                },
                longTerm: {
                    items: balanceSheetData.longTermLiabilities.map(item => ({
                        accountName: item._id.accountName,
                        subhead: item._id.subhead,
                        balance: Number(Math.abs(item.balance).toFixed(2)),
                        transactions: item.entries.map(entry => ({
                            date: entry.createdDateTime,
                            debit: Number(entry.debitAmount.toFixed(2)),
                            credit: Number(entry.creditAmount.toFixed(2)),
                            reference: entry.transactionId
                        }))
                    })),
                    total: Number(balanceSheetData.longTermLiabilitiesTotal.toFixed(2))
                }
            },
            equity: {
                capital: {
                    items: balanceSheetData.capital.map(item => ({
                        accountName: item._id.accountName,
                        subhead: item._id.subhead,
                        balance: Number(Math.abs(item.balance).toFixed(2)),
                        transactions: item.entries.map(entry => ({
                            date: entry.createdDateTime,
                            debit: Number(entry.debitAmount.toFixed(2)),
                            credit: Number(entry.creditAmount.toFixed(2)),
                            reference: entry.transactionId
                        }))
                    })),
                    total: Number(balanceSheetData.capitalTotal.toFixed(2))
                },
                reserves: {
                    items: [
                        ...balanceSheetData.reserves.map(item => ({
                            accountName: item._id.accountName,
                            subhead: item._id.subhead,
                            balance: Number(Math.abs(item.balance).toFixed(2)),
                            transactions: item.entries.map(entry => ({
                                date: entry.createdDateTime,
                                debit: Number(entry.debitAmount.toFixed(2)),
                                credit: Number(entry.creditAmount.toFixed(2)),
                                reference: entry.transactionId
                            }))
                        })),
                        // Add current period profit/loss
                        plResult.netProfit > 0 ? {
                            accountName: 'Current Period Profit',
                            subhead: 'Profit & Loss',
                            balance: Number(plResult.netProfit.toFixed(2))
                        } : {
                            accountName: 'Current Period Loss',
                            subhead: 'Profit & Loss',
                            balance: Number(plResult.netLoss.toFixed(2))
                        }
                    ],
                    total: Number((balanceSheetData.reservesTotal + 
                        (plResult.netProfit || -plResult.netLoss)).toFixed(2))
                }
            },
            summary: {
                totalAssets: Number((balanceSheetData.currentAssetsTotal + 
                    balanceSheetData.fixedAssetsTotal).toFixed(2)),
                totalLiabilities: Number((balanceSheetData.currentLiabilitiesTotal + 
                    balanceSheetData.longTermLiabilitiesTotal).toFixed(2)),
                totalEquity: Number((balanceSheetData.capitalTotal + 
                    balanceSheetData.reservesTotal + 
                    (plResult.netProfit || -plResult.netLoss)).toFixed(2))
            }
        };

        // Add closing stock to current assets
        const closingStock = {
            accountName: 'Closing Stock',
            subhead: 'Inventory',
            balance: Number(balanceSheetData.closingStock.toFixed(2))
        };
        result.assets.current.items.push(closingStock);
        result.assets.current.total += balanceSheetData.closingStock;
        result.summary.totalAssets += balanceSheetData.closingStock;

        // Verify balance sheet equation
        result.isBalanced = Math.abs(
            result.summary.totalAssets - 
            (result.summary.totalLiabilities + result.summary.totalEquity)
        ) < 0.01;

        res.status(200).json(result);
    } catch (error) {
        console.error("Error calculating Balance Sheet:", error);
        console.error("Error stack:", error.stack);
        res.status(500).json({ message: "Internal server error" });
    }
};

async function getBalanceSheetData(organizationId, endDate) {
    // Get all balance sheet accounts
    const balanceSheetAccounts = await TrialBalance.aggregate([
        {
            $match: {
                organizationId,
                createdDateTime: { $lte: endDate }
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
        {
            $unwind: '$account'
        },
        {
            $match: {
                'account.accountGroup': { $in: ['Asset', 'Liability', 'Equity'] }
            }
        },
        {
            $group: {
                _id: {
                    group: '$account.accountGroup',
                    head: '$account.accountHead',
                    subhead: '$account.accountSubhead',
                    accountName: '$account.accountName'
                },
                entries: {
                    $push: {
                        createdDateTime: '$createdDateTime',
                        debitAmount: { $ifNull: ['$debitAmount', 0] },
                        creditAmount: { $ifNull: ['$creditAmount', 0] },
                        transactionId: '$transactionId'
                    }
                },
                debitTotal: { $sum: { $ifNull: ['$debitAmount', 0] } },
                creditTotal: { $sum: { $ifNull: ['$creditAmount', 0] } },
                balance: {
                    $sum: { 
                        $subtract: [
                            { $ifNull: ['$debitAmount', 0] },
                            { $ifNull: ['$creditAmount', 0] }
                        ]
                    }
                }
            }
        },
        {
            $sort: {
                '_id.group': 1,
                '_id.head': 1,
                '_id.subhead': 1,
                '_id.accountName': 1
            }
        }
    ]);

    console.log('Balance Sheet Accounts:', JSON.stringify(balanceSheetAccounts, null, 2));

    // Get closing stock
    const closingStockData = await calculateClosingStock(organizationId, endDate);
    console.log('Closing Stock Data:', JSON.stringify(closingStockData, null, 2));

    // Categorize accounts
    const currentAssets = balanceSheetAccounts.filter(acc => 
        acc._id.group === 'Asset' && acc._id.head === 'Current Assets'
    ) || [];

    const fixedAssets = balanceSheetAccounts.filter(acc => 
        acc._id.group === 'Asset' && acc._id.head === 'Fixed Assets'
    ) || [];

    const currentLiabilities = balanceSheetAccounts.filter(acc => 
        acc._id.group === 'Liability' && acc._id.head === 'Current Liabilities'
    ) || [];

    const longTermLiabilities = balanceSheetAccounts.filter(acc => 
        acc._id.group === 'Liability' && acc._id.head === 'Long Term Liabilities'
    ) || [];

    const capital = balanceSheetAccounts.filter(acc => 
        acc._id.group === 'Equity' && acc._id.head === 'Capital'
    ) || [];

    const reserves = balanceSheetAccounts.filter(acc => 
        acc._id.group === 'Equity' && acc._id.head === 'Reserves'
    ) || [];

    // Calculate totals
    const currentAssetsTotal = currentAssets.reduce((total, item) => total + item.balance, 0);
    const fixedAssetsTotal = fixedAssets.reduce((total, item) => total + item.balance, 0);
    const currentLiabilitiesTotal = currentLiabilities.reduce((total, item) => total + item.balance, 0);
    const longTermLiabilitiesTotal = longTermLiabilities.reduce((total, item) => total + item.balance, 0);
    const capitalTotal = capital.reduce((total, item) => total + item.balance, 0);
    const reservesTotal = reserves.reduce((total, item) => total + item.balance, 0);

    console.log('Categorized Data:', {
        currentAssetsCount: currentAssets.length,
        fixedAssetsCount: fixedAssets.length,
        currentLiabilitiesCount: currentLiabilities.length,
        longTermLiabilitiesCount: longTermLiabilities.length,
        capitalCount: capital.length,
        reservesCount: reserves.length
    });

    return {
        currentAssets,
        fixedAssets,
        currentLiabilities,
        longTermLiabilities,
        capital,
        reserves,
        currentAssetsTotal,
        fixedAssetsTotal,
        currentLiabilitiesTotal,
        longTermLiabilitiesTotal,
        capitalTotal,
        reservesTotal,
        closingStock: closingStockData.total || 0
    };
}

function calculateBalanceSheetTotals(data, plResult) {
    let assets = {
        current: {
            items: [],
            total: 0
        },
        fixed: {
            items: [],
            total: 0
        },
        total: 0
    };
    
    let liabilities = {
        current: {
            items: [],
            total: 0
        },
        longTerm: {
            items: [],
            total: 0
        },
        total: 0
    };
    
    let equity = {
        capital: {
            items: [],
            total: 0
        },
        reserves: {
            items: [],
            total: 0
        },
        total: 0
    };

    // Process accounts
    data.accounts.forEach(account => {
        const balance = account.debitTotal - account.creditTotal;
        const item = {
            name: account._id.accountName,
            subhead: account._id.subhead,
            balance: Math.abs(balance)
        };

        switch(account._id.group) {
            case 'Asset':
                if (account._id.head === 'Current Assets') {
                    assets.current.items.push(item);
                    assets.current.total += balance;
                } else {
                    assets.fixed.items.push(item);
                    assets.fixed.total += balance;
                }
                assets.total += balance;
                break;
            
            case 'Liability':
                if (account._id.head === 'Current Liabilities') {
                    liabilities.current.items.push(item);
                    liabilities.current.total += balance;
                } else {
                    liabilities.longTerm.items.push(item);
                    liabilities.longTerm.total += balance;
                }
                liabilities.total += balance;
                break;
            
            case 'Equity':
                if (account._id.head === 'Capital') {
                    equity.capital.items.push(item);
                    equity.capital.total += balance;
                } else {
                    equity.reserves.items.push(item);
                    equity.reserves.total += balance;
                }
                equity.total += balance;
                break;
        }
    });

    // Add closing stock to current assets
    assets.current.items.push({
        name: 'Closing Stock',
        subhead: 'Inventory',
        balance: data.closingStock
    });
    assets.current.total += data.closingStock;
    assets.total += data.closingStock;

    // Add net profit/loss to equity
    if (plResult.netProfit > 0) {
        equity.reserves.items.push({
            name: 'Net Profit',
            subhead: 'Current Year Profit',
            balance: plResult.netProfit
        });
        equity.reserves.total += plResult.netProfit;
        equity.total += plResult.netProfit;
    } else if (plResult.netLoss > 0) {
        equity.reserves.items.push({
            name: 'Net Loss',
            subhead: 'Current Year Loss',
            balance: -plResult.netLoss
        });
        equity.reserves.total -= plResult.netLoss;
        equity.total -= plResult.netLoss;
    }

    return {
        assets: {
            current: assets.current,
            fixed: assets.fixed,
            total: assets.total
        },
        liabilitiesAndEquity: {
            liabilities: {
                current: liabilities.current,
                longTerm: liabilities.longTerm,
                total: liabilities.total
            },
            equity: {
                capital: equity.capital,
                reserves: equity.reserves,
                total: equity.total
            },
            total: liabilities.total + equity.total
        },
        isBalanced: Math.abs(assets.total - (liabilities.total + equity.total)) < 0.01
    };
}

async function getProfitLossForBalanceSheet(organizationId, endDate) {
    try {
        // Get first day of the financial year
        const startDate = new Date(endDate.getFullYear(), 3, 1); // April 1st
        if (endDate < startDate) {
            startDate.setFullYear(startDate.getFullYear() - 1);
        }

        console.log('Calculating P&L for Balance Sheet:', {
            organizationId,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString()
        });

        // Get Trading Account Result
        const tradingResult = await getTradingAccountResult(organizationId, startDate, endDate);
        
        // Get P&L Transactions
        const plData = await getProfitLossTransactions(organizationId, startDate, endDate);

        // Calculate final profit/loss
        const totalIncome = tradingResult.grossProfit + (plData.totalIncome || 0);
        const totalExpenses = plData.totalExpenses || 0;

        const netProfit = totalIncome > totalExpenses ? totalIncome - totalExpenses : 0;
        const netLoss = totalExpenses > totalIncome ? totalExpenses - totalIncome : 0;

        console.log('P&L Result for Balance Sheet:', {
            grossProfit: tradingResult.grossProfit,
            otherIncome: plData.totalIncome,
            totalExpenses: plData.totalExpenses,
            netProfit,
            netLoss
        });

        return {
            netProfit: Number(netProfit.toFixed(2)),
            netLoss: Number(netLoss.toFixed(2))
        };
    } catch (error) {
        console.error('Error calculating P&L for Balance Sheet:', error);
        return {
            netProfit: 0,
            netLoss: 0
        };
    }
}

