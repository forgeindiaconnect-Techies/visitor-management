const express = require('express');
const router = express.Router();
const Zone = require('../models/Zone');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

// GET all zones
router.get('/', async (req, res) => {
  try {
    const zones = await Zone.find({ companyId: req.companyId }).sort({ createdAt: -1 });
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
    const updatedZone = await Zone.findOneAndUpdate(
      { _id: req.params.id, companyId: req.companyId },
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
    const zone = await Zone.findOneAndDelete({ _id: req.params.id, companyId: req.companyId });
    if (!zone) return res.status(404).json({ message: 'Zone not found' });
    res.json({ message: 'Zone deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
