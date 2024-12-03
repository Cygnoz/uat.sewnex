const Customer = require("../database/model/customer");
const SalesInvoice = require("../database/model/salesInvoice");
const moment = require("moment-timezone");

// New function to get top customers by sales volume
const topCustomerBySale = async (organizationId) => {
  // Find all customers for the given organization
  const customers = await Customer.find({ organizationId });

  // Array to hold each customer's sale volume
  const customerSales = await Promise.all(customers.map(async (customer) => {
    // Calculate total sale volume for this customer
    const salesInvoices = await SalesInvoice.find({
      organizationId,
      customerName: customer.customerDisplayName // Match with customerDisplayName from Customer
    });

    const saleVolume = salesInvoices.reduce((total, invoice) => total + invoice.totalAmount, 0);

    return {
      customerId: customer._id,
      customerName: customer.customerDisplayName,
      saleVolume
    };
  }));

  // Sort customers by saleVolume in descending order and get the top 5
  customerSales.sort((a, b) => b.saleVolume - a.saleVolume);
  return customerSales.slice(0, 5);
};

// Main function to get customer stats
exports.getCustomerStats = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const { date } = req.params;
    const givenMonth = moment(date, "YYYY-MM-DD").format("MMMM"); // Get the month as "September"
    const givenYear = moment(date, "YYYY-MM-DD").format("YYYY");  // Get the year as "2024"

    // Find total customers for the given organizationId
    const totalCustomers = await Customer.countDocuments({ organizationId });

    // Find active customers for the given organizationId
    const activeCustomers = await Customer.countDocuments({
      organizationId,
      status: "Active",
    });

    // Find recently added customers in the given month
    const recentlyAddedCustomers = await Customer.find({
      organizationId: organizationId,
      createdDate: {
        $regex: new RegExp(`${givenMonth}/${givenYear}`)  // Match the "MMMM/YYYY" format
      }
    }).sort({ _id: -1 });
    const newCustomersCount = recentlyAddedCustomers.length;

    // Get top customers by sales volume
    const topCustomersBySalesVolume = await topCustomerBySale(organizationId);

    // Send the response with all the stats
    res.status(200).json({
      totalCustomers,
      activeCustomers,
      newCustomersCount,
      topCustomersBySalesVolume
    });
  } catch (error) {
    res.status(500).json({ message: "Error fetching customer stats", error });
  }
};
