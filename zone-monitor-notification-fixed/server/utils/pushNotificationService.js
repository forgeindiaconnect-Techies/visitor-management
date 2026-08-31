const { Expo } = require('expo-server-sdk');

const expo = new Expo();

async function sendPushNotification(tokens, title, body, data = {}) {
  try {
    const validTokens = tokens.filter(token => Expo.isExpoPushToken(token));

    if (validTokens.length === 0) {
      console.log('No valid Expo push tokens found');
      return;
    }

    const messages = validTokens.map(token => ({
      to: token,
      title,
      body,
      data,
      channelId: 'default',
      priority: 'high'
    }));

    const chunks = expo.chunkPushNotifications(messages);

    for (const chunk of chunks) {
      const tickets =
        await expo.sendPushNotificationsAsync(chunk);

      console.log('Expo push tickets:', tickets);
    }
  } catch (error) {
    console.error('Push notification error:', error);
  }
}

module.exports = sendPushNotification;
