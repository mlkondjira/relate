import {
  useEffect, useRef, useState, useCallback
} from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
  Pressable, Animated
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { format, isToday, isYesterday } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAuthStore, useChatStore } from '../../stores';
import { messageAPI } from '../../services/api.service';

// ─── Couleurs Relate ──────────────────────────────────────────
const C = {
  bg: '#FAF8F5',
  card: '#FFFFFF',
  primary: '#C4785A',
  primaryLight: '#F5EBE5',
  bubble: '#FFFFFF',
  bubbleMine: '#C4785A',
  text: '#2C2117',
  textMine: '#FFFFFF',
  textMuted: '#8A7A72',
  border: '#EDE8E3',
  inputBg: '#F3EDE8',
  read: '#C4785A',
  unread: '#B4A49C',
  separator: '#E8E2DC',
};

// ─── Types ────────────────────────────────────────────────────
interface Message {
  id: string;
  coupleId: string;
  senderId: string;
  content: string;
  createdAt: string;
  readAt?: string;
  sender: { id: string; name: string; avatar?: string };
}

// ─── Helper : formatage de la date du séparateur ─────────────
const formatSeparatorDate = (dateStr: string) => {
  const d = new Date(dateStr);
  if (isToday(d)) return "Aujourd'hui";
  if (isYesterday(d)) return 'Hier';
  return format(d, 'EEEE d MMMM', { locale: fr });
};

// ─── Helper : est-ce que deux messages ont le même jour ? ─────
const sameDay = (a: string, b: string) =>
  new Date(a).toDateString() === new Date(b).toDateString();

// ─── Composant avatar ─────────────────────────────────────────
const Avatar = ({ name, size = 32 }: { name: string; size?: number }) => (
  <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
    <Text style={[styles.avatarText, { fontSize: size * 0.42 }]}>
      {name[0].toUpperCase()}
    </Text>
  </View>
);

// ─── Composant bulle de message ───────────────────────────────
const MessageBubble = ({
  message,
  isMine,
  showAvatar,
  partnerName,
}: {
  message: Message;
  isMine: boolean;
  showAvatar: boolean;
  partnerName: string;
}) => {
  const time = format(new Date(message.createdAt), 'HH:mm');

  return (
    <View style={[styles.bubbleRow, isMine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
      {/* Avatar partenaire (affiché uniquement sur le dernier message d'une séquence) */}
      {!isMine && (
        <View style={{ width: 34, marginRight: 6, alignSelf: 'flex-end' }}>
          {showAvatar ? <Avatar name={partnerName} size={30} /> : null}
        </View>
      )}

      <View style={[styles.bubbleWrap, isMine ? styles.bubbleWrapMine : styles.bubbleWrapTheirs]}>
        <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
          <Text style={[styles.bubbleText, isMine ? styles.bubbleTextMine : styles.bubbleTextTheirs]}>
            {message.content}
          </Text>
        </View>

        {/* Heure + statut lu */}
        <View style={[styles.metaRow, isMine ? styles.metaRowMine : styles.metaRowTheirs]}>
          <Text style={styles.metaTime}>{time}</Text>
          {isMine && (
            <Ionicons
              name={message.readAt ? 'checkmark-done' : 'checkmark'}
              size={12}
              color={message.readAt ? C.read : C.unread}
              style={{ marginLeft: 3 }}
            />
          )}
        </View>
      </View>
    </View>
  );
};

// ─── Composant séparateur de date ─────────────────────────────
const DateSeparator = ({ date }: { date: string }) => (
  <View style={styles.separator}>
    <View style={styles.separatorLine} />
    <Text style={styles.separatorText}>{formatSeparatorDate(date)}</Text>
    <View style={styles.separatorLine} />
  </View>
);

// ─── Indicateur de frappe ─────────────────────────────────────
const TypingIndicator = ({ name }: { name: string }) => {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: -4, duration: 250, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 250, useNativeDriver: true }),
          Animated.delay(500),
        ])
      );
    const a1 = anim(dot1, 0);
    const a2 = anim(dot2, 150);
    const a3 = anim(dot3, 300);
    a1.start(); a2.start(); a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, []);

  return (
    <View style={styles.bubbleRow}>
      <View style={{ width: 34, marginRight: 6, alignSelf: 'flex-end' }}>
        <Avatar name={name} size={30} />
      </View>
      <View style={[styles.bubble, styles.bubbleTheirs, styles.typingBubble]}>
        {[dot1, dot2, dot3].map((dot, i) => (
          <Animated.View
            key={i}
            style={[styles.typingDot, { transform: [{ translateY: dot }] }]}
          />
        ))}
      </View>
    </View>
  );
};

