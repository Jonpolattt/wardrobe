'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark';

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

// Keeping the class on <html> in sync with the store is handled by
// ThemeInitializer (see components/providers/ThemeInitializer.tsx) plus the
// blocking inline script in the root layout, which prevents a flash of the
// wrong theme before React hydrates.
export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'light',
      setTheme: (theme) => {
        set({ theme });
        if (typeof document !== 'undefined') {
          document.documentElement.classList.toggle('dark', theme === 'dark');
        }
      },
      toggleTheme: () => get().setTheme(get().theme === 'dark' ? 'light' : 'dark'),
    }),
    { name: 'fashion-marketplace-theme' },
  ),
);
