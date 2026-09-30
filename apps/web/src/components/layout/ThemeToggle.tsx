'use client';

import { Moon, Sun } from 'lucide-react';
import { useThemeStore } from '@/lib/store/theme-store';

export function ThemeToggle({ label }: { label?: { light: string; dark: string } }) {
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggleTheme}
      aria-label={isDark ? label?.light ?? 'Light mode' : label?.dark ?? 'Dark mode'}
      title={isDark ? label?.light ?? 'Light mode' : label?.dark ?? 'Dark mode'}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-900 transition-colors hover:bg-ink-900/5 dark:text-cream dark:hover:bg-cream/10 sm:h-9 sm:w-9"
    >
      {isDark ? <Sun size={16} className="sm:hidden" /> : <Moon size={16} className="sm:hidden" />}
      {isDark ? <Sun size={18} className="hidden sm:block" /> : <Moon size={18} className="hidden sm:block" />}
    </button>
  );
}
