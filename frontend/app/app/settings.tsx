import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Modal, TextInput,
  StyleSheet, Alert, Switch, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAuthStore } from '../../stores';
import { profileAPI, coupleAPI } from '../../services/api.service';

const C = {
  bg: '#FAF8F5', card: '#FFFFFF', primary: '#C4785A', primaryLight: '#F5EBE5',
  text: '#2C2117', textMuted: '#8A7A72', border: '#EDE8E3',
  danger: '#E57373', dangerLight: '#FDECEA', success: '#4CAF7D', successLight: '#E8F5EE',
};

// ─── Composant ligne de paramètre ─────────────────────────────
const SettingRow = ({
  icon, label, sublabel, onPress, rightElement, destructive = false, disabled = false,
}: {
  icon: string; label: string; sublabel?: string;
  onPress?: () => void; rightElement?: React.ReactNode;
  destructive?: boolean; disabled?: boolean;
}) => (
  <TouchableOpacity
    style={styles.settingRow}
    onPress={onPress}
    disabled={disabled || !onPress}
    activeOpacity={onPress ? 0.6 : 1}
  >
    <View style={[styles.settingIcon, destructive && { backgroundColor: C.dangerLight }]}>
      <Ionicons name={icon as any} size={18} color={destructive ? C.danger : C.primary} />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={[styles.settingLabel, destructive && { color: C.danger }]}>{label}</Text>
      {sublabel ? <Text style={styles.settingSubLabel}>{sublabel}</Text> : null}
    </View>
    {rightElement ?? (onPress ? <Ionicons name="chevron-forward" size={16} color={C.textMuted} /> : null)}
  </TouchableOpacity>
);

// ─── Section groupée ──────────────────────────────────────────
const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    <View style={styles.sectionCard}>{children}</View>
  </View>
);

