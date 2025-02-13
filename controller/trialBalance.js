const TrialBalances = require('../database/model/trialBalance');
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

        const organization = await Organization.findOne({ organizationId });
        if (!organization) {
            return res.status(404).json({
                success: false,
                message: "Organization not found"
            });
        }

        // Fetch transactions, filtering out zero debit and credit amounts
        const transactions = await TrialBalances.find({
            organizationId,
            createdDateTime: { $gte: start, $lte: end },
            $or: [
                { debitAmount: { $gt: 0 } },
                { creditAmount: { $gt: 0 } }
            ]
        }).populate('accountId', 'accountName accountSubhead accountHead accountGroup');

        const accountMap = {};
        let totalDebit = 0;
        let totalCredit = 0;

        transactions.forEach(transaction => {
            let debit = transaction.debitAmount || 0;
            let credit = transaction.creditAmount || 0;

            if (debit === 0 && credit === 0) return;

            // Apply logic to ensure either debit or credit is non-zero at transaction level
            if (debit > credit) {
                debit -= credit;
                credit = 0;
            } else if (credit > debit) {
                credit -= debit;
                debit = 0;
            }

            totalDebit += debit;
            totalCredit += credit;

            const accountSubHead = transaction.accountId?.accountSubhead || 'Uncategorized';
            const accountName = transaction.accountId?.accountName || 'Unknown Account';
            const transactionDate = moment(transaction.createdDateTime).format('MMMM YYYY');

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
                    months: {}
                };
            }

            accountMap[accountSubHead].accounts[accountName].totalDebit += debit;
            accountMap[accountSubHead].accounts[accountName].totalCredit += credit;

            if (!accountMap[accountSubHead].accounts[accountName].months[transactionDate]) {
                accountMap[accountSubHead].accounts[accountName].months[transactionDate] = {
                    date: transactionDate,
                    totalDebit: 0,
                    totalCredit: 0,
                    data: []
                };
            }

            accountMap[accountSubHead].accounts[accountName].months[transactionDate].totalDebit += debit;
            accountMap[accountSubHead].accounts[accountName].months[transactionDate].totalCredit += credit;

            accountMap[accountSubHead].accounts[accountName].months[transactionDate].data.push({
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
                createdDate: moment(transaction.createdDateTime).format('DD/MMM/YYYY'),
                createdTime: moment(transaction.createdDateTime).format('hh:mm:ss A'),
            });
        });

        // Apply debit-credit adjustment at each level
        function adjustBalance(obj) {
            if (obj.totalDebit > obj.totalCredit) {
                obj.totalDebit -= obj.totalCredit;
                obj.totalCredit = 0;
            } else if (obj.totalCredit > obj.totalDebit) {
                obj.totalCredit -= obj.totalDebit;
                obj.totalDebit = 0;
            }
        }

        Object.values(accountMap).forEach(accountSubHead => {
            adjustBalance(accountSubHead);
            Object.values(accountSubHead.accounts).forEach(account => {
                adjustBalance(account);
                Object.values(account.months).forEach(month => {
                    adjustBalance(month);
                });
            });
        });

        // Format response and remove empty accounts and months
        const responseData = Object.values(accountMap)
            .filter(account => account.totalDebit > 0 || account.totalCredit > 0)
            .map(account => ({
                accountSubHead: account.accountSubHead,
                totalDebit: account.totalDebit,
                totalCredit: account.totalCredit,
                accounts: Object.values(account.accounts)
                    .filter(acc => acc.totalDebit > 0 || acc.totalCredit > 0)
                    .map(acc => ({
                        accountName: acc.accountName,
                        totalDebit: acc.totalDebit,
                        totalCredit: acc.totalCredit,
                        months: Object.values(acc.months)
                            .filter(month => month.totalDebit > 0 || month.totalCredit > 0)
                            .map(month => ({
                                date: month.date,
                                totalDebit: month.totalDebit,
                                totalCredit: month.totalCredit,
                                data: month.data
                            }))
                    }))
            }));

        // Apply final adjustment at summary level
        adjustBalance({ totalDebit, totalCredit });

        res.status(200).json({
            success: true,
            data: responseData,
            summary: {
                totalDebit,
                totalCredit,
                ...(totalCredit > totalDebit ? { final: `${(totalCredit - totalDebit).toFixed(2)}(Cr)` } : {}),
                ...(totalDebit > totalCredit ? { final: `${(totalDebit - totalCredit).toFixed(2)}(Dr)` } : {}),

                ...(totalCredit > totalDebit ? { finalCredit: `${(totalCredit - totalDebit).toFixed(2)}` } : {}),
                ...(totalDebit > totalCredit ? { finalDebit: `${(totalDebit - totalCredit).toFixed(2)}` } : {})

            },
            debug: {
                dateRange: {
                    start: start.toISOString(),
                    end: end.toISOString()
                },
                timezone: organization.timeZone
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
