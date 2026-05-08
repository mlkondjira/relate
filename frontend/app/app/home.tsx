import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, RefreshControl,
  StyleSheet, ActivityIndicator
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAuthStore, useDistanceStore } from '../../stores';
import { checkinAPI, momentAPI } from '../../services/api.service';
import * as Location from 'expo-location';

// ─── Couleurs Relate ──────────────────────────────────────────
const COLORS = {
  bg: '#FAF8F5',
  card: '#FFFFFF',
  primary: '#C4785A',   // terracotta doux
  secondary: '#8B6E5C',
  text: '#2C2117',
  textMuted: '#8A7A72',
  border: '#EDE8E3',
  success: '#4CAF7D',
  danger: '#E57373',
};

// ─── Composant distance ───────────────────────────────────────
const DistanceCard = ({ onCheckin }: { onCheckin: () => void }) => {
  const { distanceFormatted, myLabel, partnerLabel, partnerCheckinAt } = useDistanceStore();
  const { partner } = useAuthStore();

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Ionicons name="location-outline" size={18} color={COLORS.primary} />
        <Text style={styles.cardTitle}>Distance</Text>
      </View>

      {distanceFormatted ? (
        <>
          <Text style={styles.distanceText}>{distanceFormatted}</Text>
          <Text style={styles.distanceSub}>
            {myLabel ? `Toi : ${myLabel}` : 'Ta position enregistrée'}
            {partnerLabel ? `  •  ${partner?.name} : ${partnerLabel}` : ''}
          </Text>
          {partnerCheckinAt && (
            <Text style={styles.distanceTime}>
              Dernier check-in de {partner?.name}{' '}
              {formatDistanceToNow(new Date(partnerCheckinAt), { addSuffix: true, locale: fr })}
            </Text>
          )}
        </>
      ) : (
        <Text style={styles.distanceSub}>Aucun check-in enregistré</Text>
      )}

      <TouchableOpacity style={styles.checkinBtn} onPress={onCheckin}>
        <Ionicons name="radio-button-on-outline" size={16} color="#fff" />
        <Text style={styles.checkinBtnText}>Je suis ici</Text>
      </TouchableOpacity>
    </View>
  );
};