// ─── Barre de saisie ──────────────────────────────────────────
const InputBar = ({
  onSend,
  onTyping,
  disabled,
}: {
  onSend: (text: string) => void;
  onTyping: (typing: boolean) => void;
  disabled: boolean;
}) => {
  const [text, setText] = useState('');
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTyping = useRef(false);

  const handleChangeText = (val: string) => {
    setText(val);

    // Émettre typing start une seule fois
    if (!isTyping.current && val.length > 0) {
      isTyping.current = true;
      onTyping(true);
    }

    // Reset le timer
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      isTyping.current = false;
      onTyping(false);
    }, 1500);

    // Si le champ est vide, arrêter immédiatement
    if (val.length === 0) {
      isTyping.current = false;
      onTyping(false);
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
    }
  };

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText('');
    isTyping.current = false;
    onTyping(false);
  };

  return (
    <View style={styles.inputBar}>
      <TextInput
        style={styles.input}
        value={text}
        onChangeText={handleChangeText}
        placeholder="Message…"
        placeholderTextColor={C.textMuted}
        multiline
        maxLength={2000}
        returnKeyType="default"
      />
      <TouchableOpacity
        style={[styles.sendBtn, { opacity: text.trim() ? 1 : 0.4 }]}
        onPress={handleSend}
        disabled={!text.trim() || disabled}
      >
        <Ionicons name="arrow-up" size={18} color="#fff" />
      </TouchableOpacity>
    </View>
  );
};

