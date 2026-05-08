import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

export const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

// Injecter le token JWT dans chaque requête
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('auth_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Gérer l'expiration du token
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401) {
      await SecureStore.deleteItemAsync('auth_token');
      // Le store Zustand détectera l'absence de token et redirigera
    }
    return Promise.reject(err);
  }
);

// ─── Auth ─────────────────────────────────────────────────────
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
  updatePushToken: (pushToken) => api.patch('/auth/push-token', { pushToken }),
};

// ─── Couple ───────────────────────────────────────────────────
export const coupleAPI = {
  createInvite: () => api.post('/couple/invite'),
  joinCouple: (code) => api.post('/couple/join', { code }),
  getCouple: () => api.get('/couple/me'),
  leaveCouple: () => api.delete('/couple/me'),
};

// ─── Check-in ─────────────────────────────────────────────────
export const checkinAPI = {
  checkin: (data) => api.post('/checkins', data),
  getDistance: () => api.get('/checkins/distance'),
  getMyCheckins: () => api.get('/checkins/my'),
};

// ─── Messages ─────────────────────────────────────────────────
export const messageAPI = {
  getMessages: (cursor) => api.get('/messages', { params: { cursor } }),
};

// ─── Moments ─────────────────────────────────────────────────
export const momentAPI = {
  getMoments: () => api.get('/moments'),
  createMoment: (data) => api.post('/moments', data),
  deleteMoment: (id) => api.delete(`/moments/${id}`),
};

// ─── Profil ───────────────────────────────────────────────────
export const profileAPI = {
  update: (data: { name?: string }) => api.patch('/profile', data),
  changePassword: (data: { currentPassword: string; newPassword: string }) => api.post('/profile/change-password', data),
  deleteAccount: () => api.delete('/profile'),
};
  addEntry: (data) => api.post('/cycle', data),
  getMyEntries: () => api.get('/cycle/my'),
  getPartnerEntries: () => api.get('/cycle/partner'),
};
