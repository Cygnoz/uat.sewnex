// v1.0

const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
  userName: { type: String},
  activity: { type: String },
  reqBody: { type: String },
  createdDateTime: { type: Date, default: () => new Date() },

});

module.exports = mongoose.model('ActivityLog', activityLogSchema);
