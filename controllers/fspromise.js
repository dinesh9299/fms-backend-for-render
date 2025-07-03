const fs = require("fs").promises;
const path = require("path");

async function getFolderSize(folderPath) {
  const files = await fs.readdir(folderPath);
  let totalSize = 0;

  for (const file of files) {
    const filePath = path.join(folderPath, file);
    const stat = await fs.stat(filePath);
    if (stat.isFile()) {
      totalSize += stat.size;
    }
  }

  return totalSize; // in bytes
}

module.exports = getFolderSize;
