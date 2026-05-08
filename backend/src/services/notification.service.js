const { Expo } = require('expo-server-sdk');
const expo = new Expo();

/**
 * Envoie une notification push via Expo
 * @param {string} pushToken - Token Expo de l'utilisateur
 * @param {{ title: string, body: string, data?: object }} notification
 */
const sendPushNotification = async (pushToken, { title, body, data = {} }) => {
  if (!Expo.isExpoPushToken(pushToken)) {
    console.warn(`Token push invalide: ${pushToken}`);
    return;
  }

  try {
    const ticket = await expo.sendPushNotificationsAsync([
      {
        to: pushToken,
        sound: 'default',
        title,
        body,
        data,
      },
    ]);
    return ticket;
  } catch (err) {
    console.error('Erreur notification push:', err);
  }
};

module.exports = { sendPushNotification };
