import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { io, Socket } from 'socket.io-client';
import { authAPI } from '../services/api.service';

const SOCKET_URL = process.env.EXPO_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:3000';

// ─── Types ────────────────────────────────────────────────────
interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  isOnline: boolean;
  lastSeen: string;
}

interface Couple {
  id: string;
  createdAt: string;
}

interface AuthStore {
  user: User | null;
  partner: User | null;
  couple: Couple | null;
  token: string | null;
  socket: Socket | null;
  isLoading: boolean;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loadFromStorage: () => Promise<void>;
  setPartner: (partner: User | null) => void;
  setCouple: (couple: Couple | null) => void;
  connectSocket: (token: string) => void;
  disconnectSocket: () => void;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  partner: null,
  couple: null,
  token: null,
  socket: null,
  isLoading: true,

  loadFromStorage: async () => {
    try {
      const token = await SecureStore.getItemAsync('auth_token');
      if (!token) return set({ isLoading: false });

      const { data } = await authAPI.me();
      set({
        token,
        user: data.user,
        partner: data.partner,
        couple: data.couple,
        isLoading: false,
      });

      get().connectSocket(token);
    } catch {
      await SecureStore.deleteItemAsync('auth_token');
      set({ isLoading: false });
    }
  },

  login: async (email, password) => {
    const { data } = await authAPI.login({ email, password });
    await SecureStore.setItemAsync('auth_token', data.token);
    set({ token: data.token, user: data.user });
    get().connectSocket(data.token);
  },

  register: async (name, email, password) => {
    const { data } = await authAPI.register({ name, email, password });
    await SecureStore.setItemAsync('auth_token', data.token);
    set({ token: data.token, user: data.user });
    get().connectSocket(data.token);
  },

  logout: async () => {
    try { await authAPI.logout(); } catch {}
    get().disconnectSocket();
    await SecureStore.deleteItemAsync('auth_token');
    set({ user: null, partner: null, couple: null, token: null, socket: null });
  },

  connectSocket: (token) => {
    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket'],
    });

    socket.on('partner:online', ({ isOnline, lastSeen }) => {
      const partner = get().partner;
      if (partner) set({ partner: { ...partner, isOnline, lastSeen } });
    });

    socket.on('couple:joined', ({ couple, partner }) => {
      set({ couple, partner });
    });

    set({ socket });
  },

  disconnectSocket: () => {
    get().socket?.disconnect();
    set({ socket: null });
  },

  setPartner: (partner) => set({ partner }),
  setCouple: (couple) => set({ couple }),
}));

// ─── Store messagerie ──────────────────────────────────────────
interface Message {
  id: string;
  coupleId: string;
  senderId: string;
  content: string;
  createdAt: string;
  readAt?: string;
  sender: { id: string; name: string; avatar?: string };
}

interface ChatStore {
  messages: Message[];
  isTyping: boolean;
  hasMore: boolean;
  nextCursor: string | null;

  addMessage: (msg: Message) => void;
  setMessages: (msgs: Message[], cursor: string | null) => void;
  prependMessages: (msgs: Message[], cursor: string | null) => void;
  setTyping: (isTyping: boolean) => void;
  markAllRead: () => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  messages: [],
  isTyping: false,
  hasMore: false,
  nextCursor: null,

  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  setMessages: (msgs, cursor) => set({ messages: msgs, nextCursor: cursor, hasMore: !!cursor }),
  prependMessages: (msgs, cursor) =>
    set((s) => ({ messages: [...msgs, ...s.messages], nextCursor: cursor, hasMore: !!cursor })),
  setTyping: (isTyping) => set({ isTyping }),
  markAllRead: () =>
    set((s) => ({
      messages: s.messages.map((m) => ({ ...m, readAt: m.readAt || new Date().toISOString() })),
    })),
}));

// ─── Store check-in / distance ─────────────────────────────────
interface DistanceStore {
  distanceKm: number | null;
  distanceFormatted: string | null;
  myLabel: string | null;
  partnerLabel: string | null;
  myCheckinAt: string | null;
  partnerCheckinAt: string | null;

  setDistance: (data: Partial<DistanceStore>) => void;
}

export const useDistanceStore = create<DistanceStore>((set) => ({
  distanceKm: null,
  distanceFormatted: null,
  myLabel: null,
  partnerLabel: null,
  myCheckinAt: null,
  partnerCheckinAt: null,
  setDistance: (data) => set(data),
}));
