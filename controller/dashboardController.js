const Supplier = require("../database/model/supplier");
const moment = require("moment-timezone");

exports.getSupplierStats = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const { date } = req.params;

    const formattedDate = moment(date, "YYYY-MM-DD");
    const givenMonthYear = formattedDate.format("MMMM/YYYY");

    const countSuppliersByStatus = async (status) => {
      const query = { organizationId };
      if (status) query.status = status;
      return await Supplier.countDocuments(query);
    };

    const totalSuppliers = await countSuppliersByStatus();
    const activeSuppliers = await countSuppliersByStatus("Active");

    const recentlyAddedSuppliers = await Supplier.find({
      organizationId,
      createdDate: { $regex: new RegExp(givenMonthYear) },
    }).sort({ _id: -1 });

    res.status(200).json({
      totalSuppliers,
      activeSuppliers,
      newSuppliersCount: recentlyAddedSuppliers.length,
    });
  } catch (error) {
    res.status(500).json({ message: "Error fetching Supplier stats", error });
  }
};
