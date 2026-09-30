'use client';

import { useEffect } from 'react';
import { useThemeStore } from '@/lib/store/theme-store';

// Keeps <html class="dark"> in sync whenever the theme changes after the
// initial page load (the inline script in the root layout already handles
// the very first paint, before React hydrates, to avoid a flash).
export function ThemeInitializer() {
  const theme = useThemeStore((s) => s.theme);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  return null;
}
