const Organization = require('../database/model/organization');
const Tax = require('../database/model/tax');
const Unit = require('../database/model/unit');
const Settings = require('../database/model/settings');
const Bmcr = require('../database/model/bmcr');


//Get ItemDropdowm and get item settings field
exports.getItemDropdowm = async (req, res) => {
    const organizationId = req.user.organizationId;
    try {
        // Check if an Organization already exists
        const organization = await Organization.findOne({ organizationId });
    
        if (!organization) {
        return res.status(404).json({
            message: "No Organization Found.",
        });
        }

        // Fetch settings data
        const settings = await Settings.findOne({ organizationId });
        if (!settings) {
        return res.status(500).json({
            message: "Settings not found for the organization.",
        });
        }

        // Fetch bmcr data
        const bmcr = await Bmcr.find({ organizationId });
        // if (!bmcr || bmcr.length === 0) {
        //     return res.status(404).json({
        //         message: "No bmcr found for the organization.",
        //     });
        // }

        // Fetch unit data
        const unit = await Unit.find({ organizationId });
        // if (!unit) {
        //     return res.status(404).json({
        //         message: "No unit found for the organization.",
        //     });
        // }

        // Fetch tax data to check tax type
        const taxData = await Tax.findOne({ organizationId });
        if (!taxData) {
            return res.status(404).json({
                message: "No tax data found for the organization.",
            });
        }

        // Prepare the response object
        const response = {
            bmcrData: {
                brandNames: bmcr.map(b => b.brandName).filter(Boolean),   
                manufacturers: bmcr.map(m => m.manufacturerName).filter(Boolean),
                categories: bmcr.map(c => c.categoriesName).filter(Boolean),
                racks: bmcr.map(r => r.rackName).filter(Boolean)
            },
            unitName: unit.map(u => u.unitName),
            itemSettings: {
                itemDecimal: settings.itemDecimal,
                itemDuplicateName: settings.itemDuplicateName,
                hsnSac: settings.hsnSac,
                hsnDigits: settings.hsnDigits,
                fourDigitHsn: settings.fourDigitHsn,
            },
            taxType: taxData.taxType,
            organization: {
                baseCurrency: organization.baseCurrency,
                timeZoneExp: organization.timeZoneExp,
                dateFormatExp: organization.dateFormatExp,
            }
        };

        // Check taxType and add the appropriate tax rate to the response
        if (taxData.taxType === 'GST') {
            response.taxRate = taxData.gstTaxRate;
        } else if (taxData.taxType === 'VAT') {
            response.taxRate = taxData.vatTaxRate;
        } else {
            response.message = "No tax type selected.";
        }

        // Return the combined response data
        return res.status(200).json(response);

    } catch (error) {
        console.error("Error fetching brands:", error);
        res.status(500).json({ message: "Internal server error." });
    }
};







