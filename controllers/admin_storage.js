const File = require("../models/File"); // Mongoose model

// Helper to format bytes to readable size
function formatBytes(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

// GET /api/analytics/admin-storage/:admin_id
exports.getAdminStorage = async (req, res) => {
  const { admin_id } = req.params;

  try {
    // Optional: validate ObjectId format if needed
    // if (!mongoose.Types.ObjectId.isValid(admin_id)) {
    //   return res.status(400).json({ error: "Invalid admin ID format" });
    // }

    // Only fetch files (not folders) created by admin
    const files = await File.find({
      createdBy: admin_id,
      type: "file",
    });

    const totalBytes = files.reduce((sum, file) => {
      const size = parseInt(file.size || 0);
      return sum + (isNaN(size) ? 0 : size);
    }, 0);

    const totalMB = +(totalBytes / (1024 * 1024)).toFixed(2);

    res.json({
      adminId: admin_id,
      totalBytes,
      totalMB,
      readable: formatBytes(totalBytes),
    });
  } catch (err) {
    console.error("Storage fetch error:", err);
    res.status(500).json({ error: "Failed to calculate admin storage" });
  }
};
