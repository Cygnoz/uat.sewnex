const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
  userName: { type: String},
  activity: { type: String },
  timestamp: { type: String },
  reqBody: { type: String }
});

module.exports = mongoose.model('ActivityLog', activityLogSchema);
