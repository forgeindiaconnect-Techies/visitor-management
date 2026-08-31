const express = require('express');
const router = express.Router();
const approvalPermissionController = require('../controllers/approvalPermissionController');
const authMiddleware = require('../middleware/authMiddleware');

// Super Admin Middleware
const superAdminMiddleware = (req, res, next) => {
  // Check if role is SUPER_ADMIN or "Super Admin" (since the DB might hold different casing depending on token)
  const role = (req.userRole || '').toUpperCase().replace(/\s+/g, '_');
  if (role !== 'SUPER_ADMIN' && role !== 'SAAS_SUPER_ADMIN') {
    return res.status(403).json({ message: 'Forbidden: Super Admin access required' });
  }
  next();
};

// All routes require authentication
router.use(authMiddleware);

// Get current user's approval permission (accessible to any authenticated user)
router.get('/my-permission', approvalPermissionController.getMyPermission);

// Get all permissions
router.get('/', superAdminMiddleware, approvalPermissionController.getPermissions);

// Update a permission
router.put('/:role', superAdminMiddleware, approvalPermissionController.updatePermission);

module.exports = router;
