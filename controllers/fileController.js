const File = require("../models/File");
const path = require("path");
const fs = require("fs");
const Notificationmodel = require("../models/Notificationmodel");
const User = require("../models/User");

const pdfParse = require("pdf-parse");
const mammoth = require("mammoth"); // for .docx files
const { generateEmbedding } = require("./embedding");

exports.createFolder = async (req, res) => {
  try {
    const { name, parentId, allowedUsers, createdBy, createdbyName } = req.body;

    console.log("➡️ Incoming folder create request:", req.body);

    const folderPath = path.join("uploads", name);

    const existingFile = await File.findOne({
      name,
      parent: parentId || null,
      type: "folder",
    });

    if (existingFile) {
      console.log("⚠️ Folder already exists");
      return res.status(204).json({ message: "Folder already exists" });
    }

    fs.mkdirSync(folderPath, { recursive: true });

    const folder = new File({
      name,
      type: "folder",
      path: folderPath,
      parent: parentId || null,
      allowedUsers: allowedUsers || [],
      createdBy,
      createdbyName,
      createdtime: new Date(), // 🕒 Add current UTC timestamp
    });

    await folder.save();
    console.log("✅ Folder saved:", folder);
    res.status(201).json(folder);
  } catch (err) {
    console.error("❌ Error in createFolder:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.uploadFile = async (req, res) => {
  const {
    name,
    parentId,
    filetype,
    size,
    createdtime,
    parentpath,
    by,
    createdbyName,
    createdBy,
  } = req.body;

  let allowedUsers = [];
  try {
    if (req.body.allowedUsers) {
      const parsed = JSON.parse(req.body.allowedUsers);
      if (Array.isArray(parsed)) {
        allowedUsers = parsed;
      } else {
        console.error("allowedUsers is not an array");
      }
    }
  } catch (err) {
    console.error("Failed to parse allowedUsers:", err);
  }

  try {
    const existingFile = await File.findOne({
      name,
      parent: parentId || null,
      type: "file",
    });

    if (existingFile) {
      if (req.file?.path) {
        fs.unlink(req.file.path, (err) => {
          if (err) console.error("Failed to delete duplicate file:", err);
        });
      }

      return res.json({
        error: `A file named "${name}" already exists in this folder.`,
        success: false,
      });
    }

    if (!req.file) {
      return res.status(400).json({ error: "File upload is required." });
    }

    const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${
      req.file.filename
    }`;
    const filePath = path.join(__dirname, "../uploads", req.file.filename);

    // 🔍 Extract content
    let content = "";
    const lowerFileType = filetype?.toLowerCase();

    if (lowerFileType === "pdf") {
      const dataBuffer = fs.readFileSync(filePath);
      const pdfData = await pdfParse(dataBuffer);
      content = pdfData.text;
    } else if (lowerFileType === "docx") {
      const result = await mammoth.extractRawText({ path: filePath });
      content = result.value;
    } else if (lowerFileType === "txt") {
      content = fs.readFileSync(filePath, "utf8");
    }

    // 🧠 Generate embedding
    let embedding = [];
    if (content) {
      const rawEmbedding = await generateEmbedding(content);
      embedding = Array.from(rawEmbedding); // 🔁 Convert to plain array
    }

    // 📝 Save file to DB
    const file = new File({
      name,
      type: "file",
      filetype,
      path: fileUrl,
      parent: parentId || null,
      size,
      createdBy,
      createdbyName,
      createdtime: new Date(),
      allowedUsers,
      content,
      embedding, // ✅ store embedding vector
    });

    await file.save();

    // 🔔 Create notification
    const recipients = allowedUsers
      .filter((uid) => uid !== createdBy)
      .map((uid) => ({ userId: uid, seen: false }));

    const notification = new Notificationmodel({
      message: `Granted access to "${name}" from ${createdbyName}`,
      time: new Date(),
      recipients,
      by,
      type: "added",
      parent: parentpath,
    });

    await notification.save();

    // 📢 Emit events
    const io = req.app.get("io");
    io.emit("new_notification", notification);
    io.emit("storage_updated", createdBy);

    return res.status(201).json({ file, success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};

exports.markNotificationAsSeen = async (req, res) => {
  const { notifId } = req.params;
  const { userId } = req.body;

  try {
    const notification = await Notificationmodel.findById(notifId);
    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    const recipient = notification.recipients.find(
      (r) => r.userId.toString() === userId
    );

    if (!recipient) {
      return res
        .status(404)
        .json({ message: "User is not a recipient of this notification" });
    }

    if (!recipient.seen) {
      recipient.seen = true;
      await notification.save();
    }

    res.json({ message: "Notification marked as seen", success: true });
  } catch (err) {
    console.error("Error updating notification:", err);
    res.status(500).json({ message: "Internal server error", success: false });
  }
};

exports.getFiles = async (req, res) => {
  const { parentId = null, userId } = req.query;

  try {
    const filesInFolder = await File.find({ parent: parentId });

    const visibleFiles = [];

    for (const file of filesInFolder) {
      const isPublic = !file.allowedUsers || file.allowedUsers.length === 0;
      const isAllowed = file.allowedUsers?.map(String).includes(userId);

      if (file.type === "file") {
        if (isPublic || isAllowed) {
          visibleFiles.push(file);
        }
      } else if (file.type === "folder") {
        if (isPublic || isAllowed) {
          visibleFiles.push(file); // ✅ Add if folder itself is accessible
        } else {
          const hasAccessibleChild = await checkFolderAccess(file._id, userId);
          if (hasAccessibleChild) {
            visibleFiles.push(file); // ✅ Add if children are accessible
          }
        }
      }
    }

    res.json(visibleFiles);
  } catch (err) {
    console.error("getFiles error:", err);
    res.status(500).json({ error: err.message });
  }
};

// Helper function: check if folder has accessible files inside
const checkFolderAccess = async (folderId, userId) => {
  const children = await File.find({ parent: folderId });

  for (const child of children) {
    if (child.type === "file") {
      const isPublic = !child.allowedUsers || child.allowedUsers.length === 0;
      const isAllowed = child.allowedUsers?.map(String).includes(userId);
      if (isPublic || isAllowed) return true;
    }

    if (child.type === "folder") {
      const childHasAccess = await checkFolderAccess(child._id, userId);
      if (childHasAccess) return true;
    }
  }

  return false;
};

exports.getallfiles = async (req, res) => {
  const { userId } = req.query;

  try {
    const allFiles = await File.find({});
    const visibleFiles = [];

    const hasAccessInFolder = async (folderId) => {
      const children = allFiles.filter(
        (f) => f.parent?.toString() === folderId.toString()
      );

      for (const child of children) {
        if (child.type === "file") {
          const isPublic =
            !child.allowedUsers || child.allowedUsers.length === 0;
          const isAllowed = (child.allowedUsers || [])
            .map(String)
            .includes(userId);
          const isCreator = child.createdBy?.toString() === userId;
          if (isPublic || isAllowed || isCreator) return true;
        }

        if (child.type === "folder") {
          const access = await hasAccessInFolder(child._id);
          if (access) return true;
        }
      }

      return false;
    };

    for (const file of allFiles) {
      const isPublic = !file.allowedUsers || file.allowedUsers.length === 0;
      const isAllowed = (file.allowedUsers || []).map(String).includes(userId);
      const isCreator = file.createdBy?.toString() === userId;

      if (file.type === "file") {
        if (isPublic || isAllowed || isCreator) {
          visibleFiles.push(file);
        }
      }

      if (file.type === "folder") {
        const access = await hasAccessInFolder(file._id);
        if (access || isCreator) {
          visibleFiles.push(file);
        }
      }
    }

    res.json(visibleFiles);
  } catch (err) {
    console.error("getallfiles error:", err);
    res.status(500).json({ error: err.message });
  }
};

// exports.getall = async (req, res) => {
//   const files = await File.find({});
//   res.json(files);
// };

exports.getf = async (req, res) => {
  const { parentId } = req.query;
  const files = await File.find({ parent: parentId || null });
  res.json(files);
};

exports.getall = async (req, res) => {
  const files = await File.find({});
  res.json(files);
};

exports.deleteItem = async (req, res) => {
  const { id, deletedby } = req.params;

  try {
    const item = await File.findById(id);
    if (!item) return res.status(404).json({ message: "Item not found" });

    // Helper function to convert URL to relative file path
    const getFilePath = (urlPath) => {
      // Removes http://127.0.0.1:5000/ and keeps uploads/filename.png
      const relativePath = urlPath.replace(/^https?:\/\/[^\/]+\/?/, "");
      return path.join(__dirname, "../", relativePath);
    };

    // If it's a folder, delete all child items recursively
    if (item.type === "folder") {
      const deleteRecursive = async (parentId) => {
        const children = await File.find({ parent: parentId });
        for (const child of children) {
          if (child.type === "folder") {
            await deleteRecursive(child._id);

            // Delete folder from disk
            const folderPath = getFilePath(child.path);
            if (fs.existsSync(folderPath)) {
              fs.rmSync(folderPath, { recursive: true, force: true });
              console.log("Deleted folder at:", folderPath);
            }
          } else {
            const filePath = getFilePath(child.path);
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
              console.log("Deleted file at:", filePath);
            }
          }
          await File.findByIdAndDelete(child._id);
        }
      };

      await deleteRecursive(item._id);
    }

    // If it's a file, delete it from disk
    if (item.type === "file") {
      const filePath = getFilePath(item.path);
      console.log("Deleting main file at:", filePath);

      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    if (item.type === "folder") {
      const folderPath = getFilePath(item.path);
      if (fs.existsSync(folderPath)) {
        fs.rmSync(folderPath, { recursive: true, force: true });
        console.log("Deleted main folder at:", folderPath);
      }
    }

    // Delete the database record (file or folder)
    await File.findByIdAndDelete(id);

    res.json({ message: "Deleted successfully" });

    const io = req.app.get("io");

    io.emit("storage_updated", deletedby);
  } catch (err) {
    console.error("Delete error:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.updateFileAccess = async (req, res) => {
  const { fileId, folderId, addUserId, removeUserId, by } = req.body;

  if (!fileId && !folderId)
    return res.status(400).json({ message: "fileId or folderId is required" });

  try {
    const targetId = fileId || folderId;
    const file = await File.findById(targetId);
    if (!file) return res.status(404).json({ message: "File not found" });

    const parent = await File.findById(file.parent);
    const parentpath = file.parent
      ? parent?.path?.replace("uploads\\", "")
      : "Filemanager";

    const updatedIds = [];

    const updateAccess = async (fileOrFolderId) => {
      const target = await File.findById(fileOrFolderId);
      if (!target) return;

      let changed = false;

      if (addUserId && !target.allowedUsers.includes(addUserId)) {
        target.allowedUsers.push(addUserId);
        changed = true;
      }

      if (removeUserId) {
        const before = target.allowedUsers.length;
        target.allowedUsers = target.allowedUsers.filter(
          (id) => id.toString() !== removeUserId.toString()
        );
        if (before !== target.allowedUsers.length) {
          changed = true;
        }
      }

      if (changed) {
        await target.save();
        updatedIds.push(target._id);
      }

      // Recurse for children
      const children = await File.find({ parent: fileOrFolderId });
      for (const child of children) {
        await updateAccess(child._id);
      }
    };

    await updateAccess(targetId);

    // 🧑 Get the affected user (for message)
    const affectedUserId = addUserId || removeUserId;
    const affectedUser = await User.findById(affectedUserId);
    const affectedUserName = affectedUser ? affectedUser.name : "A user";

    // 📝 Generate dynamic message
    const action = addUserId ? "granted" : "removed";
    const message = `Access ${action} ${
      addUserId ? "to" : "from"
    } ${affectedUserName} for '${file.name}'`;

    // 🔔 Create notification
    const notification = new Notificationmodel({
      message,
      time: new Date(),
      type: addUserId ? "given" : "removed",
      recipients: [{ userId: affectedUserId, seen: false }],
      filetype: `${file.type}`,
      by,
      parent: parentpath,
    });

    await notification.save();

    // 📢 Emit real-time notification
    const io = req.app.get("io");
    io.to(affectedUserId.toString()).emit("new_notification", {
      userId: affectedUserId.toString(),
    });

    const updatedUsers = await User.find({
      _id: { $in: file.allowedUsers },
    }).select("name email");

    res.json({
      message: "Access updated recursively",
      updatedItemCount: updatedIds.length,
      allowedUsersDetails: updatedUsers,
    });
  } catch (err) {
    console.error("Update access error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getUsersWithAccessToAllUnderFolder = async (req, res) => {
  const { folderId } = req.params;

  // if (!folderId || !mongoose.Types.ObjectId.isValid(folderId)) {
  //   return res.status(400).json({ message: "Invalid folderId" });
  // }

  try {
    const visited = new Set();
    const allFiles = [];

    // Recursive fetch of all files/folders under this folder
    const collectAllFiles = async (id) => {
      if (visited.has(id.toString())) return;
      visited.add(id.toString());

      const node = await File.findById(id);
      if (!node) return;

      allFiles.push(node);

      const children = await File.find({ parent: id });
      for (const child of children) {
        await collectAllFiles(child._id);
      }
    };

    await collectAllFiles(folderId);

    // Early return if no files
    if (allFiles.length === 0) {
      return res.json({ count: 0, users: [] });
    }

    // Build array of Sets of allowedUsers
    const userSets = allFiles.map(
      (file) => new Set(file.allowedUsers.map((id) => id.toString()))
    );

    // Intersect all sets
    let commonUserIds = [...userSets[0]];
    for (let i = 1; i < userSets.length; i++) {
      commonUserIds = commonUserIds.filter((id) => userSets[i].has(id));
    }

    // Fetch user details
    const users = await User.find({ _id: { $in: commonUserIds } }).select(
      "name email"
    );

    res.json({
      count: users.length,
      users,
    });
  } catch (err) {
    console.error("Error getting common access users:", err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getfilebyID = async (req, res) => {
  const { id } = req.params;
  console.log("id", id);

  const item = await File.findById(id);

  res.status(201).json({
    data: item,
  });
};
