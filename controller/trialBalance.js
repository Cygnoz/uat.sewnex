const TrialBalances = require('../database/model/trialBalance');
const Accounts = require('../database/model/account');
const Organization = require('../database/model/organization');
const moment = require('moment');

exports.getTrialBalance = async (req, res) => {
    try {
        const { startDate, endDate } = req.params;
        const { organizationId } = req.user;

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
        const formattedStartDate = `${startYear}-${startMonth}-${startDay}`;
        const formattedEndDate = `${endYear}-${endMonth}-${endDay}`;

        const start = new Date(`${formattedStartDate}T00:00:00`);
        const end = new Date(`${formattedEndDate}T23:59:59`);

        if (start > end) {
            return res.status(400).json({
                success: false,
                message: "Start date cannot be after end date"
            });
        }

        const startUTC = start.toISOString();
        const endUTC = end.toISOString();

        const organization = await Organization.findOne({ organizationId });
        if (!organization) {
            return res.status(404).json({
                success: false,
                message: "Organization not found"
            });
        }

        // **Fix: Ensure transactions where both debitAmount and creditAmount are 0 are filtered out**
        const transactions = await TrialBalances.find({
            organizationId: organizationId,
            createdDateTime: { $gte: new Date(startUTC), $lte: new Date(endUTC) },
            $or: [ // Ensure we get only meaningful transactions
                { debitAmount: { $gt: 0 } },
                { creditAmount: { $gt: 0 } }
            ]
        }).populate('accountId', 'accountName accountSubhead accountHead accountGroup');

        const accountMap = {};

        transactions.forEach(transaction => {
            const totalDebit = transaction.debitAmount || 0;
            const totalCredit = transaction.creditAmount || 0;
            if (totalDebit === 0 && totalCredit === 0) return; // **Additional safety filter**

            const accountSubHead = transaction.accountId ? transaction.accountId.accountSubhead : 'Uncategorized';
            const accountName = transaction.accountId ? transaction.accountId.accountName : 'Unknown Account';
            const transactionDate = moment(transaction.createdDateTime).format('MMMM YYYY');

            if (!accountMap[accountSubHead]) {
                accountMap[accountSubHead] = {
                    accountSubHead,
                    totalDebit: 0,
                    totalCredit: 0,
                    accounts: {}
                };
            }

            accountMap[accountSubHead].totalDebit += totalDebit;
            accountMap[accountSubHead].totalCredit += totalCredit;

            if (!accountMap[accountSubHead].accounts[accountName]) {
                accountMap[accountSubHead].accounts[accountName] = {
                    accountName,
                    totalDebit: 0,
                    totalCredit: 0,
                    months: {}
                };
            }

            accountMap[accountSubHead].accounts[accountName].totalDebit += totalDebit;
            accountMap[accountSubHead].accounts[accountName].totalCredit += totalCredit;

            if (!accountMap[accountSubHead].accounts[accountName].months[transactionDate]) {
                accountMap[accountSubHead].accounts[accountName].months[transactionDate] = {
                    date: transactionDate,
                    totalDebit: 0,
                    totalCredit: 0,
                    data: []
                };
            }

            accountMap[accountSubHead].accounts[accountName].months[transactionDate].totalDebit += totalDebit;
            accountMap[accountSubHead].accounts[accountName].months[transactionDate].totalCredit += totalCredit;

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

        // **Final filtering: Remove any accounts and months where both totalDebit and totalCredit are 0**
        const responseData = Object.values(accountMap)
            .filter(account => account.totalDebit > 0 || account.totalCredit > 0) // Remove empty accountSubHeads
            .map(account => ({
                accountSubHead: account.accountSubHead,
                totalDebit: account.totalDebit,
                totalCredit: account.totalCredit,
                accounts: Object.values(account.accounts)
                    .filter(acc => acc.totalDebit > 0 || acc.totalCredit > 0) // Remove empty accounts
                    .map(acc => ({
                        accountName: acc.accountName,
                        totalDebit: acc.totalDebit,
                        totalCredit: acc.totalCredit,
                        months: Object.values(acc.months)
                            .filter(month => month.totalDebit > 0 || month.totalCredit > 0) // Remove empty months
                            .map(month => ({
                                date: month.date,
                                totalDebit: month.totalDebit,
                                totalCredit: month.totalCredit,
                                data: month.data
                            }))
                    }))
            }));

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

