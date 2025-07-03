const mongoose = require("mongoose");

const fileAccessLogSchema = new mongoose.Schema({
  user_id: { type: String, required: true },
  file_id: { type: String, required: true },
  event_type: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  allowedUsers: [
    { type: mongoose.Schema.Types.ObjectId, ref: "usercredentials" },
  ],
});

module.exports = mongoose.model("FileAccessLog", fileAccessLogSchema);
