const jwt = require("jsonwebtoken");

exports.decodeToken = (req, res) => {
  try {
    // Get token from Authorization header: "Bearer <token>"
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Authorization token missing" });
    }

    const token = authHeader.split(" ")[1];

    // Verify and decode the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Return decoded user info (id, role, etc)
    res.json({
      message: "Token decoded successfully",
      user: decoded,
    });
  } catch (err) {
    console.error("Token decode error:", err);
    res.status(401).json({ message: "Invalid or expired token" });
  }
};
