const ApprovalPermission = require("../models/ApprovalPermission");

// Get permissions
exports.getPermissions = async (req, res) => {
  try {
    const permissions = await ApprovalPermission.find({}, { _id: 0, role: 1, canApprove: 1 }).lean();
    return res.status(200).json({
      success: true,
      permissions
    });
  } catch (error) {
    console.error("Get Permissions Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// Update permission
exports.updatePermission = async (req, res) => {
  try {
    const { role } = req.params;
    const { canApprove } = req.body;

    const allowedRoles = ["SUPER_ADMIN", "MD", "SENIOR_HR", "IT", "HR", "ADMIN", "BRANCH_ADMIN"];
    
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `Invalid role. Allowed roles are: ${allowedRoles.join(", ")}`
      });
    }

    const permission = await ApprovalPermission.findOneAndUpdate(
      { role },
      { 
        canApprove,
        updatedBy: req.user ? req.user._id : null
      },
      { new: true, runValidators: true }
    );

    if (!permission) {
      return res.status(404).json({ success: false, message: "Permission record not found." });
    }

    return res.status(200).json({
      success: true,
      permission
    });

  } catch (error) {
    console.error("Update Permission Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.getMyPermission = async (req, res) => {
  try {
    const rawRole = (req.userRole || '').toUpperCase().replace(/\s+/g, '_');
    
    if (!rawRole) {
      return res.status(200).json({ success: true, role: null, canApprove: false });
    }
    
    let permission = await ApprovalPermission.findOne({ role: rawRole });
    
    if (!permission) {
      const defaultRoles = ['SUPER_ADMIN', 'MD', 'SENIOR_HR', 'IT', 'HR', 'ADMIN', 'BRANCH_ADMIN'];
      if (defaultRoles.includes(rawRole)) {
        permission = { canApprove: true };
      }
    }
    
    return res.status(200).json({
      success: true,
      role: rawRole,
      canApprove: permission ? permission.canApprove : false
    });
  } catch (error) {
    console.error('Error fetching my permission:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
