import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Modal, TextInput,
  StyleSheet, Alert, Pressable, Animated, RefreshControl,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { format, formatDistanceToNow, isPast } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAuthStore } from '../../stores';
import { momentAPI } from '../../services/api.service';

const C = {
  bg: '#FAF8F5', card: '#FFFFFF', primary: '#C4785A', primaryLight: '#F5EBE5',
  text: '#2C2117', textMuted: '#8A7A72', border: '#EDE8E3',
  success: '#4CAF7D', successLight: '#E8F5EE',
  danger: '#E57373', dangerLight: '#FDECEA', inputBg: '#F3EDE8',
};

interface Moment {
  id: string; title: string; description?: string;
  scheduledAt: string; location?: string;
  status: 'UPCOMING' | 'PASSED' | 'CANCELLED';
  createdBy: { id: string; name: string };
}

// ─── Compte à rebours live (re-render chaque minute) ──────────
const useCountdown = (targetDate: string) => {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);
  const diff = new Date(targetDate).getTime() - now.getTime();
  if (diff <= 0) return null;
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
  };
};

const CountdownChip = ({ value, label }: { value: number; label: string }) => (
  <View style={styles.chip}>
    <Text style={styles.chipNum}>{value}</Text>
    <Text style={styles.chipLabel}>{label}</Text>
  </View>
);

