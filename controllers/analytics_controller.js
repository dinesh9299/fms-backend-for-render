const FileAccessLog = require("../models/Fileaccess");
const File = require("../models/File");
const mongoose = require("mongoose");

// POST /api/analytics/track-access
exports.trackAccess = async (req, res) => {
  try {
    const { user_id, file_id, event_type, allowedUsers } = req.body;

    await FileAccessLog.create({
      user_id,
      file_id,
      event_type,
      timestamp: new Date(),
      allowedUsers,
    });

    res.status(200).json({ message: "Tracked" });
  } catch (err) {
    console.error("Track error:", err);
    res.status(500).json({ error: "Failed to track access" });
  }
};

// GET /api/analytics/recent-files?user_id=xxx&limit=5
exports.getRecentFiles = async (req, res) => {
  try {
    const { user_id } = req.query;
    const limit = parseInt(req.query.limit) || 5;

    const pipeline = [
      { $match: { user_id } },
      {
        $addFields: {
          file_obj_id: {
            $convert: {
              input: "$file_id",
              to: "objectId",
              onError: null,
              onNull: null,
            },
          },
        },
      },
      {
        $group: {
          _id: "$file_obj_id",
          lastAccessed: { $max: "$timestamp" },
        },
      },
      { $sort: { lastAccessed: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: "files", // ✅ collection name must match your MongoDB (lowercase!)
          localField: "_id",
          foreignField: "_id",
          as: "fileDetails",
        },
      },
      { $unwind: "$fileDetails" },
      {
        $project: {
          file: "$fileDetails",
          lastAccessed: 1,
        },
      },
    ];

    const results = await FileAccessLog.aggregate(pipeline);

    res.json(
      results.map((doc) => ({
        ...doc,
        lastAccessed: doc.lastAccessed.toISOString(),
      }))
    );
  } catch (err) {
    console.error("Recent files error:", err);
    res.status(500).json({ error: "Failed to fetch recent files" });
  }
};