// ═══════════════════════════════════════════════
// Écran principal Chat
// ═══════════════════════════════════════════════
export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const { user, partner, couple, socket } = useAuthStore();
  const { messages, isTyping, hasMore, nextCursor, addMessage, setMessages, prependMessages, setTyping, markAllRead } = useChatStore();

  const flatListRef = useRef<FlatList>(null);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);

  // ─── Charger l'historique initial ───────────────────────────
  useEffect(() => {
    if (!couple) return;
    const fetchHistory = async () => {
      try {
        const { data } = await messageAPI.getMessages(undefined);
        setMessages(data.messages, data.nextCursor);
      } catch {}
      finally { setLoadingHistory(false); }
    };
    fetchHistory();
  }, [couple?.id]);

  // ─── Brancher les événements Socket.io ──────────────────────
  useEffect(() => {
    if (!socket || !couple) return;

    const onNewMessage = (msg: Message) => {
      addMessage(msg);
      // Marquer comme lu si ce n'est pas mon message
      if (msg.senderId !== user?.id) {
        socket.emit('messages:read', { coupleId: couple.id });
      }
    };

    const onTyping = ({ isTyping: typing }: { userId: string; isTyping: boolean }) => {
      setTyping(typing);
    };

    const onMessagesRead = () => { markAllRead(); };

    socket.on('message:new', onNewMessage);
    socket.on('partner:typing', onTyping);
    socket.on('messages:read', onMessagesRead);

    // Marquer les messages existants comme lus à l'ouverture
    socket.emit('messages:read', { coupleId: couple.id });

    return () => {
      socket.off('message:new', onNewMessage);
      socket.off('partner:typing', onTyping);
      socket.off('messages:read', onMessagesRead);
    };
  }, [socket, couple?.id]);

  // ─── Scroll vers le bas à chaque nouveau message ────────────
  useEffect(() => {
    if (messages.length > 0 && !loadingHistory) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  // ─── Charger les messages plus anciens (pagination) ─────────
  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || !nextCursor) return;
    setLoadingMore(true);
    try {
      const { data } = await messageAPI.getMessages(nextCursor);
      prependMessages(data.messages, data.nextCursor);
    } catch {}
    finally { setLoadingMore(false); }
  }, [hasMore, loadingMore, nextCursor]);

  // ─── Envoyer un message ──────────────────────────────────────
  const handleSend = useCallback((text: string) => {
    if (!socket || !couple) return;

    // Message optimiste (ID temporaire)
    const tempId = `temp-${Date.now()}`;
    setSendingId(tempId);
    addMessage({
      id: tempId,
      coupleId: couple.id,
      senderId: user!.id,
      content: text,
      createdAt: new Date().toISOString(),
      sender: { id: user!.id, name: user!.name },
    });

    socket.emit('message:send', { content: text, coupleId: couple.id });
    setSendingId(null);
  }, [socket, couple?.id, user]);

  // ─── Indiquer la frappe au partenaire ────────────────────────
  const handleTyping = useCallback((typing: boolean) => {
    if (!socket || !couple) return;
    socket.emit('message:typing', { coupleId: couple.id, isTyping: typing });
  }, [socket, couple?.id]);

  // ─── Rendu de chaque item de la liste ────────────────────────
  const renderItem = useCallback(({ item, index }: { item: Message; index: number }) => {
    const isMine = item.senderId === user?.id;
    const prev = index > 0 ? messages[index - 1] : null;
    const next = index < messages.length - 1 ? messages[index + 1] : null;

    // Afficher le séparateur de date si jour différent du message précédent
    const showSeparator = !prev || !sameDay(prev.createdAt, item.createdAt);

    // Afficher l'avatar sur le dernier message d'une séquence (avant changement d'émetteur ou fin)
    const showAvatar = !isMine && (!next || next.senderId !== item.senderId || !sameDay(item.createdAt, next.createdAt));

    return (
      <>
        {showSeparator && <DateSeparator date={item.createdAt} />}
        <MessageBubble
          message={item}
          isMine={isMine}
          showAvatar={showAvatar}
          partnerName={partner?.name || '?'}
        />
      </>
    );
  }, [messages, user?.id, partner?.name]);

  // ─── État vide ───────────────────────────────────────────────
  const renderEmpty = () => {
    if (loadingHistory) return null;
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyEmoji}>💬</Text>
        <Text style={styles.emptyTitle}>Commencez à écrire</Text>
        <Text style={styles.emptySub}>
          {partner ? `Votre conversation avec ${partner.name} commence ici` : 'Connectez-vous à votre partenaire'}
        </Text>
      </View>
    );
  };

  if (!couple) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.noCoupleText}>Connectez-vous d'abord à votre partenaire</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      {/* ── Header ─────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Avatar name={partner?.name || '?'} size={36} />
          <View style={{ marginLeft: 10 }}>
            <Text style={styles.headerName}>{partner?.name}</Text>
            <View style={styles.headerStatus}>
              <View style={[
                styles.statusDot,
                { backgroundColor: partner?.isOnline ? '#4CAF7D' : C.unread }
              ]} />
              <Text style={styles.statusText}>
                {partner?.isOnline ? 'En ligne' : 'Hors ligne'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* ── Liste des messages ──────────────────────────────── */}
      {loadingHistory ? (
        <View style={styles.center}>
          <ActivityIndicator color={C.primary} />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmpty}
          ListHeaderComponent={
            loadingMore ? (
              <View style={styles.loadMoreIndicator}>
                <ActivityIndicator size="small" color={C.textMuted} />
              </View>
            ) : hasMore ? (
              <TouchableOpacity style={styles.loadMoreBtn} onPress={loadMore}>
                <Text style={styles.loadMoreText}>Charger les messages précédents</Text>
              </TouchableOpacity>
            ) : null
          }
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />
      )}

      {/* ── Indicateur de frappe ────────────────────────────── */}
      {isTyping && partner && (
        <View style={styles.typingContainer}>
          <TypingIndicator name={partner.name} />
        </View>
      )}

      {/* ── Barre de saisie ─────────────────────────────────── */}
      <View style={[styles.inputContainer, { paddingBottom: insets.bottom + 8 }]}>
        <InputBar
          onSend={handleSend}
          onTyping={handleTyping}
          disabled={!socket?.connected}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: C.card,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  headerName: { fontSize: 16, fontWeight: '700', color: C.text },
  headerStatus: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 12, color: C.textMuted },

  // Avatar
  avatar: { backgroundColor: C.primaryLight, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontWeight: '700', color: C.primary },

  // Liste
  listContent: { paddingHorizontal: 12, paddingVertical: 16, flexGrow: 1 },

  // Bulle
  bubbleRow: { flexDirection: 'row', marginBottom: 3, alignItems: 'flex-end' },
  bubbleRowMine: { flexDirection: 'row-reverse' },
  bubbleRowTheirs: { flexDirection: 'row' },
  bubbleWrap: { maxWidth: '75%' },
  bubbleWrapMine: { alignItems: 'flex-end' },
  bubbleWrapTheirs: { alignItems: 'flex-start' },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  bubbleMine: {
    backgroundColor: C.bubbleMine,
    borderBottomRightRadius: 4,
  },
  bubbleTheirs: {
    backgroundColor: C.bubble,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: C.border,
  },
  bubbleText: { fontSize: 15, lineHeight: 21 },
  bubbleTextMine: { color: C.textMine },
  bubbleTextTheirs: { color: C.text },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2, paddingHorizontal: 2 },
  metaRowMine: { justifyContent: 'flex-end' },
  metaRowTheirs: { justifyContent: 'flex-start' },
  metaTime: { fontSize: 11, color: C.textMuted },

  // Séparateur de date
  separator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
    gap: 8,
  },
  separatorLine: { flex: 1, height: 1, backgroundColor: C.separator },
  separatorText: { fontSize: 12, color: C.textMuted, fontWeight: '500', textTransform: 'capitalize' },

  // Typing
  typingBubble: { paddingVertical: 12, paddingHorizontal: 16 },
  typingContainer: { paddingHorizontal: 12, paddingBottom: 4 },
  typingDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: C.textMuted,
    marginHorizontal: 2,
  },

  // Champ saisie
  inputContainer: { backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.border },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', padding: 10, gap: 8 },
  input: {
    flex: 1,
    backgroundColor: C.inputBg,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: C.text,
    maxHeight: 120,
    minHeight: 42,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Vide / No couple
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 8 },
  emptyEmoji: { fontSize: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: C.text },
  emptySub: { fontSize: 14, color: C.textMuted, textAlign: 'center', paddingHorizontal: 40 },
  noCoupleText: { fontSize: 15, color: C.textMuted, textAlign: 'center', padding: 24 },

  // Pagination
  loadMoreBtn: { alignItems: 'center', paddingVertical: 12 },
  loadMoreText: { fontSize: 13, color: C.primary, fontWeight: '500' },
  loadMoreIndicator: { paddingVertical: 12, alignItems: 'center' },
});
