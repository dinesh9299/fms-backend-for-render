const File = require("../models/File");
const { cosineSimilarity, generateEmbedding } = require("./embedding");

exports.searchFiles = async (req, res) => {
  const { query, user_id, top_k = 5, threshold = 0.2 } = req.body;

  try {
    const queryLower = query.toLowerCase();
    const queryEmbedding = await generateEmbedding(queryLower);
    const allFiles = await File.find({ type: "file" });

    const results = [];

    for (const file of allFiles) {
      const allowed =
        !file.allowedUsers ||
        file.allowedUsers.map(String).includes(user_id) ||
        String(file.createdBy) === user_id;

      if (!allowed) {
        console.log(`Skipping ${file.name}: access denied`);
        continue;
      }

      if (
        !file.embedding ||
        !Array.isArray(file.embedding) ||
        file.embedding.length !== 384
      ) {
        console.log(`Skipping ${file.name}: invalid or missing embedding`);
        continue;
      }

      let similarity = cosineSimilarity(queryEmbedding, file.embedding);

      const text = (file.content || "").toLowerCase();
      for (const token of queryLower.split(" ")) {
        if (text.includes(token)) similarity += 0.03;
      }

      const confidence =
        similarity >= 0.75 ? "high" : similarity >= 0.5 ? "medium" : "low";

      results.push({
        name: file.name,
        path: file.path,
        similarity: +similarity.toFixed(4),
        included: similarity >= threshold,
        confidence,
      });
    }

    results.sort((a, b) => b.similarity - a.similarity);
    res.json(results.slice(0, top_k));
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ error: "Search failed" });
  }
};
