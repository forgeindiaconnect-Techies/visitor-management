const express = require('express');
const router = express.Router();
const SecurityAttendance = require('../models/SecurityAttendance');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

// Utility to generate attendance ID
const generateAttendanceId = async (companyId) => {
  const count = await SecurityAttendance.countDocuments({ companyId });
  return `ATT${(count + 1).toString().padStart(4, '0')}`;
};

// GET attendance records
router.get('/', async (req, res) => {
  try {
    let query = { companyId: req.companyId };
    
    if (req.userRole === 'Security') {
      query.securityId = req.userId;
    }
    
    // Enforce strict branch isolation based on role
    if (req.userRole === 'Security' || req.userRole === 'Branch Admin' || req.userRole === 'Receptionist') {
       query.branch = req.branchId;
    } else if (req.query.branch && req.query.branch !== 'All Branches') {
      const branchUpper = req.query.branch.toUpperCase();
      let searchRegexStr = req.query.branch;
      
      if (branchUpper.includes('THIRUPATTUR')) {
        searchRegexStr = `${req.query.branch}|Tirupattur`;
      } else if (branchUpper.includes('KRISHNAGIRI')) {
        searchRegexStr = `${req.query.branch}|Salem`;
      } else if (branchUpper === 'BANGALORE') {
        searchRegexStr = `${req.query.branch}|Bangalore`;
      }
      
      query.branch = { $regex: new RegExp(`^(${searchRegexStr})$`, 'i') };
    }
    if (req.query.securityId) {
      query.securityId = req.query.securityId;
    }
    if (req.query.date) {
      query.date = req.query.date;
    }
    
    const logs = await SecurityAttendance.find(query).sort({ createdAt: -1 });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST Check In
router.post('/checkin', async (req, res) => {
  try {
    const { date, checkInTime, checkInPhoto, checkInLocation, securityName: bodySecurityName } = req.body;
    
    const securityId = req.userId;
    const branch = req.branchId || 'All Branches';
    const securityName = req.userName || req.user?.name || bodySecurityName || 'Security';
    
    // Check if already checked in today
    const existing = await SecurityAttendance.findOne({ companyId: req.companyId, securityId, date });
    if (existing) {
      return res.status(400).json({ message: 'Already checked in today' });
    }

    const attendanceId = await generateAttendanceId(req.companyId);
    
    const attendance = new SecurityAttendance({
      companyId: req.companyId,
      attendanceId,
      securityId,
      securityName,
      branch,
      date,
      checkInTime,
      checkInPhoto,
      checkInLocation,
      attendanceStatus: 'Present'
    });

    const saved = await attendance.save();

    const Notification = require('../models/Notification');
    const notification = await Notification.create({
      companyId: req.companyId,
      branchId: branch,
      type: 'Attendance',
      title: '🕒 Security Attendance',
      message: `${securityName} checked in at ${checkInTime}.`,
      createdBy: securityName
    });
    
    const io = req.app.get('io');
    if (io) {
      io.to(`company:${notification.companyId}`).emit('new_notification', notification);
    }

    res.status(201).json(saved);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH Check Out
router.patch('/checkout/:id', async (req, res) => {
  try {
    const { checkOutTime, workingHours, checkOutPhoto, checkOutLocation } = req.body;
    
    let query = { _id: req.params.id, companyId: req.companyId };
    if (req.userRole === 'Security') {
      query.securityId = req.userId;
    }
    
    const attendance = await SecurityAttendance.findOneAndUpdate(
      query,
      { 
        checkOutTime, 
        checkOutPhoto,
        workingHours, 
        checkOutLocation,
        attendanceStatus: 'Completed' 
      },
      { new: true }
    );
    
    if (!attendance) {
      return res.status(404).json({ message: 'Attendance record not found' });
    }

    const Notification = require('../models/Notification');
    const notification = await Notification.create({
      companyId: req.companyId,
      branchId: attendance.branch,
      type: 'Attendance',
      title: '🚪 Security Checked Out',
      message: `${attendance.securityName} checked out at ${checkOutTime}.`,
      createdBy: attendance.securityName
    });
    
    const io = req.app.get('io');
    if (io) {
      io.to(`company:${notification.companyId}`).emit('new_notification', notification);
    }
    
    res.json(attendance);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Auto Check-Out Cron Job
const cron = require('node-cron');

// Run every day at 20:00 (8:00 PM)
cron.schedule('0 20 * * *', async () => {
  console.log('⏰ Running auto check-out job at 20:00...');
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Find all 'Present' attendance logs for today
    const activeLogs = await SecurityAttendance.find({
      date: today,
      attendanceStatus: 'Present'
    });
    
    for (const log of activeLogs) {
      log.checkOutTime = '20:00';
      log.attendanceStatus = 'Auto Checked-Out';
      log.autoCheckout = true;
      // Calculate working hours if needed, though they can be recalculated or left empty
      if (log.checkInTime) {
        // Simple logic for working hours: 20:00 - checkInTime
        // In a real scenario, use moment.js or similar. We'll leave it empty or default.
        log.workingHours = 'Auto'; 
      }
      await log.save();
      console.log(`Auto checked out ${log.securityName} (${log.securityId})`);
    }
  } catch (err) {
    console.error('Auto check-out job error:', err);
  }
});

module.exports = router;
