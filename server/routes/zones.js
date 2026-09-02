const express = require('express');
const router = express.Router();
const Zone = require('../models/Zone');
const authMiddleware = require('../middleware/authMiddleware');
const getTenantFilter = require('../utils/tenantFilter');

router.use(authMiddleware);

// GET all zones
router.get('/', async (req, res) => {
  try {
    const tenantFilter = getTenantFilter(req);
    const zones = await Zone.find(tenantFilter).sort({ createdAt: -1 });
    res.json(zones);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST a new zone
router.post('/', async (req, res) => {
  const zone = new Zone({ ...req.body, companyId: req.companyId });
  try {
    const newZone = await zone.save();
    res.status(201).json(newZone);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PATCH a zone (update)
router.patch('/:id', async (req, res) => {
  try {
    const tenantFilter = getTenantFilter(req);
    const updatedZone = await Zone.findOneAndUpdate(
      { _id: req.params.id, ...tenantFilter },
      req.body,
      { new: true, runValidators: true }
    );
    if (!updatedZone) return res.status(404).json({ message: 'Zone not found' });
    res.json(updatedZone);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE a zone
router.delete('/:id', async (req, res) => {
  try {
    const tenantFilter = getTenantFilter(req);
    const zone = await Zone.findOneAndDelete({ _id: req.params.id, ...tenantFilter });
    if (!zone) return res.status(404).json({ message: 'Zone not found' });
    res.json({ message: 'Zone deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
