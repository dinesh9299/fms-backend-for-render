const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const fileRoutes = require("./routes/fileRoutes");
const userRoutes = require("./routes/userRoutes");
const departmentRoutes = require("./routes/department");

require("dotenv").config();

const app = express();
const server = http.createServer(app); // 🔁 Use HTTP server instead of app.listen
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    credentials: true,
  },
});

// Attach Socket.IO to app
app.set("io", io);

// Middleware
app.use(
  cors({
    origin: ["http://localhost:5173", "http://192.168.1.11:5173"],
    credentials: true,
  })
);
app.use(express.json());
app.use("/uploads", express.static("uploads"));

// Routes
app.use("/api/files", fileRoutes);
app.use("/api", userRoutes);
app.use("/api", departmentRoutes);

// Socket.IO connection listener
io.on("connection", (socket) => {
  console.log("🔗 User connected:", socket.id);

  socket.on("join", (userId) => {
    if (userId) {
      socket.join(userId);
      console.log(`✅ User joined room: ${userId}`);
    }
  });

  socket.on("disconnect", () => {
    console.log("❌ User disconnected:", socket.id);
  });
});

// Start server after DB connection
const startServer = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    server.listen(5000, () => {
      console.log("🚀 Server running on http://localhost:5000");
    });
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err.message);
  }
};

startServer();
