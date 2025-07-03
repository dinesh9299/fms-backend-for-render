const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
require("dotenv").config();

const JWT_SECRET = process.env.JWT_SECRET || "yoursecretkey";

// login controller
// Unified Login (for both User and Admin)
exports.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    // Find the user or admin by email (no need to differentiate here)
    const user = await User.findOne({ email });

    if (!user) return res.status(404).json({ message: "User not found" });

    // Check the password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(401).json({ message: "Invalid credentials" });

    // Generate JWT token with user id and role
    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, {
      expiresIn: "1h",
    });

    // Return token and user role (could be either "user" or "admin")
    res.json({ token, role: user.role });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// Create First Admin
exports.createFirstAdmin = async (req, res) => {
  const { name, email, password } = req.body;

  try {
    // Check if there's already an admin in the database
    const admin = await User.findOne({ role: "admin" });

    if (admin) {
      return res.status(400).json({ message: "Admin already exists" });
    }

    // Hash the password before saving
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create the first admin
    const newAdmin = new User({
      name,
      email,
      password: hashedPassword,
      role: "admin",
    });

    // Save the new admin user to the database
    await newAdmin.save();

    res.status(201).json({ message: "First admin created successfully" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// Admin Login
exports.adminLogin = async (req, res) => {
  const { email, password } = req.body;

  try {
    const admin = await User.findOne({ email, role: "admin" });
    if (!admin) return res.status(404).json({ message: "Admin not found" });

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch)
      return res.status(401).json({ message: "Invalid credentials" });

    const token = jwt.sign({ id: admin._id, role: admin.role }, JWT_SECRET, {
      expiresIn: "1h",
    });

    res.json({ token, role: admin.role });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false, // ⚠️ Don't use in production
  },
});

exports.registerUser = async (req, res) => {
  const { name, email, password, role, department } = req.body;

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ message: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      role: role,
      department: department,
    });

    await newUser.save();

    // Prepare login URL and mail content
    const loginUrl = "https://fms.brihaspathi.com/login"; // change to your frontend login URL
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Welcome! Your Account Has Been Created",
      html: `
        <h3>Hi ${name},</h3>
        <p>Your account has been created successfully.</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Password:</strong> ${password}</p>
        <p>You can log in using the following link:</p>
        <a href="${loginUrl}">${loginUrl}</a>
        <br/><br/>
        <p>Thank you,<br/>BTPL Team</p>
      `,
    };

    await transporter.sendMail(mailOptions);

    res
      .status(201)
      .json({ message: "User created and email sent successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// User Login
exports.userLogin = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(401).json({ message: "Invalid credentials" });

    // Generate JWT Token
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Remove password before sending user data
    const { password: _, ...userWithoutPassword } = user.toObject();

    res.json({
      message: "Login successful",
      token,
      user: user,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getUsers = async (req, res) => {
  try {
    const users = await User.find({});

    return res.json({
      message: "users list",
      data: users,
    });
  } catch (error) {
    console.log("error", error);
  }
};

exports.deleteuser = async (req, res) => {
  const { id } = req.params; // Destructure id from the params

  try {
    // Use findByIdAndDelete to delete the user by their ID
    await User.findByIdAndDelete(id);

    return res.json({
      message: "User deleted successfully",
    });
  } catch (error) {
    console.log("Error deleting user:", error);
    res.status(500).json({
      message: "Server error while deleting user",
    });
  }
};

exports.changePassword = async (req, res) => {
  const userId = req.user.id; // assuming you use middleware to set req.user
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Compare current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res
        .status(203)
        .json({ message: "Current password is incorrect", success: false });
    }

    // Hash and update the new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedNewPassword;
    await user.save();

    res.json({ message: "Password updated successfully", success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
