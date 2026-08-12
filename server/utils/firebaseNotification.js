const app = require('../config/firebaseAdmin');
const { getMessaging } = require("firebase-admin/messaging");

const sendNotification = async (token, title, body) => {
  if (!token) return;
  
  try {
    if (token.startsWith('ExponentPushToken')) {
      // Send via Expo Push API using native Node 18+ fetch
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: token,
          sound: 'default',
          title: title,
          body: body,
        }),
      });
      console.log(`Expo Push notification sent to ${token}`, await response.json());
    } else {
      // Send via Firebase Admin for Web FCM tokens
      if (!app) {
        console.warn("Firebase Admin SDK is not initialized. Skipping Firebase Push notification.");
        return;
      }
      const messaging = getMessaging(app);
      await messaging.send({
        token: token,
        notification: {
          title: title,
          body: body
        }
      });
      console.log(`Firebase Push notification sent successfully to ${token}`);
    }
  } catch (error) {
    console.error("Error sending push notification:", error);
  }
};

module.exports = sendNotification;
