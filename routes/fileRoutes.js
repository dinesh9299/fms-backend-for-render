const express = require("express");
const router = express.Router();
const upload = require("../middleware/multerConfig");
const path = require("path");
const fs = require("fs");
const {
  createFolder,
  uploadFile,
  deleteItem,
  markNotificationAsSeen,
  getallfiles,
  getall,
  getf,
  getFiles,
  updateFileAccess,
  getUsersWithAccessToAllUnderFolder,
  getfilebyID,
} = require("../controllers/fileController");
const File = require("../models/File");
const Notificationmodel = require("../models/Notificationmodel");
const Whatsappapi = require("../controllers/Whatsappapi");
const User = require("../models/User");
const getFolderSize = require("../controllers/fspromise");
const { searchFiles } = require("../controllers/searchcontroller");
const {
  trackAccess,
  getRecentFiles,
} = require("../controllers/analytics_controller");
const { getAdminStorage } = require("../controllers/admin_storage");
const {
  requestAccess,
  acceptAccess,
} = require("../controllers/request_access");

// Create folder
router.post("/create-folder", createFolder);

// Upload file
router.post("/upload", upload.single("file"), uploadFile);

// Get files in a folder
router.get("/getfiles", getFiles);

router.get("/", getf);

router.get("/getall", getall);

router.get("/allfiles", getallfiles);

router.post("/search", searchFiles);

router.post("/analytics/track-access", trackAccess);
router.get("/analytics/recent-files", getRecentFiles);

router.get("/admin-storage/:admin_id", getAdminStorage);
router.post("/request-access", requestAccess);
router.put("/accept-access", acceptAccess);

// 👇 New route to get a file/folder's detail (used in breadcrumb)
router.get("/detail", async (req, res) => {
  try {
    const file = await File.findById(req.query.id);
    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }
    res.json(file);
  } catch (err) {
    console.error("❌ Error in /files/detail:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/:id/:deletedby", deleteItem); // 👈 Add this at the end

router.post("/delete-multiple", async (req, res) => {
  const { ids, deletedby } = req.body;

  // Helper: Convert URL to relative file path
  const getFilePath = (urlPath) => {
    const relativePath = urlPath.replace(/^https?:\/\/[^\/]+\/?/, "");
    return path.join(__dirname, "../", relativePath);
  };

  try {
    const deleteRecursive = async (parentId) => {
      const children = await File.find({ parent: parentId });

      for (const child of children) {
        if (child.type === "folder") {
          await deleteRecursive(child._id);

          // Delete folder from disk
          const folderPath = getFilePath(child.path);
          if (fs.existsSync(folderPath)) {
            fs.rmSync(folderPath, { recursive: true, force: true });
            console.log("Deleted child folder:", folderPath);
          }
        } else {
          const filePath = getFilePath(child.path);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log("Deleted child file:", filePath);
          }
        }

        await File.findByIdAndDelete(child._id);
      }
    };

    for (const id of ids) {
      const item = await File.findById(id);
      if (!item) continue;

      if (item.type === "folder") {
        await deleteRecursive(item._id);

        // Delete main folder from disk
        const folderPath = getFilePath(item.path);
        if (fs.existsSync(folderPath)) {
          fs.rmSync(folderPath, { recursive: true, force: true });
          console.log("Deleted main folder:", folderPath);
        }
      } else if (item.type === "file") {
        const filePath = getFilePath(item.path);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log("Deleted main file:", filePath);
        }
      }

      await File.findByIdAndDelete(id);
    }

    res.json({ message: "Deleted successfully" });
    const io = req.app.get("io");

    io.emit("storage_updated", deletedby);
  } catch (err) {
    console.error("Delete multiple error:", err);
    res.status(500).json({ error: err.message });
  }
});

router.post("/rename", async (req, res) => {
  const { id, newName } = req.body;
  try {
    const file = await File.findById(id);
    if (!file) return res.status(404).json({ error: "File not found" });

    file.name = newName;
    await file.save();
    res.json({ success: true, file });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Force download route
router.get("/download/:filename/:name", (req, res) => {
  const filename = req.params.filename; // The actual file on disk
  const displayName = req.params.name; // The name the user sees/downloads

  const filePath = path.join(__dirname, "../uploads", filename);

  res.download(filePath, displayName, (err) => {
    if (err) {
      console.error("Download failed:", err.message);
      res.status(500).send("Failed to download file.");
    }
  });
});

router.get("/file/:id", async (req, res) => {
  const file = await File.findById(req.params.id);
  if (!file) {
    return res.status(404).json({ message: "File not found" });
  }
  res.json(file);
});

router.get("/notification/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    const notifications = await Notificationmodel.find({
      "recipients.userId": userId,
    })
      .sort({ time: -1 })
      .lean();

    // Filter and simplify data
    const userNotifications = notifications.map((notification) => {
      const recipient = notification.recipients.find(
        (r) => r.userId.toString() === userId
      );
      return {
        _id: notification._id,
        message: notification.message,
        parent: notification.parent,
        time: notification.time,
        type: notification.type,
        by: notification.by,
        seen: recipient?.seen || false,
        filetype: notification.filetype,
      };
    });

    res.json(userNotifications);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

router.post("/mark-seen/:notifId", markNotificationAsSeen);

router.post("/whatsapp", Whatsappapi);

router.get("/filess/:id", async (req, res) => {
  try {
    const file = await File.findById(req.params.id).lean();
    if (!file) return res.status(404).json({ message: "File not found" });

    const users = await User.find({
      _id: { $in: file.allowedUsers || [] },
    }).select("name email");
    res.json({ ...file, allowedUsersDetails: users });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/update-access", updateFileAccess);

//remove access
router.post("/file/:id/access/remove", async (req, res) => {
  const { userId } = req.body;
  const file = await File.findById(req.params.id);
  if (!file) return res.status(404).json({ message: "File not found" });

  file.allowedUsers = file.allowedUsers.filter(
    (id) => id.toString() !== userId
  );
  await file.save();

  res.json({ message: "Access removed" });
});

//add access
router.post("/file/:id/access/add", async (req, res) => {
  const { userId } = req.body;
  const file = await File.findById(req.params.id);
  if (!file) return res.status(404).json({ message: "File not found" });

  if (!file.allowedUsers.includes(userId)) {
    file.allowedUsers.push(userId);
    await file.save();
  }

  res.json({ message: "Access granted" });
});

router.get("/access/all-users/:folderId", getUsersWithAccessToAllUnderFolder);

router.get("/api/storage-used", async (req, res) => {
  try {
    const size = await getFolderSize(path.join(__dirname, "..", "uploads"));
    res.json({ size }); // return in bytes
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to calculate size" });
  }
});

const formatBytes = (bytes) => {
  if (bytes === 0) return "0 Bytes";
  const units = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
};
router.get("/admin-storage/:adminId", async (req, res) => {
  const { adminId } = req.params;

  try {
    const files = await File.find({ createdBy: adminId });

    const totalBytes = files.reduce(
      (sum, file) => sum + Number(file.size || 0),
      0
    );

    const totalMB = (totalBytes / (1024 * 1024)).toFixed(2);

    res.json({
      adminId,
      totalBytes,
      totalMB,
      readable: formatBytes(totalBytes),
    });
  } catch (err) {
    console.error("Storage calculation error:", err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/getfilebyid/:id", getfilebyID);

module.exports = router;
