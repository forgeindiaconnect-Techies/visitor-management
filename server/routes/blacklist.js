const express = require('express');
const router = express.Router();
const Blacklist = require('../models/Blacklist');
const authMiddleware = require('../middleware/authMiddleware');
const getTenantFilter = require('../utils/tenantFilter');

router.use(authMiddleware);

// GET all blacklist entries
router.get('/', async (req, res) => {
  try {
    const tenantFilter = getTenantFilter(req);
    const blacklist = await Blacklist.find(tenantFilter).sort({ createdAt: -1 });
    res.json(blacklist);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET check if a mobile number is blacklisted
router.get('/check/:mobileNumber', async (req, res) => {
  try {
    const tenantFilter = getTenantFilter(req);
    const entry = await Blacklist.findOne({ 
      ...tenantFilter, 
      mobileNumber: req.params.mobileNumber 
    });
    if (entry) {
      res.json({ isBlacklisted: true, reason: entry.reason });
    } else {
      res.json({ isBlacklisted: false });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST a new blacklist entry
router.post('/', async (req, res) => {
  const entry = new Blacklist({ ...req.body, companyId: req.companyId });
  try {
    const newEntry = await entry.save();
    res.status(201).json(newEntry);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE a blacklist entry (unblock)
router.delete('/:id', async (req, res) => {
  try {
    const tenantFilter = getTenantFilter(req);
    const entry = await Blacklist.findOneAndDelete({ _id: req.params.id, ...tenantFilter });
    if (!entry) return res.status(404).json({ message: 'Entry not found' });
    res.json({ message: 'Removed from blacklist' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
