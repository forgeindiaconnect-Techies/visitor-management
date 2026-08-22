const ApprovalPermission = require('../models/ApprovalPermission');

const checkApprovalPermission = async (req, res, next) => {
  try {
    // Accommodate both req.user.role (if populated) and req.userRole (from authMiddleware)
    const rawRole = (req.user && req.user.role) ? req.user.role : req.userRole;
    
    if (!rawRole) {
      return res.status(403).json({
        success: false,
        message: "No user role found for permission check"
      });
    }

    // Normalize role string (e.g., "Senior HR" -> "SENIOR_HR", "Branch Admin" -> "BRANCH_ADMIN", "Admin" -> "ADMIN")
    const role = rawRole.toUpperCase().replace(/\s+/g, '_');

    // SaaS Super Admin automatically bypasses
    const isSaaSAdmin = rawRole === 'SaaS Super Admin' || role === 'SAAS_SUPER_ADMIN' || (req.userId && String(req.userId).startsWith('bootstrap-'));
    if (isSaaSAdmin) {
      return next();
    }

    // Standard approval roles that have permission by default
    const defaultApprovalRoles = ['SUPER_ADMIN', 'SAAS_SUPER_ADMIN', 'MD', 'SENIOR_HR', 'ADMIN', 'BRANCH_ADMIN', 'HR'];
    const isDefaultRole = defaultApprovalRoles.includes(role);

    // Named approver fallback list
    const allowedApprovers = ['sandeep', 'avinash', 'agila', 'jeo', 'joe christo', 'vaideeswari'];
    let nameToCheck = req.userName;
    if (!nameToCheck && req.userId) {
      const User = require('../models/User');
      const userObj = await User.findById(req.userId);
      if (userObj) {
        nameToCheck = userObj.name;
      }
    }
    const userNameLower = nameToCheck ? nameToCheck.toLowerCase().trim() : '';
    const isNamedApprover = allowedApprovers.some(allowed => userNameLower.includes(allowed));

    // Check explicit permission table
    let permission = await ApprovalPermission.findOne({ role });

    if (permission) {
      if (permission.canApprove || isNamedApprover) {
        return next();
      } else {
        return res.status(403).json({
          success: false,
          message: "You do not have permission to approve/reject visitors",
        });
      }
    }

    // If no explicit DB record, allow if default approval role or named approver
    if (isDefaultRole || isNamedApprover) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: "You do not have permission to approve/reject visitors",
    });
  } catch (error) {
    console.error("Approval permission error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to verify approval permission",
    });
  }
};

module.exports = checkApprovalPermission;
module.exports.checkApprovalPermission = checkApprovalPermission;
