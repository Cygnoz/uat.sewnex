const TrialBalances = require('../database/model/trialBalance');
const Accounts = require('../database/model/account');
const Organization = require('../database/model/organization');
const moment = require('moment');

const { singleCustomDateTime, multiCustomDateTime } = require("../services/timeConverter");

const dataExist = async ( organizationId ) => {    
    const [organizationExists ] = await Promise.all([
      Organization.findOne({ organizationId },{ timeZoneExp: 1, dateFormatExp: 1, dateSplit: 1, organizationCountry: 1 }).lean(),
    ]);
    return { organizationExists };
  };

exports.getDayBook = async (req, res) => {
    try {
        const { startDate, endDate } = req.params; 
        const { organizationId } = req.user;

        const { organizationExists } = await dataExist( organizationId );

        if (!organizationExists) {
            return res.status(404).json({
                success: false,
                message: "Organization not found"
            });
        }

        // Validate date format (DD-MM-YYYY) for both dates
        if (!startDate || !endDate || 
            !/^\d{2}-\d{2}-\d{4}$/.test(startDate) || 
            !/^\d{2}-\d{2}-\d{4}$/.test(endDate)) {
            return res.status(400).json({
                success: false,
                message: "Invalid date format. Please use DD-MM-YYYY for both dates"
            });
        }

        // Convert DD-MM-YYYY to YYYY-MM-DD for both dates
        const [startDay, startMonth, startYear] = startDate.split('-');
        const [endDay, endMonth, endYear] = endDate.split('-');
        // const formattedStartDate = `${startYear}-${startMonth}-${startDay}`;
        // const formattedEndDate = `${endYear}-${endMonth}-${endDay}`;

        // Validate if both dates are valid  
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

        console.log(`Converted Date Range: Start = ${formattedStartDate}, End = ${formattedEndDate}`);

        // Create start and end dates with time
        // const start = new Date(`${formattedStartDate}T00:00:00`);
        // const end = new Date(`${formattedEndDate}T23:59:59`);

        // Validate date range
        if (formattedStartDate > formattedEndDate) {
            return res.status(400).json({
                success: false,
                message: "Start date cannot be after end date"
            });
        }

        // Convert to UTC
        // const startUTC = start.toISOString();
        // const endUTC = end.toISOString();
                    

        // Find all transactions for the given date range
        const transactions = await TrialBalances.aggregate([
            {
                $match: {
                    organizationId: organizationId,
                    createdDateTime: {
                        $gte: new Date(formattedStartDate),
                        $lte: new Date(formattedEndDate)
                    },
                    $or: [
                        { debitAmount: { $gt: 0 } },  
                        { creditAmount: { $gt: 0 } }
                    ]
                }
            },
            {
                $sort: {
                    createdDateTime: 1
                }
            },
            {
                $group: {
                    _id: "$transactionId",
                    entries: { 
                        $push: {
                            $mergeObjects: ["$$ROOT", {
                                sortDate: "$createdDateTime"
                            }]
                        }
                    },
                    firstCreatedDateTime: { $first: "$createdDateTime" },
                    totalDebit: { $sum: "$debitAmount" },
                    totalCredit: { $sum: "$creditAmount" }
                }
            },
            {
                $match: {
                    _id: { $ne: "OB" }  // Remove entries where transactionId is "OB"
                }
            },
            {
                $sort: {
                    firstCreatedDateTime: 1
                }
            },
            {
                $lookup: {
                    from: "accounts",
                    let: { entries: "$entries" },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $in: ["$_id", {
                                        $map: {
                                            input: "$$entries",
                                            as: "entry",
                                            in: { $toObjectId: "$$entry.accountId" }
                                        }
                                    }]
                                }
                            }
                        }
                    ],
                    as: "accountDetails"
                }
            }
        ]);        
        

        // Format the response and calculate cumulative totals
        let cumulativeTotalDebit = 0;
        let cumulativeTotalCredit = 0;

        const formattedTransactions = transactions.map(transaction => {
            const totalDebit = transaction.totalDebit || 0;
            const totalCredit = transaction.totalCredit || 0;

            // Update cumulative totals
            cumulativeTotalDebit += totalDebit;
            cumulativeTotalCredit += totalCredit;

            // Extract date from the first entry's createdDateTime and format it
            const date = transaction.entries.length > 0 && transaction.entries[0].createdDateTime 
                ? moment(transaction.entries[0].createdDateTime).tz(orgTimezone).format(organizationExists.dateFormatExp.split('-').join(organizationExists.dateSplit)) 
                : null;


            // Safely find account details
            const entries = transaction.entries.map(entry => {
                const accountDetail = transaction.accountDetails?.find(
                    acc => acc._id && acc._id.toString() === entry.accountId?.toString()
                );

                return {
                    accountName: accountDetail ? accountDetail.accountName : 'Unknown Account',
                    debitAmount: entry.debitAmount || 0,
                    creditAmount: entry.creditAmount || 0,
                    remark: entry.remark,
                    operationId: entry.operationId,
                    createdDateTime: entry.createdDateTime,
                    action: entry.action
                };
            });

            return {
                transactionId: transaction._id,
                date,
                entries,
                totalDebit,
                totalCredit,
                trialBalanceId: transaction._id
            };
        });

        res.status(200).json({
            success: true,
            data: formattedTransactions,
            totals: {
                totalDebit: cumulativeTotalDebit.toFixed(2),
                totalCredit: cumulativeTotalCredit.toFixed(2)
            },
            debug: {
                dateRange: {
                    start: formattedStartDate,
                    end: formattedEndDate
                },
                timezone: organizationExists.timeZone,
                rawTransactionsCount: transactions.length
            }
        });

    } catch (error) {
        console.error('Error in getDayBook:', error);
        res.status(500).json({
            success: false,
            message: error.message,
            debug: {
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            }
        });
    }
};



// Helper function to validate date
function isValidDate(day, month, year) {
    // Convert to integers
    const d = parseInt(day, 10);
    const m = parseInt(month, 10);
    const y = parseInt(year, 10);

    // Check ranges
    if (y < 1000 || y > 3000 || m < 1 || m > 12) return false;

    const monthLength = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

    // Adjust February for leap years
    if (y % 400 === 0 || (y % 100 !== 0 && y % 4 === 0)) {
        monthLength[1] = 29;
    }

    // Check day range
    return d > 0 && d <= monthLength[m - 1];
}