// ─── Modal modification du prénom ────────────────────────────
const EditNameModal = ({
  visible, currentName, onClose, onSave,
}: {
  visible: boolean; currentName: string; onClose: () => void; onSave: (name: string) => Promise<void>;
}) => {
  const [name, setName] = useState(currentName);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setError('');
    if (!name.trim() || name.trim().length < 2) return setError('Prénom trop court');
    setLoading(true);
    try { await onSave(name.trim()); onClose(); }
    catch { setError('Erreur lors de la mise à jour'); }
    finally { setLoading(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={onClose}><Text style={styles.modalCancel}>Annuler</Text></TouchableOpacity>
            <Text style={styles.modalTitle}>Modifier le prénom</Text>
            <TouchableOpacity onPress={handleSave} disabled={loading}>
              <Text style={[styles.modalSave, loading && { opacity: 0.4 }]}>{loading ? '…' : 'Sauvegarder'}</Text>
            </TouchableOpacity>
          </View>
          <View style={{ padding: 24 }}>
            <Text style={styles.fieldLabel}>Prénom</Text>
            <TextInput
              style={styles.fieldInput}
              value={name}
              onChangeText={setName}
              autoFocus
              maxLength={50}
              autoCapitalize="words"
              placeholderTextColor={C.textMuted}
            />
            {error ? <Text style={{ color: C.danger, fontSize: 13, marginTop: 8 }}>{error}</Text> : null}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ─── Modal changement de mot de passe ────────────────────────
const ChangePasswordModal = ({
  visible, onClose,
}: {
  visible: boolean; onClose: () => void;
}) => {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const reset = () => { setCurrent(''); setNext(''); setConfirm(''); setError(''); setSuccess(false); };

  const handleSave = async () => {
    setError('');
    if (!current) return setError('Mot de passe actuel requis');
    if (next.length < 8) return setError('Nouveau mot de passe trop court (8 car. min)');
    if (next !== confirm) return setError('Les mots de passe ne correspondent pas');
    setLoading(true);
    try {
      await profileAPI.changePassword({ currentPassword: current, newPassword: next });
      setSuccess(true);
      setTimeout(() => { reset(); onClose(); }, 1500);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur lors du changement');
    } finally { setLoading(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { reset(); onClose(); }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => { reset(); onClose(); }}><Text style={styles.modalCancel}>Annuler</Text></TouchableOpacity>
            <Text style={styles.modalTitle}>Mot de passe</Text>
            <TouchableOpacity onPress={handleSave} disabled={loading || success}>
              <Text style={[styles.modalSave, (loading || success) && { opacity: 0.4 }]}>
                {loading ? '…' : success ? '✓' : 'Changer'}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={{ padding: 24, gap: 16 }}>
            {success ? (
              <View style={[styles.successBox]}>
                <Ionicons name="checkmark-circle-outline" size={20} color={C.success} />
                <Text style={{ color: C.success, fontWeight: '600', fontSize: 14 }}>Mot de passe modifié !</Text>
              </View>
            ) : (
              <>
                <View>
                  <Text style={styles.fieldLabel}>Mot de passe actuel</Text>
                  <TextInput style={styles.fieldInput} value={current} onChangeText={setCurrent} secureTextEntry placeholder="••••••••" placeholderTextColor={C.textMuted} />
                </View>
                <View>
                  <Text style={styles.fieldLabel}>Nouveau mot de passe</Text>
                  <TextInput style={styles.fieldInput} value={next} onChangeText={setNext} secureTextEntry placeholder="8 caractères minimum" placeholderTextColor={C.textMuted} />
                </View>
                <View>
                  <Text style={styles.fieldLabel}>Confirmer</Text>
                  <TextInput style={styles.fieldInput} value={confirm} onChangeText={setConfirm} secureTextEntry placeholder="Répétez le nouveau mot de passe" placeholderTextColor={C.textMuted} />
                </View>
                {error ? (
                  <View style={styles.errorBox}>
                    <Ionicons name="alert-circle-outline" size={15} color={C.danger} />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                ) : null}
              </>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ═══════════════════════════════════════════════
// Écran principal Profil / Paramètres
// ═══════════════════════════════════════════════
export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, partner, couple, logout, setCouple, setPartner } = useAuthStore();
  const [showEditName, setShowEditName] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [notifMessages, setNotifMessages] = useState(true);
  const [notifCheckin, setNotifCheckin] = useState(true);
  const [notifMoments, setNotifMoments] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleSaveName = useCallback(async (name: string) => {
    await profileAPI.update({ name });
    // Mettre à jour le store
    const store = useAuthStore.getState();
    if (store.user) {
      useAuthStore.setState({ user: { ...store.user, name } });
    }
  }, []);

  const handleLogout = () => {
    Alert.alert('Se déconnecter', 'Voulez-vous vous déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Déconnexion', style: 'destructive',
        onPress: async () => {
          setLoggingOut(true);
          await logout();
        },
      },
    ]);
  };

  const handleLeaveCouple = () => {
    Alert.alert(
      'Quitter le couple',
      'Tous vos messages et moments seront définitivement supprimés. Cette action est irréversible.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Quitter', style: 'destructive',
          onPress: async () => {
            try {
              await coupleAPI.leaveCouple();
              setCouple(null);
              setPartner(null);
            } catch {
              Alert.alert('Erreur', 'Impossible de quitter le couple');
            }
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Supprimer mon compte',
      'Toutes vos données seront définitivement supprimées (messages, moments, cycle). Cette action est irréversible et ne peut pas être annulée.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer définitivement', style: 'destructive',
          onPress: async () => {
            try {
              await profileAPI.deleteAccount();
              await logout();
            } catch {
              Alert.alert('Erreur', 'Impossible de supprimer le compte');
            }
          },
        },
      ]
    );
  };

  if (!user) return null;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profil</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Avatar + identité ──────────────────────────────── */}
        <View style={styles.profileHero}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user.name[0].toUpperCase()}</Text>
          </View>
          <Text style={styles.profileName}>{user.name}</Text>
          <Text style={styles.profileEmail}>{user.email}</Text>
          {couple && partner && (
            <View style={styles.coupledBadge}>
              <Ionicons name="heart" size={12} color={C.primary} />
              <Text style={styles.coupledText}>Avec {partner.name}</Text>
            </View>
          )}
        </View>

        {/* ── Compte ────────────────────────────────────────── */}
        <Section title="Compte">
          <SettingRow
            icon="person-outline"
            label="Modifier le prénom"
            sublabel={user.name}
            onPress={() => setShowEditName(true)}
          />
          <View style={styles.rowDivider} />
          <SettingRow
            icon="lock-closed-outline"
            label="Changer le mot de passe"
            onPress={() => setShowChangePassword(true)}
          />
          <View style={styles.rowDivider} />
          <SettingRow
            icon="mail-outline"
            label="Adresse email"
            sublabel={user.email}
            disabled
            rightElement={<Text style={{ fontSize: 12, color: C.textMuted }}>Non modifiable</Text>}
          />
        </Section>

        {/* ── Partenaire ────────────────────────────────────── */}
        {couple && partner && (
          <Section title="Mon partenaire">
            <View style={styles.partnerRow}>
              <View style={styles.partnerAvatar}>
                <Text style={styles.partnerAvatarText}>{partner.name[0].toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingLabel}>{partner.name}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                  <View style={[styles.onlineDot, { backgroundColor: partner.isOnline ? C.success : C.textMuted }]} />
                  <Text style={styles.settingSubLabel}>
                    {partner.isOnline ? 'En ligne' : `Vu ${format(new Date(partner.lastSeen), "d MMM 'à' HH:mm", { locale: fr })}`}
                  </Text>
                </View>
              </View>
            </View>
            <View style={styles.rowDivider} />
            <SettingRow
              icon="heart-dislike-outline"
              label="Quitter le couple"
              sublabel="Supprime tous les messages et moments partagés"
              onPress={handleLeaveCouple}
              destructive
            />
          </Section>
        )}

        {/* ── Notifications ─────────────────────────────────── */}
        <Section title="Notifications">
          <SettingRow
            icon="chatbubble-outline"
            label="Nouveaux messages"
            rightElement={
              <Switch value={notifMessages} onValueChange={setNotifMessages}
                trackColor={{ true: C.primary, false: C.border }} thumbColor="#fff" />
            }
          />
          <View style={styles.rowDivider} />
          <SettingRow
            icon="location-outline"
            label="Check-in du partenaire"
            rightElement={
              <Switch value={notifCheckin} onValueChange={setNotifCheckin}
                trackColor={{ true: C.primary, false: C.border }} thumbColor="#fff" />
            }
          />
          <View style={styles.rowDivider} />
          <SettingRow
            icon="calendar-outline"
            label="Rappels de moments"
            rightElement={
              <Switch value={notifMoments} onValueChange={setNotifMoments}
                trackColor={{ true: C.primary, false: C.border }} thumbColor="#fff" />
            }
          />
        </Section>

        {/* ── Confidentialité ───────────────────────────────── */}
        <Section title="Confidentialité">
          <View style={styles.privacyCard}>
            <View style={styles.privacyRow}>
              <Ionicons name="shield-checkmark-outline" size={16} color={C.primary} />
              <Text style={styles.privacyTitle}>Protection de vos données</Text>
            </View>
            <Text style={styles.privacyText}>
              • Données de cycle chiffrées AES-256 avant stockage{'\n'}
              • Tokens stockés dans le Keychain sécurisé{'\n'}
              • Aucune donnée vendue à des tiers{'\n'}
              • Données supprimées à la fermeture du compte{'\n'}
              • Droit à l'effacement garanti (RGPD Art. 17)
            </Text>
          </View>
        </Section>

        {/* ── Déconnexion & Suppression ─────────────────────── */}
        <Section title="Session">
          <SettingRow
            icon="log-out-outline"
            label="Se déconnecter"
            onPress={handleLogout}
            rightElement={
              loggingOut ? <ActivityIndicator size="small" color={C.danger} /> : undefined
            }
            destructive
          />
        </Section>

        <Section title="Zone de danger">
          <SettingRow
            icon="trash-outline"
            label="Supprimer mon compte"
            sublabel="Suppression définitive de toutes vos données"
            onPress={handleDeleteAccount}
            destructive
          />
        </Section>

        {/* Version */}
        <Text style={styles.version}>Relate v1.0.0</Text>

      </ScrollView>

      <EditNameModal
        visible={showEditName}
        currentName={user.name}
        onClose={() => setShowEditName(false)}
        onSave={handleSaveName}
      />
      <ChangePasswordModal
        visible={showChangePassword}
        onClose={() => setShowChangePassword(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { paddingHorizontal: 20, paddingVertical: 14 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: C.text },
  scroll: { paddingHorizontal: 16, paddingBottom: 48 },

  // Hero profil
  profileHero: { alignItems: 'center', paddingVertical: 24, gap: 6 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: C.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  avatarText: { fontSize: 32, fontWeight: '800', color: C.primary },
  profileName: { fontSize: 22, fontWeight: '700', color: C.text },
  profileEmail: { fontSize: 14, color: C.textMuted },
  coupledBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.primaryLight, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, marginTop: 4 },
  coupledText: { fontSize: 13, color: C.primary, fontWeight: '600' },

  // Sections
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 12, fontWeight: '600', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8, marginLeft: 4 },
  sectionCard: { backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },

  // Ligne de paramètre
  settingRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 13, gap: 12 },
  settingIcon: { width: 34, height: 34, borderRadius: 9, backgroundColor: C.primaryLight, alignItems: 'center', justifyContent: 'center' },
  settingLabel: { fontSize: 15, color: C.text, fontWeight: '500' },
  settingSubLabel: { fontSize: 12, color: C.textMuted, marginTop: 1 },
  rowDivider: { height: 1, backgroundColor: C.border, marginLeft: 60 },

  // Partenaire
  partnerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 13, gap: 12 },
  partnerAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.primaryLight, alignItems: 'center', justifyContent: 'center' },
  partnerAvatarText: { fontSize: 16, fontWeight: '700', color: C.primary },
  onlineDot: { width: 7, height: 7, borderRadius: 4 },

  // Privacy
  privacyCard: { padding: 14, gap: 8 },
  privacyRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  privacyTitle: { fontSize: 14, fontWeight: '700', color: C.primary },
  privacyText: { fontSize: 13, color: C.textMuted, lineHeight: 22 },

  // Version
  version: { textAlign: 'center', fontSize: 12, color: C.textMuted, marginTop: 8, marginBottom: 16 },

  // Modals
  modal: { flex: 1, backgroundColor: C.bg },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.card },
  modalTitle: { fontSize: 16, fontWeight: '700', color: C.text },
  modalCancel: { fontSize: 15, color: C.textMuted },
  modalSave: { fontSize: 15, fontWeight: '700', color: C.primary },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  fieldInput: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: C.text },
  successBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.successLight, borderRadius: 10, padding: 14, justifyContent: 'center' },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.dangerLight, borderRadius: 10, padding: 12 },
  errorText: { fontSize: 13, color: C.danger, flex: 1 },
});
