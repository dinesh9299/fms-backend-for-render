const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Ensure the uploads directory exists
const uploadPath = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname); // Get the extension like .jpg, .png
    const baseName = path.basename(file.originalname, ext); // Remove extension from name
    const uniqueSuffix = Date.now(); // or you can use uuid
    cb(null, `${baseName}-${uniqueSuffix}${ext}`);
  },
});

module.exports = multer({ storage });
