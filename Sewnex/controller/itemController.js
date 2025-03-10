const Organization = require("../../database/model/organization");
const Item = require("../../database/model/item");
const ItemTrack = require("../../database/model/itemTrack");

const mongoose = require('mongoose');










//M Item Exist
const mItemDataExists = async (organizationId) => {
  const [newItems] = await Promise.all([
      Item.find({ organizationId }, { organizationId: 0, type:'Fabric' })
          .populate('salesAccountId', 'accountName')
          .populate('purchaseAccountId', 'accountName')
          .populate('preferredVendorId', 'supplierDisplayName')
          .lean(),
  ]);

  const transformedItems = newItems.map(item => ({
      ...item,
      salesAccountId: item.salesAccountId?._id || undefined,
      salesAccountName: item.salesAccountId?.accountName || undefined,

      purchaseAccountId: item.purchaseAccountId?._id || undefined,
      purchaseAccountName: item.purchaseAccountId?.accountName || undefined,

      preferredVendorId: item.preferredVendorId?._id || undefined,
      preferredVendorName: item.preferredVendorId?.supplierDisplayName || undefined,
  }));

  // Extract itemIds from newItems
  const itemIds = transformedItems.map(item => new mongoose.Types.ObjectId(item._id));

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
      const sortedEntries = itemTrack.data.sort((a, b) =>
          new Date(a.createdDateTime) - new Date(b.createdDateTime)
      );

      acc[itemTrack._id.toString()] = {
          currentStock: itemTrack.totalDebit - itemTrack.totalCredit,
          lastEntry: sortedEntries[sortedEntries.length - 1], // Explicitly take the last entry based on sorted data
      };
      return acc;
  }, {});

  // Enrich items with currentStock and other data
  const enrichedItems = transformedItems.map(item => {
    const itemIdStr = item._id.toString();
    const itemTrackData = itemTrackMap[itemIdStr];

    if (!itemTrackData) {
        console.warn(`No ItemTrack data found for itemId: ${itemIdStr}`);
    }

    return {
        ...item,
        currentStock: itemTrackData?.currentStock ?? 1, 
    };
  });

  return { enrichedItems };
};




// Fetch Item existing data
const itemDataExist = async (organizationId) => {
    const [ organizationExists ] = await Promise.all([
      Organization.findOne({ organizationId }, { organizationId: 1,timeZoneExp: 1, dateFormatExp: 1, dateSplit: 1}),
    ]);
    return { organizationExists };
  };

















//Get all item m
exports.getAllItemFabric = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;

    const { organizationExists } = await itemDataExist( organizationId );
    
    if (!organizationExists) return res.status(404).json({ message: "No Organization Found." });

    const { enrichedItems  } = await mItemDataExists(organizationId);        

    if ( enrichedItems ) {
      res.status(200).json(enrichedItems);            
    } else {
      return res.status(404).json("No Items found.");
    }
  } catch (error) {
    console.error("Error fetching Items:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};


