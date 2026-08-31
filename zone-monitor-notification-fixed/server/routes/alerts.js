const express = require('express');
const router = express.Router();
const Alert = require('../models/Alert');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

// GET all alerts
router.get('/', async (req, res) => {
  try {
    const alerts = await Alert.find({ companyId: req.companyId }).sort({ timestamp: -1 });
    res.json(alerts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST a new alert
router.post('/', async (req, res) => {
  const alert = new Alert({ ...req.body, companyId: req.companyId });
  try {
    const newAlert = await alert.save();
    res.status(201).json(newAlert);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PATCH an alert (e.g., mark as resolved)
router.patch('/:id', async (req, res) => {
  try {
    const updatedAlert = await Alert.findOneAndUpdate(
      { _id: req.params.id, companyId: req.companyId },
      req.body,
      { new: true }
    );
    if (!updatedAlert) return res.status(404).json({ message: 'Alert not found' });
    res.json(updatedAlert);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
