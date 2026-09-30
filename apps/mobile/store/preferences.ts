import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type AppLocale = 'uz' | 'ru';
export type ThemePreference = 'light' | 'dark' | 'system';
interface Preferences {
  locale: AppLocale; mode: ThemePreference; hydrated: boolean;
  setLocale: (locale: AppLocale) => void;
  setMode: (mode: ThemePreference) => void;
}
const initialLocale: AppLocale = getLocales()[0]?.languageCode === 'ru' ? 'ru' : 'uz';
export const usePreferences = create<Preferences>()(
  persist(
    (set) => ({ locale: initialLocale, mode: 'system', hydrated: false,
      setLocale: (locale) => set({ locale }), setMode: (mode) => set({ mode }) }),
    {
      name: 'wardrobe-mobile-preferences', version: 1,
      storage: createJSONStorage(() => AsyncStorage), skipHydration: true,
      partialize: ({ locale, mode }) => ({ locale, mode }),
      merge: (persisted, current) => {
        const saved = persisted && typeof persisted === 'object' ? persisted as Partial<Preferences> : {};
        return { ...current,
          locale: saved.locale === 'uz' || saved.locale === 'ru' ? saved.locale : current.locale,
          mode: saved.mode === 'light' || saved.mode === 'dark' || saved.mode === 'system' ? saved.mode : current.mode };
      },
      onRehydrateStorage: () => () => {
        // Defaults remain usable if device preference storage is unavailable.
        usePreferences.setState({ hydrated: true });
      },
    },
  ),
);
