import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../lib/api';

export interface User {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  is_active: boolean;
  is_email_verified: boolean;
  is_phone_verified: boolean;
  role: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  loadFromStorage: () => Promise<void>;
  updateUser: (user: User) => void;
}

export interface RegisterData {
  name: string;
  email?: string;
  phone?: string;
  password: string;
  phone_verification_token?: string;
  email_verification_token?: string;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isLoading: true,
  isAuthenticated: false,

  loadFromStorage: async () => {
    try {
      const [token, userStr] = await AsyncStorage.multiGet(['access_token', 'user']);
      const accessToken = token[1];
      const user = userStr[1] ? JSON.parse(userStr[1]) : null;
      set({ user, accessToken, isAuthenticated: !!accessToken, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  login: async (email, password) => {
    const formData = new FormData();
    formData.append('username', email);
    formData.append('password', password);
    const { data } = await apiClient.post('/login/access-token', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    const meRes = await apiClient.get('/users/me', {
      headers: { Authorization: `Bearer ${data.access_token}` },
    });
    await AsyncStorage.multiSet([
      ['access_token', data.access_token],
      ['refresh_token', data.refresh_token ?? ''],
      ['user', JSON.stringify(meRes.data)],
    ]);
    set({ user: meRes.data, accessToken: data.access_token, isAuthenticated: true });
  },

  register: async (registerData) => {
    const { email_verification_token, phone_verification_token, ...body } = registerData;
    const token = email_verification_token ?? phone_verification_token ?? '';
    await apiClient.post(`/register?verification_token=${encodeURIComponent(token)}`, body);
    const formData = new FormData();
    formData.append('username', (body.email ?? body.phone) as string);
    formData.append('password', body.password);
    const { data } = await apiClient.post('/login/access-token', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    const meRes = await apiClient.get('/users/me', {
      headers: { Authorization: `Bearer ${data.access_token}` },
    });
    await AsyncStorage.multiSet([
      ['access_token', data.access_token],
      ['refresh_token', data.refresh_token ?? ''],
      ['user', JSON.stringify(meRes.data)],
    ]);
    set({ user: meRes.data, accessToken: data.access_token, isAuthenticated: true });
  },

  logout: async () => {
    await AsyncStorage.multiRemove(['access_token', 'refresh_token', 'user']);
    set({ user: null, accessToken: null, isAuthenticated: false });
  },

  updateUser: (user) => {
    AsyncStorage.setItem('user', JSON.stringify(user));
    set({ user });
  },
}));
