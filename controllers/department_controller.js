const Department = require("../models/department");

// ➕ Add Department
exports.addDepartment = async (req, res) => {
  try {
    const { name } = req.body;

    const existing = await Department.findOne({ name: name.trim() });
    if (existing) {
      return res.status(400).json({ error: "Department already exists" });
    }

    const department = new Department({ name: name.trim() });
    await department.save();

    res.status(201).json({ success: true, department });
  } catch (err) {
    res.status(500).json({ error: "Failed to add department" });
  }
};

// GET /api/departments
exports.getDepartments = async (req, res) => {
  try {
    const departments = await Department.find().sort({ createdAt: -1 });
    res.json(departments);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch departments" });
  }
};

// ✏️ Edit Department
exports.editDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    const updated = await Department.findByIdAndUpdate(
      id,
      { name: name.trim() },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ error: "Department not found" });
    }

    res.json({ success: true, department: updated });
  } catch (err) {
    res.status(500).json({ error: "Failed to update department" });
  }
};

// ❌ Delete Department
exports.deleteDepartment = async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await Department.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ error: "Department not found" });
    }

    res.json({ success: true, message: "Department deleted" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete department" });
  }
};
