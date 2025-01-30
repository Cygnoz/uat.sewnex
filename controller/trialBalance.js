const TrialBalances = require('../database/model/trialBalance');
const Accounts = require('../database/model/account');
const Organization = require('../database/model/organization');
const moment = require('moment');

exports.getTrialBalance = async (req, res) => {
    try {
        const { startDate, endDate } = req.params;
        const { organizationId } = req.user;

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
        const formattedStartDate = `${startYear}-${startMonth}-${startDay}`;
        const formattedEndDate = `${endYear}-${endMonth}-${endDay}`;

        const start = new Date(`${formattedStartDate}T00:00:00`);
        const end = new Date(`${formattedEndDate}T23:59:59`);

        // Validate date range
        if (start > end) {
            return res.status(400).json({
                success: false,
                message: "Start date cannot be after end date"
            });
        }

        // Convert to UTC
        const startUTC = start.toISOString();
        const endUTC = end.toISOString();

        // Get organization's timezone
        const organization = await Organization.findOne({ organizationId });
        if (!organization) {
            return res.status(404).json({
                success: false,
                message: "Organization not found"
            });
        }

        // Find all transactions for the given date range
        const transactions = await TrialBalances.find({
            organizationId: organizationId,
            createdDateTime: {
                $gte: new Date(startUTC),
                $lte: new Date(endUTC)
            }
        }).populate('accountId', 'accountName accountSubhead accountHead accountGroup');

        // Restructure the response
        const accountMap = {};

        transactions.forEach(transaction => {
            const totalDebit = transaction.debitAmount || 0;
            const totalCredit = transaction.creditAmount || 0;
            const accountSubHead = transaction.accountId ? transaction.accountId.accountSubhead : 'Uncategorized';
            const accountName = transaction.accountId ? transaction.accountId.accountName : 'Unknown Account';
            const transactionDate = moment(transaction.createdDateTime).format('MMMM YYYY'); // Format as "January 2025"

            // Initialize accountSubHead if it doesn't exist
            if (!accountMap[accountSubHead]) {
                accountMap[accountSubHead] = {
                    accountSubHead,
                    totalDebit: 0,
                    totalCredit: 0,
                    accounts: {}
                };
            }

            // Update totals for the account subhead
            accountMap[accountSubHead].totalDebit += totalDebit;
            accountMap[accountSubHead].totalCredit += totalCredit;

            // Initialize accountName if it doesn't exist
            if (!accountMap[accountSubHead].accounts[accountName]) {
                accountMap[accountSubHead].accounts[accountName] = {
                    accountName,
                    totalDebit: 0,
                    totalCredit: 0,
                    months: {}
                };
            }

            // Update totals for the account name
            accountMap[accountSubHead].accounts[accountName].totalDebit += totalDebit;
            accountMap[accountSubHead].accounts[accountName].totalCredit += totalCredit;

            // Initialize month if it doesn't exist
            if (!accountMap[accountSubHead].accounts[accountName].months[transactionDate]) {
                accountMap[accountSubHead].accounts[accountName].months[transactionDate] = {
                    date: transactionDate,
                    totalDebit: 0,
                    totalCredit: 0,
                    data: []
                };
            }

            // Update totals for the month
            accountMap[accountSubHead].accounts[accountName].months[transactionDate].totalDebit += totalDebit;
            accountMap[accountSubHead].accounts[accountName].months[transactionDate].totalCredit += totalCredit;

            // Add transaction data for the month
            accountMap[accountSubHead].accounts[accountName].months[transactionDate].data.push({
                _id: transaction._id,
                organizationId: transaction.organizationId,
                operationId: transaction.operationId,
                transactionId: transaction.transactionId,
                accountId: transaction.accountId._id,
                accountName: transaction.accountId.accountName,
                accountSubhead: transaction.accountId.accountSubhead,
                accountHead: transaction.accountId.accountHead,
                accountGroup: transaction.accountId.accountGroup,
                action: transaction.action,
                debitAmount: totalDebit,
                creditAmount: totalCredit,
                createdDateTime: transaction.createdDateTime,
                createdDate: moment(transaction.createdDateTime).format('DD/MMM/YYYY'),
                createdTime: moment(transaction.createdDateTime).format('hh:mm:ss A'),
            });
        });

        // Convert accountMap to an array
        const responseData = Object.values(accountMap).map(account => {
            return {
                accountSubHead: account.accountSubHead,
                totalDebit: account.totalDebit,
                totalCredit: account.totalCredit,
                accounts: Object.values(account.accounts).map(acc => ({
                    accountName: acc.accountName,
                    totalDebit: acc.totalDebit,
                    totalCredit: acc.totalCredit,
                    months: Object.values(acc.months).map(month => ({
                        date: month.date,
                        totalDebit: month.totalDebit,
                        totalCredit: month.totalCredit,
                        data: month.data
                    }))
                }))
            };
        });

        res.status(200).json({
            success: true,
            data: responseData,
            debug: {
                dateRange: {
                    start: startUTC,
                    end: endUTC
                },
                timezone: organization.timeZone
            }
        });

    } catch (error) {
        console.error('Error in getTrialBalance:', error);
        res.status(500).json({
            success: false,
            message: error.message,
            debug: {
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            }
        });
    }
};

// Helper function to validate date (same as in dayBook.js)
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
