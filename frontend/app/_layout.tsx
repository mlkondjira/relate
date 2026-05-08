import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useAuthStore } from '../stores';
import {
  configureNotifications,
  registerForPushNotifications,
  addNotificationResponseListener,
} from '../services/notifications.service';

// Configurer le handler dès le chargement du module
configureNotifications();

export default function RootLayout() {
  const { user, isLoading, loadFromStorage } = useAuthStore();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    loadFromStorage();
  }, []);

  // Enregistrer le push token dès que l'utilisateur est connecté
  useEffect(() => {
    if (!user) return;
    registerForPushNotifications();

    // Naviguer selon le type de notification tapée
    const cleanup = addNotificationResponseListener((type, data) => {
      if (type === 'PARTNER_MESSAGE') router.push('/app/chat');
      if (type === 'MOMENT_REMINDER') router.push('/app/moments');
      if (type === 'PARTNER_CHECKIN') router.push('/app/home');
    });
    return cleanup;
  }, [user?.id]);

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === 'auth';

    if (!user && !inAuthGroup) {
      router.replace('/auth/login');
    } else if (user && inAuthGroup) {
      router.replace('/app/home');
    }
  }, [user, isLoading, segments]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="auth" />
        <Stack.Screen name="app" />
      </Stack>
    </GestureHandlerRootView>
  );
}
