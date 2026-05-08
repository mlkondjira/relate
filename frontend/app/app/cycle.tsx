import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Modal, TextInput,
  Switch, StyleSheet, RefreshControl, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  getDay, isSameDay, isToday, subMonths, addMonths,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAuthStore } from '../../stores';
import { cycleAPI } from '../../services/api.service';

const C = {
  bg: '#FAF8F5', card: '#FFFFFF', primary: '#C4785A', primaryLight: '#F5EBE5',
  text: '#2C2117', textMuted: '#8A7A72', border: '#EDE8E3',
  danger: '#E57373', dangerLight: '#FDECEA',
};

type Phase = 'MENSTRUAL' | 'FOLLICULAR' | 'OVULATION' | 'LUTEAL';

const PHASES: Record<Phase, { bg: string; dot: string; label: string; icon: string; text: string; tip: string }> = {
  MENSTRUAL:  { bg: '#FDECEA', dot: '#E57373', label: 'Menstruation', icon: '🌙', text: '#C62828', tip: 'Période de menstruation — soyez attentionné(e).' },
  FOLLICULAR: { bg: '#E8F5EE', dot: '#4CAF7D', label: 'Folliculaire',  icon: '🌱', text: '#2E7D32', tip: 'Énergie en hausse, bonne période pour des projets communs.' },
  OVULATION:  { bg: '#FFF8E1', dot: '#FFB300', label: 'Ovulation',     icon: '✨', text: '#F57F17', tip: 'Pic de vitalité et de sociabilité.' },
  LUTEAL:     { bg: '#F3E5F5', dot: '#AB47BC', label: 'Lutéale',       icon: '🌕', text: '#6A1B9A', tip: 'Phase pré-menstruelle — empathie et soutien recommandés.' },
};

const SYMPTOMS = ['Crampes', 'Fatigue', 'Humeur changeante', 'Ballonnements', 'Maux de tête', 'Sensibilité', 'Énergie haute', 'Libido accrue'];

interface CycleEntry { id: string; date: string; phase: Phase; cycleDay: number; shareWithPartner: boolean; notes?: string; symptoms?: string[] }
interface PartnerEntry { id: string; date: string; phase: Phase; cycleDay: number }

