import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemePreference = 'light' | 'dark' | 'system';

interface ThemeState {
  preference: ThemePreference;
  setPreference: (pref: ThemePreference) => Promise<void>;
  loadFromStorage: () => Promise<void>;
}

export const useThemeStore = create<ThemeState>((set) => ({
  preference: 'system',

  loadFromStorage: async () => {
    try {
      const stored = await AsyncStorage.getItem('app_theme');
      const pref: ThemePreference =
        stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
      set({ preference: pref });
    } catch {
      // default to system
    }
  },

  setPreference: async (pref: ThemePreference) => {
    await AsyncStorage.setItem('app_theme', pref);
    set({ preference: pref });
  },
}));
