const Customer = require("../database/model/customer");
const SalesInvoice = require("../database/model/salesInvoice");
const sewOrder = require("../database/model/sxOrder")
const Organization = require("../database/model/organization");
const Item = require("../database/model/item");
// const ItemTrack = require("../database/model/itemTrack");
const TrialBalance = require("../database/model/trialBalance");
const Expense = require("../database/model/expense");
const Account = require("../database/model/account");
const salesOrder = require("../database/model/salesOrder")

const moment = require("moment-timezone");
const mongoose = require("mongoose");

const {
  singleCustomDateTime,
  multiCustomDateTime,
} = require("../services/timeConverter");

const dataExist = async (organizationId) => {
  const [organizationExists, allInvoice, allCustomer, allItem, allExpense ,allSalesOrders] =
    await Promise.all([
      Organization.findOne(
        { organizationId },
        {
          timeZoneExp: 1,
          dateFormatExp: 1,
          dateSplit: 1,
          organizationCountry: 1,
        }
      ).lean(),
      SalesInvoice.find(
        { organizationId },
        {
          _id: 1,
          customerId: 1,
          items: 1,
          paidStatus: 1,
          paidAmount: 1,
          totalAmount: 1,
          saleAmount: 1,
          createdDateTime: 1,
        }
      )
        .populate("items.itemId", "itemName")
        .populate("customerId", "customerDisplayName")
        .lean(),
      Customer.find(
        { organizationId },
        { _id: 1, customerDisplayName: 1, createdDateTime: 1 }
      ).lean(),
      Item.find({ organizationId }, { _id: 1, itemName: 1 }).lean(),
      Expense.find(
        { organizationId },
        {
          _id: 1,
          expense: 1,
          expenseCategory: 1,
          grandTotal: 1,
          createdDateTime: 1,
        }
      )
        .populate("expense.expenseAccountId", "accountName")
        .lean(),
        salesOrder.find({ organizationId }, { totalAmount: 1, createdDateTime: 1 }).lean()
    ]);
  return { organizationExists, allInvoice, allCustomer, allItem, allExpense ,allSalesOrders };
};

//Xs Item Exist
const xsItemDataExists = async (organizationId) => {
  const [newItems] = await Promise.all([
    Item.find(
      { organizationId },
      { _id: 1, itemName: 1, itemImage: 1, costPrice: 1, createdDateTime: 1 }
    ).lean(),
  ]);

  // Extract itemIds from newItems
  const itemIds = newItems.map((item) => new mongoose.Types.ObjectId(item._id));

  // Aggregate data from ItemTrack
  const itemTracks = await ItemTrack.aggregate([
    { $match: { itemId: { $in: itemIds } } },
    { $sort: { itemId: 1, createdDateTime: 1 } }, // Sort by itemId and createdDateTime
    {
      $group: {
        _id: "$itemId",
        totalCredit: { $sum: "$creditQuantity" },
        totalDebit: { $sum: "$debitQuantity" },
        lastEntry: { $max: "$createdDateTime" }, // Identify the last date explicitly
        data: { $push: "$$ROOT" }, // Push all records to process individually if needed
      },
    },
  ]);

  const itemTrackMap = itemTracks.reduce((acc, itemTrack) => {
    const sortedEntries = itemTrack.data.sort(
      (a, b) => new Date(a.createdDateTime) - new Date(b.createdDateTime)
    );

    acc[itemTrack._id.toString()] = {
      currentStock: itemTrack.totalDebit - itemTrack.totalCredit,
      lastEntry: sortedEntries[sortedEntries.length - 1], // Explicitly take the last entry based on sorted data
    };
    return acc;
  }, {});

  // Enrich items with currentStock and other data
  const enrichedItems = newItems.map((item) => {
    const itemIdStr = item._id.toString();
    const itemTrackData = itemTrackMap[itemIdStr];

    if (!itemTrackData) {
      console.warn(`No ItemTrack data found for itemId: ${itemIdStr}`);
    }

    return {
      ...item,
      currentStock: itemTrackData?.currentStock ?? 0,
    };
  });

  return { enrichedItems };
};

