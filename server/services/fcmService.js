const admin = require('../config/firebaseAdmin');
const FCMToken = require('../models/FCMToken');

const sendNotificationToRoles = async ({
  roles,
  title,
  message,
  data = {},
}) => {
  try {
    const tokens = await FCMToken.find({
      role: { $in: roles },
    }).lean();

    const registrationTokens = tokens
      .map((item) => item.token)
      .filter(Boolean);

    if (!registrationTokens.length) {
      return;
    }

    if (!admin.apps.length) {
      console.warn('Firebase Admin SDK is not initialized, skipping multicast FCM push.');
      return;
    }

    const response = await admin.messaging().sendEachForMulticast({
      tokens: registrationTokens,
      notification: {
        title,
        body: message,
      },
      data: Object.fromEntries(
        Object.entries(data).map(([key, value]) => [
          key,
          String(value ?? ''),
        ])
      ),
    });

    console.log(
      `FCM sent: ${response.successCount} successful, ${response.failureCount} failed`
    );

    return response;
  } catch (error) {
    console.error('FCM send error:', error.message);
  }
};

module.exports = {
  sendNotificationToRoles,
};
