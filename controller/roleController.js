// v1.0

const Role = require('../database/model/role');


// Create Role
exports.createRole = async (req, res) => {
    const { organizationId, roleName, permissions } = req.body;

    // Validate input
    if (!roleName || !permissions) {
      return res.status(400).json({ message: 'Name and permissions are required' });
    }
  
    // Check if role already exists
    const existingRole = await Role.findOne({ roleName:roleName, organizationId:organizationId });
    if (existingRole) {
      return res.status(400).json({ message: 'Role already exists' });
    }
  
    // Create new role
    const newRole = new Role({
      roleName,
      permissions
    });
  
    try {
      await newRole.save();
      res.status(201).json({ message: 'Role created successfully', role: newRole });
    } catch (error) {
      res.status(500).json({ message: "Internal server error.", error : error.message, stack: error.stack });
    }
  };
  
  module.exports = router;


