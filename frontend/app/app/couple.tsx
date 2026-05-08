import { useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, Share, Alert
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../stores';
import { coupleAPI } from '../../services/api.service';
import { format, addHours } from 'date-fns';
import { fr } from 'date-fns/locale';

const C = {
  bg: '#FAF8F5',
  card: '#FFFFFF',
  primary: '#C4785A',
  primaryLight: '#F5EBE5',
  text: '#2C2117',
  textMuted: '#8A7A72',
  border: '#EDE8E3',
  danger: '#E57373',
  success: '#4CAF7D',
};

export default function CoupleScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { couple, setCouple, setPartner } = useAuthStore();

  const [mode, setMode] = useState<'choice' | 'invite' | 'join'>('choice');
  const [inviteCode, setInviteCode] = useState('');
  const [inviteExpiry, setInviteExpiry] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Si déjà en couple, afficher les infos
  if (couple) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Votre couple</Text>
        </View>
        <View style={styles.center}>
          <Ionicons name="heart" size={48} color={C.primary} />
          <Text style={styles.connectedTitle}>Vous êtes connectés !</Text>
          <Text style={styles.connectedSub}>Votre espace couple est actif</Text>
          <TouchableOpacity
            style={styles.dangerBtn}
            onPress={() => Alert.alert(
              'Quitter le couple',
              'Êtes-vous sûr ? Tous vos messages et moments seront supprimés.',
              [
                { text: 'Annuler', style: 'cancel' },
                {
                  text: 'Quitter', style: 'destructive',
                  onPress: async () => {
                    await coupleAPI.leaveCouple();
                    setCouple(null);
                    setPartner(null);
                  },
                },
              ]
            )}
          >
            <Text style={styles.dangerBtnText}>Quitter le couple</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ─── Générer un code d'invitation ──────────────────────────
  const handleCreateInvite = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await coupleAPI.createInvite();
      setInviteCode(data.code);
      setInviteExpiry(data.expiresAt);
      setMode('invite');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur lors de la création');
    } finally {
      setLoading(false);
    }
  };

  // ─── Partager le code via le système natif ─────────────────
  const handleShare = async () => {
    await Share.share({
      message: `Rejoins-moi sur Relate ! Mon code d'invitation : ${inviteCode}\n\nValable 24h.`,
      title: 'Invitation Relate',
    });
  };

  // ─── Rejoindre avec un code ────────────────────────────────
  const handleJoin = async () => {
    if (joinCode.trim().length < 6) return setError('Code invalide');
    setLoading(true);
    setError('');
    try {
      const { data } = await coupleAPI.joinCouple(joinCode.trim().toUpperCase());
      setCouple(data.couple);
      setPartner(data.partner);
      setSuccess(`Connecté avec ${data.partner.name} !`);
      setTimeout(() => router.replace('/app/home'), 1500);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Code invalide ou expiré');
    } finally {
      setLoading(false);
    }
  };

  // ─── Écran de succès ───────────────────────────────────────
  if (success) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <Ionicons name="heart" size={56} color={C.primary} />
        <Text style={styles.connectedTitle}>{success}</Text>
        <Text style={styles.connectedSub}>Redirection en cours…</Text>
        <ActivityIndicator color={C.primary} style={{ marginTop: 16 }} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        {mode !== 'choice' && (
          <TouchableOpacity onPress={() => { setMode('choice'); setError(''); setInviteCode(''); }}>
            <Ionicons name="arrow-back" size={22} color={C.text} />
          </TouchableOpacity>
        )}
        <Text style={styles.headerTitle}>
          {mode === 'choice' ? 'Se connecter' : mode === 'invite' ? 'Mon invitation' : 'Rejoindre'}
        </Text>
        <View style={{ width: 22 }} />
      </View>

      {/* ── Choix initial ──────────────────────────────────── */}
      {mode === 'choice' && (
        <View style={styles.choiceContainer}>
          <View style={styles.heroArea}>
            <Text style={styles.heroEmoji}>💑</Text>
            <Text style={styles.heroTitle}>Connectez-vous à votre partenaire</Text>
            <Text style={styles.heroSub}>
              L'un crée un code d'invitation, l'autre le saisit. Simple.
            </Text>
          </View>

          <TouchableOpacity style={styles.primaryCard} onPress={handleCreateInvite} disabled={loading}>
            <View style={styles.primaryCardIcon}>
              <Ionicons name="link-outline" size={22} color={C.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.primaryCardTitle}>Créer une invitation</Text>
              <Text style={styles.primaryCardSub}>Générez un code à partager avec votre partenaire</Text>
            </View>
            {loading
              ? <ActivityIndicator size="small" color={C.primary} />
              : <Ionicons name="chevron-forward" size={18} color={C.textMuted} />}
          </TouchableOpacity>

          <TouchableOpacity style={styles.primaryCard} onPress={() => setMode('join')}>
            <View style={styles.primaryCardIcon}>
              <Ionicons name="enter-outline" size={22} color={C.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.primaryCardTitle}>Rejoindre avec un code</Text>
              <Text style={styles.primaryCardSub}>Vous avez reçu un code ? Saisissez-le ici</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={C.textMuted} />
          </TouchableOpacity>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>
      )}

      {/* ── Affichage code invitation ──────────────────────── */}
      {mode === 'invite' && inviteCode && (
        <View style={styles.inviteContainer}>
          <Text style={styles.inviteLabel}>Votre code d'invitation</Text>

          {/* Code affiché en gros */}
          <View style={styles.codeBox}>
            <Text style={styles.codeText}>{inviteCode.split('').join(' ')}</Text>
          </View>

          {inviteExpiry && (
            <Text style={styles.expiryText}>
              Expire le {format(new Date(inviteExpiry), "d MMMM 'à' HH:mm", { locale: fr })}
            </Text>
          )}

          <Text style={styles.inviteInstructions}>
            Partagez ce code avec votre partenaire. Il devra le saisir dans l'application pour vous rejoindre.
          </Text>

          <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
            <Ionicons name="share-outline" size={18} color="#fff" />
            <Text style={styles.shareBtnText}>Partager le code</Text>
          </TouchableOpacity>

          {/* Bouton rafraîchir */}
          <TouchableOpacity style={styles.refreshBtn} onPress={handleCreateInvite} disabled={loading}>
            <Ionicons name="refresh-outline" size={16} color={C.primary} />
            <Text style={styles.refreshBtnText}>Générer un nouveau code</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Saisie code pour rejoindre ─────────────────────── */}
      {mode === 'join' && (
        <View style={styles.joinContainer}>
          <Text style={styles.inviteLabel}>Saisissez le code de votre partenaire</Text>

          <TextInput
            style={styles.codeInput}
            value={joinCode}
            onChangeText={(t) => setJoinCode(t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
            placeholder="A B C 1 2 3"
            placeholderTextColor={C.textMuted}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={6}
            autoFocus
          />

          <Text style={styles.joinHint}>6 caractères, lettres et chiffres</Text>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.shareBtn, { opacity: joinCode.length === 6 ? 1 : 0.4 }]}
            onPress={handleJoin}
            disabled={loading || joinCode.length !== 6}
          >
            {loading
              ? <ActivityIndicator color="#fff" size="small" />
              : <>
                  <Ionicons name="heart-outline" size={18} color="#fff" />
                  <Text style={styles.shareBtnText}>Rejoindre</Text>
                </>}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: C.text },

  // Choix
  choiceContainer: { flex: 1, padding: 24 },
  heroArea: { alignItems: 'center', marginBottom: 40, gap: 8 },
  heroEmoji: { fontSize: 52 },
  heroTitle: { fontSize: 20, fontWeight: '700', color: C.text, textAlign: 'center' },
  heroSub: { fontSize: 14, color: C.textMuted, textAlign: 'center', lineHeight: 20 },
  primaryCard: { backgroundColor: C.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.border, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  primaryCardIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: C.primaryLight, alignItems: 'center', justifyContent: 'center' },
  primaryCardTitle: { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 2 },
  primaryCardSub: { fontSize: 13, color: C.textMuted, lineHeight: 18 },

  // Code invitation
  inviteContainer: { flex: 1, padding: 24, alignItems: 'center' },
  inviteLabel: { fontSize: 13, fontWeight: '600', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 20 },
  codeBox: { backgroundColor: C.card, borderWidth: 2, borderColor: C.primary, borderRadius: 20, paddingHorizontal: 32, paddingVertical: 24, marginBottom: 12 },
  codeText: { fontSize: 36, fontWeight: '800', color: C.primary, letterSpacing: 12 },
  expiryText: { fontSize: 12, color: C.textMuted, marginBottom: 16, textTransform: 'capitalize' },
  inviteInstructions: { fontSize: 14, color: C.textMuted, textAlign: 'center', lineHeight: 20, marginBottom: 24, paddingHorizontal: 16 },
  shareBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.primary, paddingVertical: 14, paddingHorizontal: 28, borderRadius: 14, marginBottom: 12 },
  shareBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  refreshBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  refreshBtnText: { fontSize: 14, color: C.primary, fontWeight: '500' },

  // Rejoindre
  joinContainer: { flex: 1, padding: 24, alignItems: 'center' },
  codeInput: { fontSize: 32, fontWeight: '800', color: C.primary, letterSpacing: 10, textAlign: 'center', backgroundColor: C.card, borderWidth: 2, borderColor: C.border, borderRadius: 20, paddingHorizontal: 32, paddingVertical: 20, marginBottom: 8, width: '100%' },
  joinHint: { fontSize: 12, color: C.textMuted, marginBottom: 24 },

  // États
  connectedTitle: { fontSize: 22, fontWeight: '700', color: C.text, textAlign: 'center' },
  connectedSub: { fontSize: 15, color: C.textMuted, textAlign: 'center' },
  dangerBtn: { marginTop: 32, borderWidth: 1, borderColor: C.danger, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24 },
  dangerBtnText: { color: C.danger, fontWeight: '600', fontSize: 14 },
  errorText: { color: C.danger, fontSize: 13, textAlign: 'center', marginTop: 8 },
});