// ─── Calendrier mensuel ───────────────────────────────────────
const CycleCalendar = ({ month, entries, partnerEntries, onDayPress }: {
  month: Date; entries: CycleEntry[]; partnerEntries: PartnerEntry[]; onDayPress: (d: Date) => void;
}) => {
  const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });
  const offset = (getDay(startOfMonth(month)) + 6) % 7;
  const getE = (d: Date) => entries.find((e) => isSameDay(new Date(e.date), d));
  const getP = (d: Date) => partnerEntries.find((e) => isSameDay(new Date(e.date), d));

  return (
    <View>
      <View style={styles.calWeekRow}>
        {['L','M','M','J','V','S','D'].map((d, i) => <Text key={i} style={styles.calDayLabel}>{d}</Text>)}
      </View>
      <View style={styles.calGrid}>
        {Array.from({ length: offset }).map((_, i) => <View key={`e${i}`} style={styles.calCell} />)}
        {days.map((day) => {
          const e = getE(day); const p = getP(day); const today = isToday(day);
          return (
            <TouchableOpacity key={day.toISOString()} style={[styles.calCell, e && { backgroundColor: PHASES[e.phase].bg }, today && styles.calToday]} onPress={() => onDayPress(day)} activeOpacity={0.7}>
              <Text style={[styles.calNum, today && { color: C.primary, fontWeight: '700' }]}>{format(day, 'd')}</Text>
              <View style={{ flexDirection: 'row', gap: 2, marginTop: 1 }}>
                {e && <View style={[styles.calDot, { backgroundColor: PHASES[e.phase].dot }]} />}
                {p && <View style={[styles.calDot, { backgroundColor: PHASES[p.phase].dot, borderWidth: 1, borderColor: '#fff' }]} />}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

// ─── Modal ajout ──────────────────────────────────────────────
const AddModal = ({ visible, onClose, onSave, date }: { visible: boolean; onClose: () => void; onSave: (d: any) => Promise<void>; date: Date }) => {
  const [phase, setPhase] = useState<Phase>('MENSTRUAL');
  const [cycleDay, setCycleDay] = useState('1');
  const [notes, setNotes] = useState('');
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [share, setShare] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const toggle = (s: string) => setSymptoms((p) => p.includes(s) ? p.filter((x) => x !== s) : [...p, s]);

  const handleSave = async () => {
    setError('');
    const d = parseInt(cycleDay);
    if (isNaN(d) || d < 1 || d > 35) return setError('Jour de cycle invalide (1–35)');
    setLoading(true);
    try {
      await onSave({ date: date.toISOString(), phase, cycleDay: d, notes: notes.trim() || undefined, symptoms: symptoms.length > 0 ? symptoms : undefined, shareWithPartner: share });
      setNotes(''); setSymptoms([]); setShare(false); setCycleDay('1');
      onClose();
    } catch { setError("Erreur lors de l'enregistrement"); }
    finally { setLoading(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={onClose}><Text style={styles.cancel}>Annuler</Text></TouchableOpacity>
            <Text style={styles.modalTitle}>{format(date, 'd MMMM', { locale: fr })}</Text>
            <TouchableOpacity onPress={handleSave} disabled={loading}><Text style={[styles.save, loading && { opacity: 0.4 }]}>{loading ? '…' : 'Enregistrer'}</Text></TouchableOpacity>
          </View>

          <ScrollView style={{ padding: 20 }} keyboardShouldPersistTaps="handled">
            {/* Phase */}
            <Text style={styles.label}>Phase du cycle</Text>
            <View style={styles.phaseGrid}>
              {(Object.keys(PHASES) as Phase[]).map((p) => (
                <TouchableOpacity key={p} style={[styles.phaseOption, phase === p && { backgroundColor: PHASES[p].bg, borderColor: PHASES[p].dot }]} onPress={() => setPhase(p)}>
                  <Text style={{ fontSize: 22 }}>{PHASES[p].icon}</Text>
                  <Text style={[styles.phaseOptionLabel, phase === p && { color: PHASES[p].text, fontWeight: '600' }]}>{PHASES[p].label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Jour */}
            <Text style={[styles.label, { marginTop: 20 }]}>Jour du cycle</Text>
            <TextInput style={[styles.input, { width: 90 }]} value={cycleDay} onChangeText={setCycleDay} keyboardType="numeric" maxLength={2} placeholder="1" placeholderTextColor={C.textMuted} />

            {/* Symptômes */}
            <Text style={[styles.label, { marginTop: 20 }]}>Symptômes</Text>
            <View style={styles.chipGrid}>
              {SYMPTOMS.map((s) => (
                <TouchableOpacity key={s} style={[styles.chipOption, symptoms.includes(s) && { backgroundColor: C.primaryLight, borderColor: C.primary }]} onPress={() => toggle(s)}>
                  <Text style={[styles.chipOptionText, symptoms.includes(s) && { color: C.primary }]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Notes */}
            <Text style={[styles.label, { marginTop: 20 }]}>Notes privées</Text>
            <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top', paddingTop: 12 }]} value={notes} onChangeText={setNotes} placeholder="Comment vous sentez-vous aujourd'hui ?" placeholderTextColor={C.textMuted} multiline maxLength={500} />

            {/* Partage */}
            <View style={[styles.shareRow, { marginTop: 20 }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.shareTitle}>Partager la phase</Text>
                <Text style={styles.shareSub}>Seule la phase sera visible par votre partenaire — jamais les notes ni les symptômes.</Text>
              </View>
              <Switch value={share} onValueChange={setShare} trackColor={{ true: C.primary, false: C.border }} thumbColor="#fff" />
            </View>

            {share && (
              <View style={styles.privacyNote}>
                <Ionicons name="shield-checkmark-outline" size={14} color={C.primary} />
                <Text style={styles.privacyNoteText}>Seule «{PHASES[phase].label}» sera partagée. Tout le reste reste privé.</Text>
              </View>
            )}

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
export default function CycleScreen() {
  const insets = useSafeAreaInsets();
  const { partner, couple } = useAuthStore();
  const [entries, setEntries] = useState<CycleEntry[]>([]);
  const [partnerEntries, setPartnerEntries] = useState<PartnerEntry[]>([]);
  const [month, setMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showAdd, setShowAdd] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const todayEntry = entries.find((e) => isSameDay(new Date(e.date), new Date()));
  const todayPartnerEntry = partnerEntries.find((e) => isSameDay(new Date(e.date), new Date()));

  const load = useCallback(async () => {
    try {
      const [myRes, pRes] = await Promise.all([
        cycleAPI.getMyEntries(),
        couple ? cycleAPI.getPartnerEntries() : Promise.resolve({ data: { entries: [] } }),
      ]);
      setEntries(myRes.data.entries);
      setPartnerEntries(pRes.data.entries);
    } catch {}
  }, [couple?.id]);

  useEffect(() => { load(); }, [couple?.id]);

  const handleSave = async (data: any) => { await cycleAPI.addEntry(data); await load(); };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Cycle</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => { setSelectedDate(new Date()); setShowAdd(true); }}>
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Phase aujourd'hui */}
        <Text style={styles.sectionLabel}>Aujourd'hui</Text>
        {todayEntry ? (
          <View style={[styles.card, { backgroundColor: PHASES[todayEntry.phase].bg, borderColor: PHASES[todayEntry.phase].dot + '40' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <Text style={{ fontSize: 30 }}>{PHASES[todayEntry.phase].icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.phaseTitle, { color: PHASES[todayEntry.phase].text }]}>{PHASES[todayEntry.phase].label}</Text>
                <Text style={[styles.phaseSub, { color: PHASES[todayEntry.phase].text + 'AA' }]}>Jour {todayEntry.cycleDay} du cycle</Text>
              </View>
              <View style={[styles.shareBadge, { backgroundColor: todayEntry.shareWithPartner ? PHASES[todayEntry.phase].dot + '25' : C.border }]}>
                <Ionicons name={todayEntry.shareWithPartner ? 'eye-outline' : 'eye-off-outline'} size={13} color={todayEntry.shareWithPartner ? PHASES[todayEntry.phase].dot : C.textMuted} />
                <Text style={[styles.shareLabel, { color: todayEntry.shareWithPartner ? PHASES[todayEntry.phase].dot : C.textMuted }]}>
                  {todayEntry.shareWithPartner ? 'Partagé' : 'Privé'}
                </Text>
              </View>
            </View>
            {todayEntry.symptoms && todayEntry.symptoms.length > 0 && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {todayEntry.symptoms.map((s) => (
                  <View key={s} style={[styles.symChip, { borderColor: PHASES[todayEntry.phase].dot + '60' }]}>
                    <Text style={[styles.symChipText, { color: PHASES[todayEntry.phase].text }]}>{s}</Text>
                  </View>
                ))}
              </View>
            )}
            {todayEntry.notes ? <Text style={[{ fontSize: 13, lineHeight: 18, fontStyle: 'italic', marginTop: 8 }, { color: PHASES[todayEntry.phase].text + 'CC' }]}>{todayEntry.notes}</Text> : null}
          </View>
        ) : (
          <TouchableOpacity style={[styles.card, { alignItems: 'center', gap: 6, paddingVertical: 22 }]} onPress={() => { setSelectedDate(new Date()); setShowAdd(true); }}>
            <Ionicons name="add-circle-outline" size={30} color={C.primary} />
            <Text style={{ fontSize: 15, fontWeight: '600', color: C.primary }}>Enregistrer d'aujourd'hui</Text>
            <Text style={{ fontSize: 13, color: C.textMuted }}>Suivez votre cycle jour par jour</Text>
          </TouchableOpacity>
        )}

        {/* Phase partenaire */}
        {partner && todayPartnerEntry && (
          <View style={[styles.card, { backgroundColor: PHASES[todayPartnerEntry.phase].bg + 'CC', borderColor: PHASES[todayPartnerEntry.phase].dot + '30', marginTop: 4 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <Ionicons name="heart-outline" size={15} color={PHASES[todayPartnerEntry.phase].dot} />
              <Text style={[styles.phaseTitle, { color: PHASES[todayPartnerEntry.phase].text, fontSize: 14 }]}>
                {partner.name} — {PHASES[todayPartnerEntry.phase].icon} {PHASES[todayPartnerEntry.phase].label} (J.{todayPartnerEntry.cycleDay})
              </Text>
            </View>
            <Text style={{ fontSize: 13, color: PHASES[todayPartnerEntry.phase].text + 'AA', lineHeight: 18 }}>{PHASES[todayPartnerEntry.phase].tip}</Text>
          </View>
        )}

        {/* Navigation calendrier */}
        <View style={styles.calNav}>
          <TouchableOpacity onPress={() => setMonth((m) => subMonths(m, 1))} hitSlop={8}>
            <Ionicons name="chevron-back" size={22} color={C.primary} />
          </TouchableOpacity>
          <Text style={styles.calNavTitle}>{format(month, 'MMMM yyyy', { locale: fr })}</Text>
          <TouchableOpacity onPress={() => setMonth((m) => addMonths(m, 1))} hitSlop={8}>
            <Ionicons name="chevron-forward" size={22} color={C.primary} />
          </TouchableOpacity>
        </View>

        {/* Légende */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
          {(Object.keys(PHASES) as Phase[]).map((p) => (
            <View key={p} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <View style={[styles.calDot, { backgroundColor: PHASES[p].dot, width: 8, height: 8 }]} />
              <Text style={{ fontSize: 12, color: C.textMuted }}>{PHASES[p].icon} {PHASES[p].label}</Text>
            </View>
          ))}
        </View>

        {/* Calendrier */}
        <View style={styles.card}>
          <CycleCalendar month={month} entries={entries} partnerEntries={partnerEntries} onDayPress={(d) => { setSelectedDate(d); setShowAdd(true); }} />
        </View>

        {/* Bandeau privacy */}
        <View style={[styles.card, { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginTop: 4 }]}>
          <Ionicons name="lock-closed-outline" size={14} color={C.textMuted} style={{ marginTop: 1 }} />
          <Text style={{ fontSize: 12, color: C.textMuted, flex: 1, lineHeight: 17 }}>
            Vos données de cycle sont chiffrées (AES-256). Seules les phases que vous partagez explicitement sont visibles par votre partenaire — jamais les notes ni les symptômes.
          </Text>
        </View>
      </ScrollView>

      <AddModal visible={showAdd} onClose={() => setShowAdd(false)} onSave={handleSave} date={selectedDate} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: C.text },
  addBtn: { backgroundColor: C.primary, borderRadius: 20, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  sectionLabel: { fontSize: 12, fontWeight: '600', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 },
  card: { backgroundColor: C.card, borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: C.border },
  phaseTitle: { fontSize: 16, fontWeight: '700' },
  phaseSub: { fontSize: 13, marginTop: 1 },
  shareBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  shareLabel: { fontSize: 11, fontWeight: '600' },
  symChip: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  symChipText: { fontSize: 12, fontWeight: '500' },
  calNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  calNavTitle: { fontSize: 15, fontWeight: '700', color: C.text, textTransform: 'capitalize' },
  calWeekRow: { flexDirection: 'row', marginBottom: 4 },
  calDayLabel: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '600', color: C.textMuted },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calCell: { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 8, padding: 2 },
  calToday: { borderWidth: 1.5, borderColor: C.primary },
  calNum: { fontSize: 13, color: C.text },
  calDot: { width: 5, height: 5, borderRadius: 3 },
  modal: { flex: 1, backgroundColor: C.bg },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.card },
  modalTitle: { fontSize: 16, fontWeight: '700', color: C.text },
  cancel: { fontSize: 15, color: C.textMuted },
  save: { fontSize: 15, fontWeight: '700', color: C.primary },
  label: { fontSize: 12, fontWeight: '600', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  input: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: C.text },
  phaseGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  phaseOption: { flexBasis: '47%', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: C.border, backgroundColor: C.card, alignItems: 'center', gap: 4 },
  phaseOptionLabel: { fontSize: 13, color: C.textMuted, textAlign: 'center' },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chipOption: { borderWidth: 1, borderColor: C.border, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: C.card },
  chipOptionText: { fontSize: 13, color: C.textMuted },
  shareRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.border },
  shareTitle: { fontSize: 14, fontWeight: '600', color: C.text },
  shareSub: { fontSize: 12, color: C.textMuted, marginTop: 2, lineHeight: 17 },
  privacyNote: { flexDirection: 'row', gap: 8, backgroundColor: C.primaryLight, borderRadius: 10, padding: 10, marginTop: 10, alignItems: 'flex-start' },
  privacyNoteText: { fontSize: 12, color: C.primary, flex: 1, lineHeight: 17 },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.dangerLight, borderRadius: 10, padding: 12, marginTop: 16 },
  errorText: { fontSize: 13, color: C.danger, flex: 1 },
});
