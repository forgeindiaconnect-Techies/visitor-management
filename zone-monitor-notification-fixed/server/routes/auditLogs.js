const express = require('express');
const router = express.Router();
const AuditLog = require('../models/AuditLog');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

// GET audit logs for the current company
router.get('/', async (req, res) => {
  try {
    let logs;
    // SaaS Super Admin can see everything if they don't pass a specific filter, 
    // but usually they will hit a different endpoint or pass a filter.
    // For now, if companyId is SYSTEM, show all logs or allow them to view all.
    if (req.companyId === 'SYSTEM') {
      logs = await AuditLog.find().sort({ createdAt: -1 }).limit(100);
    } else {
      logs = await AuditLog.find({ companyId: req.companyId }).sort({ createdAt: -1 }).limit(100);
    }
    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
