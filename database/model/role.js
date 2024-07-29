const mongoose = require('mongoose');

const RoleSchema = new mongoose.Schema({
  organizationId: { type: String },
  roleName: { type: String },
  description: { type: String },
  permissions: [{ type: String }]
});

module.exports = mongoose.model('Role', RoleSchema);