const mongoose = require("mongoose");

const fileSchema = new mongoose.Schema({
  name: String,
  type: { type: String, enum: ["file", "folder"] },
  path: String,
  filetype: String,
  parent: { type: mongoose.Schema.Types.ObjectId, ref: "File", default: null },
  size: String,
  createdtime: Date,
  createdBy: String,
  createdbyName: String,
  allowedUsers: [
    { type: mongoose.Schema.Types.ObjectId, ref: "usercredentials" },
  ],

  // ✅ Store extracted text for search/summarization
  content: {
    type: String,
    default: "", // Optional
  },
  embedding: {
    type: [Number],
    validate: {
      validator: function (v) {
        // ✅ Allow empty arrays (e.g. no extracted content) OR exactly 384-length
        return this.type === "file" ? v.length === 0 || v.length === 384 : true;
      },
      message: "Embedding must be empty or have 384 dimensions",
    },
  },
});

module.exports = mongoose.model("File", fileSchema);
