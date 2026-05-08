import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useChatStore } from '../../stores';

const C = {
  primary: '#C4785A',
  inactive: '#B4A49C',
  bg: '#FFFFFF',
  border: '#EDE8E3',
  badge: '#E57373',
};

// ─── Badge de messages non lus ────────────────────────────────
const UnreadBadge = () => {
  const { messages } = useChatStore();
  // Compter les messages non lus (pas encore readAt et pas les miens)
  // Note: en prod on stockerait l'userId dans le store pour comparer
  const unread = messages.filter((m) => !m.readAt).length;
  if (unread === 0) return null;
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
    </View>
  );
};

// ─── Icône d'onglet avec badge optionnel ─────────────────────
const TabIcon = ({
  name,
  focused,
  showBadge = false,
}: {
  name: keyof typeof Ionicons.glyphMap;
  focused: boolean;
  showBadge?: boolean;
}) => (
  <View style={{ position: 'relative' }}>
    <Ionicons
      name={focused ? name : (`${name}-outline` as keyof typeof Ionicons.glyphMap)}
      size={24}
      color={focused ? C.primary : C.inactive}
    />
    {showBadge && <UnreadBadge />}
  </View>
);

export default function AppLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: C.primary,
        tabBarInactiveTintColor: C.inactive,
        tabBarLabelStyle: styles.label,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Accueil',
          tabBarIcon: ({ focused }) => <TabIcon name="home" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Messages',
          tabBarIcon: ({ focused }) => (
            <TabIcon name="chatbubble" focused={focused} showBadge />
          ),
        }}
      />
      <Tabs.Screen
        name="moments"
        options={{
          title: 'Moments',
          tabBarIcon: ({ focused }) => <TabIcon name="calendar" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="cycle"
        options={{
          title: 'Cycle',
          tabBarIcon: ({ focused }) => <TabIcon name="heart" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Profil',
          tabBarIcon: ({ focused }) => <TabIcon name="person" focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: C.bg,
    borderTopWidth: 1,
    borderTopColor: C.border,
    height: 60,
    paddingBottom: 6,
    paddingTop: 6,
  },
  label: { fontSize: 11, fontWeight: '500' },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: C.badge,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
});
