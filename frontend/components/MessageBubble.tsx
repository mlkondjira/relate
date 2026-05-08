import { View, Text, StyleSheet } from 'react-native';
import { format, isToday, isYesterday } from 'date-fns';
import { fr } from 'date-fns/locale';

const COLORS = {
  bubbleMe: '#C4785A',
  bubblePartner: '#F0EAE3',
  textMe: '#FFFFFF',
  textPartner: '#2C2117',
  textMuted: '#8A7A72',
  textTime: '#A89890',
};

interface MessageBubbleProps {
  content: string;
  senderId: string;
  createdAt: string;
  readAt?: string | null;
  currentUserId: string;
  showTime?: boolean;
  isLastInGroup?: boolean;
}

const formatTime = (dateStr: string) => format(new Date(dateStr), 'HH:mm');

const formatDateSeparator = (dateStr: string) => {
  const date = new Date(dateStr);
  if (isToday(date)) return "Aujourd'hui";
  if (isYesterday(date)) return 'Hier';
  return format(date, 'EEEE d MMMM', { locale: fr });
};

export const DateSeparator = ({ date }: { date: string }) => (
  <View style={styles.dateSepContainer}>
    <View style={styles.dateSepLine} />
    <Text style={styles.dateSepText}>{formatDateSeparator(date)}</Text>
    <View style={styles.dateSepLine} />
  </View>
);

export const TypingIndicator = () => (
  <View style={[styles.bubble, styles.bubblePartner, { width: 60, paddingVertical: 14 }]}>
    <View style={styles.dotsRow}>
      <View style={[styles.dot, styles.dot1]} />
      <View style={[styles.dot, styles.dot2]} />
      <View style={[styles.dot, styles.dot3]} />
    </View>
  </View>
);

export default function MessageBubble({
  content,
  senderId,
  createdAt,
  readAt,
  currentUserId,
  showTime = true,
  isLastInGroup = true,
}: MessageBubbleProps) {
  const isMe = senderId === currentUserId;

  return (
    <View style={[styles.row, isMe ? styles.rowMe : styles.rowPartner]}>
      <View style={[
        styles.bubble,
        isMe ? styles.bubbleMe : styles.bubblePartner,
        isMe && isLastInGroup && styles.bubbleMeTail,
        !isMe && isLastInGroup && styles.bubblePartnerTail,
      ]}>
        <Text style={[styles.content, isMe ? styles.contentMe : styles.contentPartner]}>
          {content}
        </Text>
      </View>

      {showTime && (
        <View style={[styles.metaRow, isMe ? styles.metaRowMe : styles.metaRowPartner]}>
          <Text style={styles.timeText}>{formatTime(createdAt)}</Text>
          {isMe && (
            <Text style={[styles.readTick, readAt ? styles.readTickBlue : styles.readTickGray]}>
              {readAt ? '✓✓' : '✓'}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { marginVertical: 2, paddingHorizontal: 12 },
  rowMe: { alignItems: 'flex-end' },
  rowPartner: { alignItems: 'flex-start' },

  bubble: {
    maxWidth: '78%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  bubbleMe: {
    backgroundColor: COLORS.bubbleMe,
    borderBottomRightRadius: 18,
  },
  bubbleMeTail: {
    borderBottomRightRadius: 4,
  },
  bubblePartner: {
    backgroundColor: COLORS.bubblePartner,
    borderBottomLeftRadius: 18,
  },
  bubblePartnerTail: {
    borderBottomLeftRadius: 4,
  },

  content: { fontSize: 15, lineHeight: 21 },
  contentMe: { color: COLORS.textMe },
  contentPartner: { color: COLORS.textPartner },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2, marginHorizontal: 4 },
  metaRowMe: { justifyContent: 'flex-end' },
  metaRowPartner: { justifyContent: 'flex-start' },
  timeText: { fontSize: 11, color: COLORS.textTime },
  readTick: { fontSize: 11, fontWeight: '600' },
  readTickBlue: { color: COLORS.bubbleMe },
  readTickGray: { color: COLORS.textTime },

  dateSepContainer: { flexDirection: 'row', alignItems: 'center', marginVertical: 16, paddingHorizontal: 16 },
  dateSepLine: { flex: 1, height: 0.5, backgroundColor: '#DDD5CC' },
  dateSepText: { fontSize: 12, color: COLORS.textMuted, marginHorizontal: 10 },

  dotsRow: { flexDirection: 'row', gap: 4, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#A89890' },
  dot1: { opacity: 0.4 },
  dot2: { opacity: 0.7 },
  dot3: { opacity: 1 },
});
