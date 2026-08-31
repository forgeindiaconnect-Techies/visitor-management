const express = require("express");
const router = express.Router();

const User = require("../models/User");
const sendNotification = require("../utils/firebaseNotification");

router.get("/test-notification", async (req, res) => {
  try {
    const user = await User.findOne({ fcmToken: { $ne: "" } });

    if (!user) {
      return res.status(404).json({
        message: "No user with FCM token found"
      });
    }

    await sendNotification(
      user.fcmToken,
      "🎉 Test Notification",
      "Firebase Push Notification is working successfully!"
    );

    res.json({
      success: true,
      message: "Notification sent successfully"
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

module.exports = router;
