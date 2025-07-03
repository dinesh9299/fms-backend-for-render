const express = require("express");
const router = express.Router();
const {
  addDepartment,
  editDepartment,
  deleteDepartment,
} = require("../controllers/department_controller");
const { getDepartments } = require("../controllers/department_controller");

router.post("/departments", addDepartment);
router.put("/departments/:id", editDepartment);
router.delete("/departments/:id", deleteDepartment);
router.get("/departments", getDepartments);

module.exports = router;
