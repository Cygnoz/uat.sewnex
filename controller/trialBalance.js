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

        // Debugging: Log the organizationId and date range
        console.log('Organization ID:', organizationId);
        console.log('Date Range:', { startUTC, endUTC });

        // Find all transactions for the given date range
        const transactions = await TrialBalances.find({
            organizationId: organizationId,
            createdDateTime: {
                $gte: new Date(startUTC),
                $lte: new Date(endUTC)
            }
        }).populate('accountId', 'accountName accountSubhead accountHead accountGroup');

        // Debugging: Log the transactions fetched
        // console.log('Fetched Transactions:', transactions);

        // Restructure the response
        const accountMap = {};

        let cumulativeDebit = 0;
        let cumulativeCredit = 0;

        transactions.forEach(transaction => {
            // Log each transaction being processed
            // console.log('Processing Transaction:', transaction);

            // Check if the transaction has at least one of the necessary fields
            if (transaction.debitAmount === undefined && transaction.creditAmount === undefined) {
                console.warn('Transaction missing both debitAmount and creditAmount:', transaction);
                return; // Skip this transaction if it doesn't have either field
            }

            const accountSubHead = transaction.accountId ? transaction.accountId.accountSubhead : 'Uncategorized'; // Use a default if not defined
            const totalDebit = transaction.debitAmount || 0; // Default to 0 if undefined
            const totalCredit = transaction.creditAmount || 0; // Default to 0 if undefined

            // Initialize accountSubHead if it doesn't exist
            if (!accountMap[accountSubHead]) {
                accountMap[accountSubHead] = {
                    accountSubHead,
                    totalDebit: 0,
                    totalCredit: 0,
                    entries: []
                };
            }

            // Update cumulative totals
            cumulativeDebit += totalDebit;
            cumulativeCredit += totalCredit;

            // Update account totals
            accountMap[accountSubHead].totalDebit += totalDebit;
            accountMap[accountSubHead].totalCredit += totalCredit;

            // Add entry to the accountSubHead
            accountMap[accountSubHead].entries.push({
                accountName: transaction.accountId ? transaction.accountId.accountName : 'Unknown Account', // Use accountName from populated data
                totalDebit,
                totalCredit,
                accountHead: transaction.accountId ? transaction.accountId.accountHead : 'Unknown Head', // Use accountHead from populated data
                accountGroup: transaction.accountId ? transaction.accountId.accountGroup : 'Unknown Group', // Use accountGroup from populated data
                entries: [] // Assuming no nested entries
            });
        });

        // Convert accountMap to an array
        const responseData = Object.values(accountMap).map(account => {
            const totalDebit = account.totalDebit;
            const totalCredit = account.totalCredit;

            // Calculate the absolute difference
            const total = Math.abs(totalDebit - totalCredit);

            // Determine which total to show based on the absolute difference
            return {
                accountSubHead: account.accountSubHead,
                totalDebit: totalDebit > totalCredit ? total : undefined, // Set totalDebit to total if greater, else undefined
                totalCredit: totalCredit > totalDebit ? total : undefined, // Set totalCredit to total if greater, else undefined
                entries: account.entries // Keep the entries intact
            };
        }).filter(account => account.totalDebit !== undefined || account.totalCredit !== undefined); // Filter out accounts with both totals undefined

        // Calculate the absolute difference
        const x = Math.abs(cumulativeDebit - cumulativeCredit);

        // Determine which total to show in summary
        const totalDebit = cumulativeDebit > cumulativeCredit ? x : 0;
        const totalCredit = cumulativeCredit > cumulativeDebit ? x : 0;

        res.status(200).json({
            success: true,
            data: responseData,
            summary: {
                totalDebit,
                totalCredit,
                difference: x,
                balance: (cumulativeDebit > cumulativeCredit ? `${totalDebit} (Dr)` : `${totalCredit} (Cr)`)
            },
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