// get date range
const getDateRange = (filterType, date, timeZone) => {
  // const momentDate = moment.tz(date, timeZone);

  // Ensure the date format is YYYY-MM-DD to avoid Moment.js deprecation warning
  const formattedDate = date.replace(/\//g, "-"); // Ensure YYYY-MM-DD format
  const utcDate = new Date(formattedDate); // Convert to Date object
  const momentDate = moment.tz(utcDate, timeZone); // Use time zone

  switch (filterType) {
    case "month":
      return {
        startDate: momentDate.clone().startOf("month"),
        endDate: momentDate.clone().endOf("month"),
      };
    case "year":
      return {
        startDate: momentDate.clone().startOf("year"),
        endDate: momentDate.clone().endOf("year"),
      };
    case "day":
      return {
        startDate: momentDate.clone().startOf("day"),
        endDate: momentDate.clone().endOf("day"),
      };
    default:
      throw new Error("Invalid filter type. Use 'month', 'year', or 'day'.");
  }
};

// Main Dashboard overview function
exports.getTodayOverview = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    
    // Fetch Organization Data
    const { organizationExists, allInvoice = [], allExpense = [] , allCustomers = [] , allSalesOrders = [] } = await dataExist(organizationId);
    // const allSalesOrders = await salesOrder.find({ organizationId }, { totalAmount: 1, createdDateTime: 1 }).lean() || [];
    // const allCustomers = await Customer.find({ organizationId }, { createdDateTime: 1 }).lean() || [];
    
    if (!organizationExists) {
      return res.status(404).json({ message: "Organization not found!" });
    }
    
    const orgTimeZone = organizationExists.timeZoneExp || "UTC";
    const today = moment.tz(new Date(), orgTimeZone).startOf("day");
    const sevenDaysAgo = today.clone().subtract(7, "days");
    
    // Ensure arrays are not undefined before filtering
    const todaySaleInc = (allInvoice || [])
      .filter(inv => moment.tz(inv.createdDateTime, orgTimeZone).isSame(today, "day"))
      .reduce((sum, inv) => sum + (parseFloat(inv.saleAmount) || 0), 0);

    const todayOrderInc = (allSalesOrders || [])
      .filter(order => moment.tz(order.createdDateTime, orgTimeZone).isSame(today, "day"))
      .reduce((sum, order) => sum + (parseFloat(order.totalAmount) || 0), 0);

    const todayExpense = (allExpense || [])
      .filter(exp => moment.tz(exp.createdDateTime, orgTimeZone).isSame(today, "day"))
      .reduce((sum, exp) => sum + (parseFloat(exp.grandTotal) || 0), 0);

    const newCustomers = (allCustomers || []).filter(customer => 
      moment.tz(customer.createdDateTime, orgTimeZone).isAfter(sevenDaysAgo)
    ).length;
    
    res.json({
      todaySaleInc,
      todayOrderInc,
      todayExpense,
      newCustomers
    });
  } catch (error) {
    console.error("Error fetching today's overview:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};




// Expense By Category
exports.getExpenseByCategory = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const { date, filterType } = req.query; // Get date & filter type (month, year, day)

    // Validate date input (YYYY-MM-DD or YYYY/MM/DD format)
    if (!date || !/^\d{4}[-/]\d{2}[-/]\d{2}$/.test(date)) {
      return res.status(400).json({
        message: "Invalid date format. Use YYYY-MM-DD or YYYY/MM/DD.",
      });
    }

    // Fetch Organization Data
    const { organizationExists, allExpense } = await dataExist(organizationId);
    if (!organizationExists)
      return res.status(404).json({ message: "Organization not found!" });

    console.log("All Expenses:", allExpense);

    // Get organization's time zone
    const orgTimeZone = organizationExists.timeZoneExp || "UTC"; // Default to UTC if not provided

    // Get the date range based on filterType
    let startDate, endDate;
    try {
      ({ startDate, endDate } = getDateRange(filterType, date, orgTimeZone));
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }

    console.log("Requested Date Range:", startDate.format(), endDate.format());

    // Check if allExpense exists and is an array
    if (!Array.isArray(allExpense) || allExpense.length === 0) {
      return res.json({ message: "No expenses found!", category: [] });
    }

    // Filter expenses based on date range
    const filteredExpenses =
      allExpense?.filter((exp) =>
        moment
          .tz(exp.createdDateTime, orgTimeZone)
          .isBetween(startDate, endDate, null, "[]")
      ) || [];

    console.log("Filtered Expenses (before category check):", filteredExpenses);

    // Remove expenses without a valid category
    const validExpenses = filteredExpenses.filter(
      (exp) => exp.expenseCategory && exp.expenseCategory.trim() !== ""
    );

    console.log("Valid Expenses (With Category):", validExpenses);

    // If no valid expenses are found, return an empty response
    if (validExpenses.length === 0) {
      return res.json({ category: [] });
    }

    // Group expenses by category
    const expenseByCategory = validExpenses.reduce((acc, exp) => {
      const category = exp.expenseCategory;
      const total = parseFloat(exp.grandTotal) || 0;

      if (!acc[category]) {
        acc[category] = 0;
      }
      acc[category] += total;
      return acc;
    }, {});

    // Convert grouped data to an array format
    let categoryArray = Object.entries(expenseByCategory).map(
      ([category, total]) => ({
        category,
        total: total.toFixed(2), // Keep two decimal places
      })
    );

    // Sort in descending order based on total
    categoryArray.sort((a, b) => b.total - a.total);

    // Response JSON
    res.json({
      category: categoryArray,
    });
  } catch (error) {
    console.error("Error fetching expense by category:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};


exports.getSalesExpenseComparison = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const { date, filterType } = req.query;

    if (!date || filterType !== "year") {
      return res.status(400).json({
        message: "Invalid request. Date is required, and filterType must be 'year'.",
      });
    }

    if (!/^\d{4}[-/]\d{2}[-/]\d{2}$/.test(date)) {
      return res.status(400).json({
        message: "Invalid date format. Use YYYY-MM-DD or YYYY/MM/DD.",
      });
    }

    const year = moment(date).year();
    const { organizationExists, allInvoice, allExpense } = await dataExist(organizationId);

    if (!organizationExists) {
      return res.status(404).json({ message: "Organization not found!" });
    }

    const orgTimeZone = organizationExists.timeZoneExp || "UTC";

    // Initialize the result object with months
    const monthlyData = Array.from({ length: 12 }, (_, i) => ({
      month: moment().month(i).format("MMMM"),
      sales: 0,
      expenses: 0,
    }));

    // Process sales data
    allInvoice?.forEach((invoice) => {
      const invoiceDate = moment.tz(invoice.createdDateTime, orgTimeZone);
      if (invoiceDate.year() === year) {
        const monthIndex = invoiceDate.month();
        monthlyData[monthIndex].sales += parseFloat(invoice.saleAmount) || 0;
      }
    });

    // Process expenses data
    allExpense?.forEach((expense) => {
      const expenseDate = moment.tz(expense.createdDateTime, orgTimeZone);
      if (expenseDate.year() === year) {
        const monthIndex = expenseDate.month();
        monthlyData[monthIndex].expenses += parseFloat(expense.grandTotal) || 0;
      }
    });

    res.json({ data: monthlyData });
  } catch (error) {
    console.error("Error in getSalesExpenseComparison:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};