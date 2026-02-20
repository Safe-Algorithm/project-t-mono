import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import i18n from '../lib/i18n';

export type Language = 'en' | 'ar';

interface LanguageState {
  language: Language;
  isRTL: boolean;
  setLanguage: (lang: Language) => Promise<void>;
  loadFromStorage: () => Promise<void>;
}

function getSystemLanguage(): Language {
  const locale = Localization.getLocales?.()?.[0]?.languageCode ?? '';
  return locale === 'ar' ? 'ar' : 'en';
}

export const useLanguageStore = create<LanguageState>((set) => ({
  language: 'en',
  isRTL: false,

  loadFromStorage: async () => {
    try {
      const stored = await AsyncStorage.getItem('app_language');
      const lang: Language = stored === 'ar' ? 'ar' : stored === 'en' ? 'en' : getSystemLanguage();
      const isRTL = lang === 'ar';
      await i18n.changeLanguage(lang);
      set({ language: lang, isRTL });
    } catch {
      // default to en
    }
  },

  setLanguage: async (lang: Language) => {
    const isRTL = lang === 'ar';
    await AsyncStorage.setItem('app_language', lang);
    await i18n.changeLanguage(lang);
    set({ language: lang, isRTL });
  },
}));