// ─── Composant présence partenaire ────────────────────────────
const PartnerPresence = () => {
  const { partner } = useAuthStore();
  if (!partner) return null;

  return (
    <View style={[styles.card, styles.presenceCard]}>
      <View style={styles.presenceRow}>
        <View style={[styles.avatar, { backgroundColor: COLORS.primary + '30' }]}>
          <Text style={styles.avatarText}>{partner.name[0].toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.partnerName}>{partner.name}</Text>
          <View style={styles.onlineRow}>
            <View style={[styles.onlineDot, { backgroundColor: partner.isOnline ? COLORS.success : COLORS.textMuted }]} />
            <Text style={styles.onlineText}>
              {partner.isOnline
                ? 'En ligne maintenant'
                : `Vu ${formatDistanceToNow(new Date(partner.lastSeen), { addSuffix: true, locale: fr })}`}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};

// ─── Composant prochain moment ────────────────────────────────
const NextMomentCard = ({ moment }: { moment: any }) => {
  if (!moment) return null;

  const msLeft = new Date(moment.scheduledAt).getTime() - Date.now();
  const days = Math.floor(msLeft / (1000 * 60 * 60 * 24));
  const hours = Math.floor((msLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Ionicons name="calendar-outline" size={18} color={COLORS.primary} />
        <Text style={styles.cardTitle}>Prochain moment</Text>
      </View>
      <Text style={styles.momentTitle}>{moment.title}</Text>
      <Text style={styles.momentDate}>
        {format(new Date(moment.scheduledAt), 'EEEE d MMMM à HH:mm', { locale: fr })}
      </Text>
      <View style={styles.countdownRow}>
        {days > 0 && <View style={styles.countdownChip}><Text style={styles.countdownNum}>{days}</Text><Text style={styles.countdownLabel}>jours</Text></View>}
        <View style={styles.countdownChip}><Text style={styles.countdownNum}>{hours}</Text><Text style={styles.countdownLabel}>heures</Text></View>
      </View>
    </View>
  );
};

// ─── Écran principal ──────────────────────────────────────────
export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, couple } = useAuthStore();
  const { setDistance } = useDistanceStore();
  const [nextMoment, setNextMoment] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [checkinLoading, setCheckinLoading] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [distanceRes, momentsRes] = await Promise.all([
        checkinAPI.getDistance(),
        momentAPI.getMoments(),
      ]);

      if (distanceRes.data.distance) {
        setDistance({
          distanceKm: distanceRes.data.distance.km,
          distanceFormatted: distanceRes.data.distance.formatted,
          myLabel: distanceRes.data.myLastCheckin?.label,
          partnerLabel: distanceRes.data.partnerLastCheckin?.label,
          partnerCheckinAt: distanceRes.data.partnerLastCheckin?.createdAt,
        });
      }

      const upcoming = momentsRes.data.moments.find(
        (m: any) => new Date(m.scheduledAt) > new Date()
      );
      setNextMoment(upcoming || null);
    } catch {}
  }, []);

  useEffect(() => {
    if (couple) loadData();
  }, [couple]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleCheckin = async () => {
    setCheckinLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        alert('Permission de localisation requise pour le check-in');
        return;
      }

      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const res = await checkinAPI.checkin({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      if (res.data.distance) {
        setDistance({
          distanceKm: res.data.distance.km,
          distanceFormatted: res.data.distance.formatted,
          partnerCheckinAt: res.data.distance.partnerCheckinAt,
        });
      }
    } catch (err) {
      alert('Erreur lors du check-in');
    } finally {
      setCheckinLoading(false);
    }
  };

  if (!couple) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.noCoupleContainer}>
          <Ionicons name="heart-outline" size={48} color={COLORS.primary} />
          <Text style={styles.noCoupleTitle}>Connectez-vous à votre partenaire</Text>
          <Text style={styles.noCoupleText}>Invitez votre partenaire ou rejoignez son espace couple</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push('/app/couple')}>
            <Text style={styles.primaryBtnText}>Commencer</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Relate</Text>
        <TouchableOpacity onPress={() => router.push('/app/settings')}>
          <Ionicons name="settings-outline" size={22} color={COLORS.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <PartnerPresence />
        <DistanceCard onCheckin={handleCheckin} />
        <NextMomentCard moment={nextMoment} />
      </ScrollView>

      {checkinLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={{ marginTop: 8, color: COLORS.text }}>Localisation en cours...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: COLORS.text, letterSpacing: -0.5 },
  scroll: { padding: 16, gap: 12 },
  card: { backgroundColor: COLORS.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: COLORS.border },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  cardTitle: { fontSize: 13, fontWeight: '600', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  distanceText: { fontSize: 36, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  distanceSub: { fontSize: 13, color: COLORS.textMuted, marginBottom: 2 },
  distanceTime: { fontSize: 12, color: COLORS.textMuted, marginBottom: 12 },
  checkinBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.primary, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, alignSelf: 'flex-start', marginTop: 8 },
  checkinBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  presenceCard: { flexDirection: 'row', alignItems: 'center' },
  presenceRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 18, fontWeight: '700', color: COLORS.primary },
  partnerName: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  onlineRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  onlineDot: { width: 7, height: 7, borderRadius: 4 },
  onlineText: { fontSize: 12, color: COLORS.textMuted },
  momentTitle: { fontSize: 18, fontWeight: '600', color: COLORS.text, marginBottom: 4 },
  momentDate: { fontSize: 13, color: COLORS.textMuted, marginBottom: 12, textTransform: 'capitalize' },
  countdownRow: { flexDirection: 'row', gap: 8 },
  countdownChip: { backgroundColor: COLORS.primary + '15', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  countdownNum: { fontSize: 20, fontWeight: '700', color: COLORS.primary },
  countdownLabel: { fontSize: 11, color: COLORS.primary, fontWeight: '500' },
  noCoupleContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  noCoupleTitle: { fontSize: 20, fontWeight: '700', color: COLORS.text, textAlign: 'center' },
  noCoupleText: { fontSize: 14, color: COLORS.textMuted, textAlign: 'center', lineHeight: 20 },
  primaryBtn: { backgroundColor: COLORS.primary, paddingVertical: 14, paddingHorizontal: 28, borderRadius: 14, marginTop: 8 },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  loadingOverlay: { position: 'absolute', bottom: 100, left: 0, right: 0, alignItems: 'center' },
});
