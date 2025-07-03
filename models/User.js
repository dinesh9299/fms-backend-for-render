const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },

    password: {
      type: String,
      required: true,
    },

    role: {
      type: String,
      enum: ["user", "admin", "superadmin"],
      default: "user",
    },
    department: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

// Model name is capitalized by convention
const User = mongoose.model("usercredentials", userSchema);
module.exports = User;
