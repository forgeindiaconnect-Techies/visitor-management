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

    // Normalize role string (e.g., "Senior HR" -> "SENIOR_HR")
    const role = rawRole.toUpperCase().replace(/\s+/g, '_');

    // SaaS Super Admin automatically bypasses
    const isSaaSAdmin = rawRole === 'SaaS Super Admin' || (req.userId && req.userId.startsWith('bootstrap-'));

    // Check strict name approval list for non-SaaS Super Admin
    if (!isSaaSAdmin) {
      const allowedApprovers = ['sandeep', 'avinash', 'agila', 'jeo', 'joe christo'];
      let nameToCheck = req.userName;
      
      // Fetch user from DB if not populated
      if (!nameToCheck && req.userId) {
        const User = require('../models/User');
        const userObj = await User.findById(req.userId);
        if (userObj) {
          nameToCheck = userObj.name;
        }
      }

      const userNameLower = nameToCheck ? nameToCheck.toLowerCase().trim() : '';
      const isAllowed = allowedApprovers.some(allowed => userNameLower.includes(allowed));

      if (!userNameLower || !isAllowed) {
        return res.status(403).json({
          success: false,
          message: "You do not have permission to approve/reject visitors. Only Sandeep, Avinash, Agila, and Jeo are authorized."
        });
      }
    }

    // Super Admins automatically bypass or are handled gracefully, but let's check explicit permission table
    let permission = await ApprovalPermission.findOne({ role });

    // Fallback: If no document exists yet, check against defaults
    if (!permission) {
      const defaultRoles = ['SUPER_ADMIN', 'MD', 'SENIOR_HR', 'IT'];
      if (defaultRoles.includes(role)) {
        permission = { canApprove: true };
      }
    }

    if (!permission || !permission.canApprove) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to approve visitors",
      });
    }

    next();
  } catch (error) {
    console.error("Approval permission error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to verify approval permission",
    });
  }
};

module.exports = checkApprovalPermission;
