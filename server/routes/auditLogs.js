const express = require('express');
const router = express.Router();
const AuditLog = require('../models/AuditLog');
const authMiddleware = require('../middleware/authMiddleware');
const getTenantFilter = require('../utils/tenantFilter');

router.use(authMiddleware);

// GET audit logs for the current company
router.get('/', async (req, res) => {
  try {
    const tenantFilter = getTenantFilter(req);
    const logs = await AuditLog.find(tenantFilter).sort({ createdAt: -1 }).limit(100);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
