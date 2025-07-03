const mongoose = require("mongoose");
const File = require("../models/File");
const Notificationmodel = require("../models/Notificationmodel");

exports.requestAccess = async (req, res) => {
  const { fileId, userId, requestedBy } = req.body;

  try {
    if (!mongoose.Types.ObjectId.isValid(fileId)) {
      return res.status(400).json({ message: "Invalid file ID" });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const file = await File.findById(fileId);
    if (!file) {
      return res.status(404).json({ message: "File not found" });
    }

    const adminId = file.createdBy;
    if (!adminId || !mongoose.Types.ObjectId.isValid(adminId)) {
      return res.status(400).json({ message: "Invalid admin ID" });
    }

    let parentName = "Unknown";
    if (file.parent) {
      const parent = await File.findById(file.parent);
      if (parent) {
        parentName = parent.name;
      }
    }

    const notification = new Notificationmodel({
      message: `User ${requestedBy} requested access to '${file.name}'`,
      parent: parentName,
      time: new Date(),
      type: "access_request",
      by: fileId,
      filetype: userId,
      recipients: [
        {
          userId: adminId,
          seen: false,
        },
      ],
    });

    await notification.save();

    const io = req.app.get("io");
    io.to(adminId.toString()).emit("new_notification", {
      userId: adminId.toString(),
    });

    return res
      .status(200)
      .json({ message: "Access request sent to file admin" });
  } catch (err) {
    console.error("Error in requestAccess:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.acceptAccess = async (req, res) => {
  const { notificationId } = req.body;

  try {
    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
      return res.status(400).json({ message: "Invalid notification ID" });
    }

    const notification = await Notificationmodel.findById(notificationId);
    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    if (notification.type !== "access_request") {
      return res
        .status(400)
        .json({ message: "Notification is not an access request" });
    }

    // Update the original notification
    notification.type = "accepted";
    await notification.save();

    const fileId = notification.by;
    const requestedUserId = notification.filetype; // this was originally userId from request
    const file = await File.findById(fileId);

    if (!file) {
      return res.status(404).json({ message: "Associated file not found" });
    }

    // Send new notification to the user who requested access
    const grantedNotif = new Notificationmodel({
      message: `You have been granted access to '${file.name}'`,
      time: new Date(),
      type: "granted",
      parent: notification.parent || "Unknown",
      filetype: file.type,
      by: fileId,
      recipients: [
        {
          userId: requestedUserId,
          seen: false,
        },
      ],
    });

    await grantedNotif.save();

    // Emit to the granted user
    const io = req.app.get("io");
    io.to(requestedUserId.toString()).emit("new_notification", {
      userId: requestedUserId.toString(),
    });

    return res
      .status(200)
      .json({ message: "Access request accepted and user notified" });
  } catch (err) {
    console.error("Error in acceptAccess:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
