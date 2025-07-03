const express = require("express");
const router = express.Router();
const authController = require("../controllers/Usercontroller");
const { decodeToken } = require("../controllers/decodecontroller");

const authMiddleware = require("../middleware/auth");

router.post("/login", authController.userLogin);
// Public: Admin login
// router.post("/admin/login", authController.adminLogin);

// Public: User login
// router.post("/user/login", authController.userLogin);

// Protected: Only admin can register users
router.post("/register", authController.registerUser);

router.get("/decode-token", decodeToken);

router.get("/getusers", authController.getUsers);
router.delete("/deleteuser/:id", authController.deleteuser);

router.put("/change-password", authMiddleware, authController.changePassword);

module.exports = router;
