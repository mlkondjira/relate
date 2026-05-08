import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { authAPI } from './api.service';

// ─── Config globale des notifications ────────────────────────
// À appeler au démarrage de l'app (dans _layout.tsx)
export const configureNotifications = () => {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
};

// ─── Demander la permission + enregistrer le token ───────────
export const registerForPushNotifications = async (): Promise<string | null> => {
  // Les push ne fonctionnent que sur device physique
  if (!Device.isDevice) {
    console.log('Push notifications: émulateur détecté, ignoré');
    return null;
  }

  // Vérifier/demander la permission
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Permission push refusée');
    return null;
  }

  // Canal Android obligatoire
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('relate-default', {
      name: 'Relate',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#C4785A',
    });
  }

  // Récupérer le token Expo
  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
  });
  const token = tokenData.data;

  // Envoyer le token au backend
  try {
    await authAPI.updatePushToken(token);
  } catch (err) {
    console.error('Erreur envoi push token:', err);
  }

  return token;
};

// ─── Listener de navigation sur tap notification ─────────────
// Retourne une fonction de cleanup
export const addNotificationResponseListener = (
  onNotification: (type: string, data: any) => void
) => {
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as any;
    if (data?.type) onNotification(data.type, data);
  });
  return () => sub.remove();
};

// ─── Types de notifications reçues ───────────────────────────
// COUPLE_JOINED     → partenaire a rejoint
// PARTNER_MESSAGE   → nouveau message
// MOMENT_REMINDER   → rappel d'un moment dans 1h
// PARTNER_CHECKIN   → partenaire a fait un check-in
