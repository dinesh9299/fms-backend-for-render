const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET || "yoursecretkey";

module.exports = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1]; // "Bearer TOKEN"

  if (!token) return res.status(401).json({ message: "No token, auth denied" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== "admin") {
      return res.status(403).json({ message: "Access denied: Admins only" });
    }
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ message: "Invalid token" });
  }
};
