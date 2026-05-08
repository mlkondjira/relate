import { useEffect, useRef, useCallback } from 'react';
import { useAuthStore, useChatStore } from '../stores';
import { messageAPI } from '../services/api.service';

export const useChat = () => {
  const { socket, user, couple } = useAuthStore();
  const { messages, isTyping, hasMore, nextCursor, addMessage, setMessages, prependMessages, setTyping, markAllRead } = useChatStore();
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLoadingMore = useRef(false);

  // ─── Charger l'historique initial ────────────────────────
  useEffect(() => {
    if (!couple) return;

    const load = async () => {
      try {
        const { data } = await messageAPI.getMessages();
        setMessages(data.messages, data.nextCursor);
        // Marquer comme lus via socket
        socket?.emit('messages:read', { coupleId: couple.id });
      } catch (err) {
        console.error('Erreur chargement messages:', err);
      }
    };

    load();
  }, [couple?.id]);

  // ─── Écouter les events socket ────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const onNewMessage = (msg: any) => {
      addMessage(msg);
      // Si le message vient du partenaire, le marquer comme lu immédiatement
      if (msg.senderId !== user?.id && couple) {
        socket.emit('messages:read', { coupleId: couple.id });
      }
    };

    const onTyping = ({ isTyping: typing }: { userId: string; isTyping: boolean }) => {
      setTyping(typing);
    };

    const onMessagesRead = () => {
      markAllRead();
    };

    socket.on('message:new', onNewMessage);
    socket.on('partner:typing', onTyping);
    socket.on('messages:read', onMessagesRead);

    return () => {
      socket.off('message:new', onNewMessage);
      socket.off('partner:typing', onTyping);
      socket.off('messages:read', onMessagesRead);
    };
  }, [socket, user?.id, couple?.id]);

  // ─── Envoyer un message ───────────────────────────────────
  const sendMessage = useCallback((content: string) => {
    if (!content.trim() || !socket || !couple) return;
    socket.emit('message:send', { content: content.trim(), coupleId: couple.id });
  }, [socket, couple?.id]);

  // ─── Indicateur de frappe ─────────────────────────────────
  const onTypingChange = useCallback((text: string) => {
    if (!socket || !couple) return;

    socket.emit('message:typing', { coupleId: couple.id, isTyping: text.length > 0 });

    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    if (text.length > 0) {
      typingTimeout.current = setTimeout(() => {
        socket.emit('message:typing', { coupleId: couple.id, isTyping: false });
      }, 2000);
    }
  }, [socket, couple?.id]);

  // ─── Charger plus de messages (pagination) ────────────────
  const loadMore = useCallback(async () => {
    if (!hasMore || isLoadingMore.current || !nextCursor) return;
    isLoadingMore.current = true;
    try {
      const { data } = await messageAPI.getMessages(nextCursor);
      prependMessages(data.messages, data.nextCursor);
    } catch {}
    finally { isLoadingMore.current = false; }
  }, [hasMore, nextCursor]);

  return { messages, isTyping, hasMore, sendMessage, onTypingChange, loadMore };
};