// ─── Carte moment ─────────────────────────────────────────────
const MomentCard = ({ moment, onDelete, isOwner }: { moment: Moment; onDelete: (id: string) => void; isOwner: boolean }) => {
  const countdown = useCountdown(moment.scheduledAt);
  const passed = isPast(new Date(moment.scheduledAt));
  const scale = useRef(new Animated.Value(1)).current;

  const confirmDelete = () =>
    Alert.alert('Supprimer', `Supprimer "${moment.title}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => onDelete(moment.id) },
    ]);

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        style={[styles.card, passed && styles.cardPassed]}
        onPressIn={() => Animated.spring(scale, { toValue: 0.98, useNativeDriver: true }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start()}
      >
        <View style={[styles.accent, { backgroundColor: passed ? C.textMuted : C.primary }]} />
        <View style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, passed && { color: C.textMuted }]}>{moment.title}</Text>
              {moment.description ? <Text style={styles.cardDesc} numberOfLines={2}>{moment.description}</Text> : null}
            </View>
            {isOwner && !passed && (
              <TouchableOpacity onPress={confirmDelete} style={{ padding: 4 }} hitSlop={8}>
                <Ionicons name="trash-outline" size={16} color={C.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.metaGroup}>
            <View style={styles.metaRow}>
              <Ionicons name="calendar-outline" size={13} color={C.textMuted} />
              <Text style={styles.metaText}>{format(new Date(moment.scheduledAt), "EEEE d MMM 'à' HH:mm", { locale: fr })}</Text>
            </View>
            {moment.location ? (
              <View style={styles.metaRow}>
                <Ionicons name="location-outline" size={13} color={C.textMuted} />
                <Text style={styles.metaText}>{moment.location}</Text>
              </View>
            ) : null}
            <View style={styles.metaRow}>
              <Ionicons name="person-outline" size={13} color={C.textMuted} />
              <Text style={styles.metaText}>Créé par {moment.createdBy.name}</Text>
            </View>
          </View>

          {!passed && countdown ? (
            <View style={styles.countdownRow}>
              {countdown.days > 0 && <CountdownChip value={countdown.days} label="j" />}
              {countdown.hours > 0 && <CountdownChip value={countdown.hours} label="h" />}
              {countdown.days === 0 && <CountdownChip value={countdown.minutes} label="min" />}
            </View>
          ) : !passed ? (
            <View style={[styles.badge, { backgroundColor: C.successLight }]}>
              <Text style={[styles.badgeText, { color: C.success }]}>C'est aujourd'hui ! 🎉</Text>
            </View>
          ) : (
            <View style={styles.metaRow}>
              <Ionicons name="checkmark-circle-outline" size={13} color={C.textMuted} />
              <Text style={styles.metaText}>{formatDistanceToNow(new Date(moment.scheduledAt), { addSuffix: true, locale: fr })}</Text>
            </View>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
};

// ─── Modal création ───────────────────────────────────────────
const CreateModal = ({ visible, onClose, onCreate }: { visible: boolean; onClose: () => void; onCreate: (d: any) => Promise<void> }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const reset = () => { setTitle(''); setDescription(''); setLocation(''); setDate(''); setTime(''); setError(''); };
  const handleClose = () => { reset(); onClose(); };

  const handleCreate = async () => {
    setError('');
    if (!title.trim()) return setError('Le titre est requis');
    if (!date || !time) return setError('Date et heure requises');
    const [day, month, year] = date.split('/').map(Number);
    const [h, m] = time.split(':').map(Number);
    const scheduledAt = new Date(year, month - 1, day, h, m);
    if (isNaN(scheduledAt.getTime())) return setError('Format invalide');
    if (isPast(scheduledAt)) return setError('La date doit être dans le futur');
    setLoading(true);
    try {
      await onCreate({ title: title.trim(), description: description.trim() || undefined, location: location.trim() || undefined, scheduledAt: scheduledAt.toISOString() });
      reset(); onClose();
    } catch { setError('Erreur lors de la création'); }
    finally { setLoading(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={handleClose}><Text style={styles.modalCancel}>Annuler</Text></TouchableOpacity>
            <Text style={styles.modalTitle}>Nouveau moment</Text>
            <TouchableOpacity onPress={handleCreate} disabled={loading}>
              <Text style={[styles.modalSave, loading && { opacity: 0.4 }]}>{loading ? '...' : 'Créer'}</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{ padding: 20 }} keyboardShouldPersistTaps="handled">
            <Text style={styles.fieldLabel}>Titre *</Text>
            <TextInput style={styles.fieldInput} value={title} onChangeText={setTitle} placeholder="Weekend à Paris, Appel vidéo…" placeholderTextColor={C.textMuted} maxLength={100} />

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Date *</Text>
                <TextInput style={styles.fieldInput} value={date} onChangeText={setDate} placeholder="JJ/MM/AAAA" placeholderTextColor={C.textMuted} keyboardType="numeric" maxLength={10} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Heure *</Text>
                <TextInput style={styles.fieldInput} value={time} onChangeText={setTime} placeholder="HH:MM" placeholderTextColor={C.textMuted} keyboardType="numeric" maxLength={5} />
              </View>
            </View>

            <View style={{ marginTop: 16 }}>
              <Text style={styles.fieldLabel}>Lieu</Text>
              <TextInput style={styles.fieldInput} value={location} onChangeText={setLocation} placeholder="Paris, En ligne…" placeholderTextColor={C.textMuted} maxLength={100} />
            </View>

            <View style={{ marginTop: 16 }}>
              <Text style={styles.fieldLabel}>Description</Text>
              <TextInput style={[styles.fieldInput, { height: 88, textAlignVertical: 'top', paddingTop: 12 }]} value={description} onChangeText={setDescription} placeholder="Des détails sur ce moment…" placeholderTextColor={C.textMuted} multiline maxLength={500} />
            </View>

            {error ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={15} color={C.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ═══════════════════════════════════════════════
// Écran principal
// ═══════════════════════════════════════════════
export default function MomentsScreen() {
  const insets = useSafeAreaInsets();
  const { user, couple, socket } = useAuthStore();
  const [moments, setMoments] = useState<Moment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const sortedMoments = [...moments].sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  const upcoming = sortedMoments.filter((m) => !isPast(new Date(m.scheduledAt)));
  const passed = sortedMoments.filter((m) => isPast(new Date(m.scheduledAt))).reverse();

  const load = useCallback(async () => {
    try { const { data } = await momentAPI.getMoments(); setMoments(data.moments); }
    catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { if (couple) load(); else setLoading(false); }, [couple?.id]);

  useEffect(() => {
    if (!socket) return;
    const onCreated = (m: Moment) => setMoments((p) => [...p, m]);
    const onDeleted = ({ id }: { id: string }) => setMoments((p) => p.filter((m) => m.id !== id));
    socket.on('moment:created', onCreated);
    socket.on('moment:deleted', onDeleted);
    return () => { socket.off('moment:created', onCreated); socket.off('moment:deleted', onDeleted); };
  }, [socket]);

  const handleCreate = async (data: any) => {
    const { data: res } = await momentAPI.createMoment(data);
    setMoments((p) => [...p, res.moment]);
  };

  const handleDelete = async (id: string) => {
    setMoments((p) => p.filter((m) => m.id !== id));
    try { await momentAPI.deleteMoment(id); } catch { await load(); }
  };

  if (!couple) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 }]}>
        <Ionicons name="calendar-outline" size={48} color={C.primary} />
        <Text style={styles.cardTitle}>Connectez-vous d'abord à votre partenaire</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Moments</Text>
          <Text style={{ fontSize: 13, color: C.textMuted, marginTop: 1 }}>{upcoming.length} à venir</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowCreate(true)}>
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
        showsVerticalScrollIndicator={false}
      >
        {upcoming.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>À venir</Text>
            {upcoming.map((m) => <MomentCard key={m.id} moment={m} onDelete={handleDelete} isOwner={m.createdBy.id === user?.id} />)}
          </>
        )}
        {passed.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { marginTop: 24 }]}>Passés</Text>
            {passed.slice(0, 5).map((m) => <MomentCard key={m.id} moment={m} onDelete={handleDelete} isOwner={m.createdBy.id === user?.id} />)}
          </>
        )}
        {moments.length === 0 && !loading && (
          <View style={{ alignItems: 'center', paddingTop: 60, gap: 10 }}>
            <Text style={{ fontSize: 44 }}>📅</Text>
            <Text style={styles.cardTitle}>Planifiez votre premier moment</Text>
            <Text style={{ fontSize: 14, color: C.textMuted, textAlign: 'center', paddingHorizontal: 24 }}>Appel vidéo, retrouvailles, date... tout compte.</Text>
            <TouchableOpacity style={styles.addBtn} onPress={() => setShowCreate(true)}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14, paddingHorizontal: 8 }}>Créer un moment</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <CreateModal visible={showCreate} onClose={() => setShowCreate(false)} onCreate={handleCreate} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: C.text },
  addBtn: { backgroundColor: C.primary, borderRadius: 20, minWidth: 40, height: 40, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  sectionLabel: { fontSize: 12, fontWeight: '600', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 },
  card: { backgroundColor: C.card, borderRadius: 16, marginBottom: 10, flexDirection: 'row', overflow: 'hidden', borderWidth: 1, borderColor: C.border },
  cardPassed: { opacity: 0.65 },
  accent: { width: 4 },
  cardContent: { flex: 1, padding: 14 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: C.text },
  cardDesc: { fontSize: 13, color: C.textMuted, marginTop: 2, lineHeight: 18 },
  metaGroup: { gap: 4, marginBottom: 10 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: 12, color: C.textMuted, textTransform: 'capitalize' },
  countdownRow: { flexDirection: 'row', gap: 6 },
  chip: { backgroundColor: C.primaryLight, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, alignItems: 'center', minWidth: 48 },
  chipNum: { fontSize: 18, fontWeight: '700', color: C.primary },
  chipLabel: { fontSize: 10, color: C.primary, fontWeight: '600' },
  badge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, alignSelf: 'flex-start' },
  badgeText: { fontSize: 13, fontWeight: '600' },
  modal: { flex: 1, backgroundColor: C.bg },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.card },
  modalTitle: { fontSize: 16, fontWeight: '700', color: C.text },
  modalCancel: { fontSize: 15, color: C.textMuted },
  modalSave: { fontSize: 15, fontWeight: '700', color: C.primary },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  fieldInput: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: C.text },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.dangerLight, borderRadius: 10, padding: 12, marginTop: 16 },
  errorText: { fontSize: 13, color: C.danger, flex: 1 },
});
