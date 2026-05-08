export default {
  expo: {
    name: 'Relate',
    slug: 'relate-app',
    version: '1.0.0',
    scheme: 'relate-app', // Ajout du scheme pour le deep linking
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'automatic',
    splash: {
      backgroundColor: '#FAF8F5',
    },
    ios: {
      supportsTablet: false,
      bundleIdentifier: 'com.yourname.relate',
      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          'Relate utilise votre position pour calculer la distance avec votre partenaire au moment du check-in.',
      },
    },
    android: {
      adaptiveIcon: {
        backgroundColor: '#FAF8F5',
      },
      package: 'com.yourname.relate',
      permissions: [
        'ACCESS_FINE_LOCATION',
        'ACCESS_COARSE_LOCATION',
        'RECEIVE_BOOT_COMPLETED',
        'VIBRATE',
      ],
    },
    plugins: [
      [
        'expo-notifications',
        {
          icon: './assets/notification-icon.png',
          color: '#C4785A',
          sounds: [],
        },
      ],
      [
        'expo-location',
        {
          locationWhenInUsePermission:
            'Relate utilise votre position pour calculer la distance avec votre partenaire.',
        },
      ],
    ],
    extra: {
      // Variables accessibles via process.env.EXPO_PUBLIC_*
      apiUrl: process.env.EXPO_PUBLIC_API_URL,
      projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
      eas: {
        projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
      },
    },
  },
};
