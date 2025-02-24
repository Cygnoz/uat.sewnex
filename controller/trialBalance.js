const TrialBalances = require('../database/model/trialBalance');
const Organization = require('../database/model/organization');
const ItemTrack = require('../database/model/itemTrack');
const moment = require('moment');

const { singleCustomDateTime } = require("../services/timeConverter");

// Get one and All
const dataExist = async (organizationId) => {
    const [organizationExists] = await Promise.all([
        Organization.findOne({ organizationId }, { timeZoneExp: 1, dateFormatExp: 1, dateSplit: 1, organizationCountry: 1 }).lean(),
    ]);
    return { organizationExists };
};

exports.getTrialBalance = async (req, res) => {
    try {
        const { startDate, endDate } = req.params;
        const { organizationId } = req.user;

        const { organizationExists } = await dataExist(organizationId);

        if (!organizationExists) {
            return res.status(404).json({
                success: false,
                message: "Organization not found"
            });
        }

        if (!startDate || !endDate ||
            !/^\d{2}-\d{2}-\d{4}$/.test(startDate) ||
            !/^\d{2}-\d{2}-\d{4}$/.test(endDate)) {
            return res.status(400).json({
                success: false,
                message: "Invalid date format. Please use DD-MM-YYYY for both dates"
            });
        }

        const [startDay, startMonth, startYear] = startDate.split('-');
        const [endDay, endMonth, endYear] = endDate.split('-');

        if (!isValidDate(startDay, startMonth, startYear) ||
            !isValidDate(endDay, endMonth, endYear)) {
            return res.status(400).json({
                success: false,
                message: "Invalid date values"
            });
        }

        const orgTimezone = organizationExists.timeZoneExp || 'UTC';

        // Convert DD-MM-YYYY to YYYY-MM-DD
        const formattedStartDate = moment.tz(startDate, "DD-MM-YYYY", orgTimezone).startOf('day').utc().toISOString();
        const formattedEndDate = moment.tz(endDate, "DD-MM-YYYY", orgTimezone).endOf('day').utc().toISOString();

        if (formattedStartDate > formattedEndDate) {
            return res.status(400).json({
                success: false,
                message: "Start date cannot be after end date"
            });
        }

        const openingStock = await getOpeningBalance(organizationId, formattedStartDate);

        const transactions = await TrialBalances.find({
            organizationId,
            createdDateTime: {
                $gte: new Date(formattedStartDate),
                $lte: new Date(formattedEndDate)
            },
            $or: [
                { debitAmount: { $gt: 0 } },
                { creditAmount: { $gt: 0 } }
            ]
        }).populate('accountId', 'accountName accountSubhead accountHead accountGroup').lean();

        const accountMap = {};
        let netDebit = 0;
        let netCredit = 0;

        transactions.forEach(transaction => {
            let debit = transaction.debitAmount || 0;
            let credit = transaction.creditAmount || 0;

            if (debit === 0 && credit === 0) return;

            if (debit > credit) {
                debit -= credit;
                credit = 0;
            } else if (credit > debit) {
                credit -= debit;
                debit = 0;
            }

            const accountSubHead = transaction.accountId?.accountSubhead || 'Uncategorized';
            const accountName = transaction.accountId?.accountName || 'Unknown Account';
            const transactionDate = moment(transaction.createdDateTime).format('MMMM YYYY');
            const formattedObjects = singleCustomDateTime(transaction, organizationExists.dateFormatExp, organizationExists.timeZoneExp, organizationExists.dateSplit);

            if (!accountMap[accountSubHead]) {
                accountMap[accountSubHead] = {
                    accountSubHead,
                    totalDebit: 0,
                    totalCredit: 0,
                    accounts: {}
                };
            }

            accountMap[accountSubHead].totalDebit += debit;
            accountMap[accountSubHead].totalCredit += credit;

            if (!accountMap[accountSubHead].accounts[accountName]) {
                accountMap[accountSubHead].accounts[accountName] = {
                    accountName,
                    totalDebit: 0,
                    totalCredit: 0,
                    months: []
                };
            }

            accountMap[accountSubHead].accounts[accountName].totalDebit += debit;
            accountMap[accountSubHead].accounts[accountName].totalCredit += credit;

            let monthData = accountMap[accountSubHead].accounts[accountName].months.find(month => month.date === transactionDate);
            if (!monthData) {
                monthData = {
                    date: transactionDate,
                    totalDebit: 0,
                    totalCredit: 0,
                    data: []
                };
                accountMap[accountSubHead].accounts[accountName].months.push(monthData);
            }

            monthData.totalDebit += debit;
            monthData.totalCredit += credit;
            monthData.data.push({
                _id: transaction._id,
                organizationId: transaction.organizationId,
                operationId: transaction.operationId,
                transactionId: transaction.transactionId,
                accountId: transaction.accountId?._id,
                accountName: transaction.accountId?.accountName,
                accountSubhead: transaction.accountId?.accountSubhead,
                accountHead: transaction.accountId?.accountHead,
                accountGroup: transaction.accountId?.accountGroup,
                action: transaction.action,
                debitAmount: debit,
                creditAmount: credit,
                createdDateTime: transaction.createdDateTime,
                createdDate: formattedObjects.createdDate,
                createdTime: formattedObjects.createdTime,
            });
        });

        function adjustBalance(obj) {
            if (obj.totalDebit > obj.totalCredit) {
                obj.totalDebit -= obj.totalCredit;
                obj.totalCredit = 0;
            } else if (obj.totalCredit > obj.totalDebit) {
                obj.totalCredit -= obj.totalDebit;
                obj.totalDebit = 0;
            }else{
                obj.totalCredit = 0;
                obj.totalDebit = 0;
            }
        }

        Object.values(accountMap).forEach(accountSubHead => {
            adjustBalance(accountSubHead);
            Object.values(accountSubHead.accounts).forEach(account => {
                adjustBalance(account);
                account.months.forEach(month => {
                    adjustBalance(month);
                });
            });
        });

        const responseData = Object.values(accountMap)
            .filter(account => account.totalDebit > 0 || account.totalCredit > 0)
            .map(account => ({
                accountSubHead: account.accountSubHead,
                totalDebit: account.totalDebit.toFixed(2),
                totalCredit: account.totalCredit.toFixed(2),
                accounts: Object.values(account.accounts)
                    .filter(acc => acc.totalDebit > 0 || acc.totalCredit > 0)
                    .map(acc => ({
                        accountName: acc.accountName,
                        totalDebit: acc.totalDebit.toFixed(2),
                        totalCredit: acc.totalCredit.toFixed(2),
                        months: acc.months
                            .filter(month => month.totalDebit > 0 || month.totalCredit > 0)
                            .map(month => ({
                                date: month.date,
                                totalDebit: month.totalDebit.toFixed(2),
                                totalCredit: month.totalCredit.toFixed(2),
                                data: month.data
                            }))
                    }))
            }));

        const currentAssetIndex = responseData.findIndex(data => data.accountSubHead === 'Current Asset');
        const openingStockDate = moment(formattedStartDate).format('MMMM YYYY');
        
        const openingStockData = openingStock.items.map(item => ({
            _id: item._id,
            organizationId: organizationId,
            transactionId: item.itemName,
            itemQuantity: item.totalDebit,
            debitAmount: (item.totalDebit * item.lastCostPrice).toFixed(2),
            creditAmount: item.totalCredit,
            createdDateTime: formattedStartDate,
            createdDate: moment(formattedStartDate).format(organizationExists.dateFormatExp),
            createdTime: moment(formattedStartDate).format('HH:mm:ss A')
        }));

        if (currentAssetIndex !== -1) {
            responseData[currentAssetIndex].totalDebit = (parseFloat(responseData[currentAssetIndex].totalDebit) + openingStock.total).toFixed(2);
            const currentAssetAccounts = responseData[currentAssetIndex].accounts;
            const inventoryAssetIndex = currentAssetAccounts.findIndex(account => account.accountName === 'Inventory Asset');

            if (inventoryAssetIndex !== -1) {
                currentAssetAccounts[inventoryAssetIndex].totalDebit = (parseFloat(currentAssetAccounts[inventoryAssetIndex].totalDebit) + openingStock.total).toFixed(2);
                let monthData = currentAssetAccounts[inventoryAssetIndex].months.find(month => month.date === openingStockDate);
                if (!monthData) {
                    monthData = {
                        date: openingStockDate,
                        totalDebit: 0,
                        totalCredit: 0,
                        data: []
                    };
                    currentAssetAccounts[inventoryAssetIndex].months.push(monthData);
                }
                monthData.totalDebit += openingStock.total;
                monthData.data.push(...openingStockData);
            } else {
                const newAccount = {
                    accountName: 'Inventory Asset',
                    totalDebit: openingStock.total.toFixed(2),
                    totalCredit: 0.00,
                    months: [{
                        date: openingStockDate,
                        totalDebit: openingStock.total.toFixed(2),
                        totalCredit: 0.00,
                        data: openingStockData
                    }]
                };
                currentAssetAccounts.push(newAccount);
            }
        } else {
            responseData.unshift({
                accountSubHead: 'Current Asset',
                totalDebit: openingStock.total.toFixed(2),
                totalCredit: 0.00,
                accounts: [{
                    accountName: 'Inventory Asset',
                    totalDebit: openingStock.total.toFixed(2),
                    totalCredit: 0.00,
                    months: [{
                        date: openingStockDate,
                        totalDebit: openingStock.total.toFixed(2),
                        totalCredit: 0.00,
                        data: openingStockData
                    }]
                }],
            });
        }

        responseData.forEach(data => {
            netDebit += parseFloat(data.totalDebit);
            netCredit += parseFloat(data.totalCredit);
        });

        const currentAssetData = responseData.find(data => data.accountSubHead === 'Current Asset');
        adjustBalance(currentAssetData);

        res.status(200).json({
            success: true,
            data: responseData,
            summary: {
                totalDebit: netDebit.toFixed(2),
                totalCredit: netCredit.toFixed(2),
                ...(netCredit > netDebit ? { final: `${(netCredit - netDebit).toFixed(2)}(Cr)` } : {}),
                ...(netDebit > netCredit ? { final: `${(netDebit - netCredit).toFixed(2)}(Dr)` } : {})
            },
            debug: {
                dateRange: {
                    start: formattedStartDate,
                    end: formattedEndDate
                },
                timezone: organizationExists.timeZoneExp
            }
        });

    } catch (error) {
        console.error('Error in getTrialBalance:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Helper function to validate date
function isValidDate(day, month, year) {
    const d = parseInt(day, 10);
    const m = parseInt(month, 10);
    const y = parseInt(year, 10);

    if (y < 1000 || y > 3000 || m < 1 || m > 12) return false;

    const monthLength = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

    if (y % 400 === 0 || (y % 100 !== 0 && y % 4 === 0)) {
        monthLength[1] = 29;
    }

    return d > 0 && d <= monthLength[m - 1];
}

async function getOpeningBalance(organizationId, startDate) {
    const openingStock = await calculateOpeningStock(organizationId, startDate);
    return {
        items: openingStock.items,
        total: openingStock.total
    };
}

async function calculateOpeningStock(organizationId, startDate) {
    try {
        if (!startDate || isNaN(new Date(startDate).getTime())) {
            throw new Error("Invalid startDate.");
        }

        const formattedStartDate = new Date(startDate);

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

        const total = itemStocks.reduce((total, item) => {
            const quantity = (item.totalDebit || 0) - (item.totalCredit || 0);
            const value = quantity * (item.lastCostPrice || 0);
            return total + value;
        }, 0);

        const result = {
            items: itemStocks || [],
            total: total || 0
        };

        return result;
    } catch (error) {
        console.error("Error in calculateOpeningStock:", error);
        throw error;
    }
}