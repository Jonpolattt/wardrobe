'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth-store';
import type { Locale } from '@/i18n/config';

export function AdminGuard({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    // Wait for zustand's persist middleware to finish reading localStorage
    // before deciding the user is logged out — otherwise every hard
    // refresh (Ctrl+R) briefly sees `user === null` (the default, pre-
    // hydration state) and incorrectly redirects a still-logged-in admin
    // to the login page.
    if (!hasHydrated) return;

    if (user === null) {
      router.replace(`/${locale}/login`);
    } else if (user.role !== 'ADMIN') {
      router.replace(`/${locale}`);
    } else {
      setChecked(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, hasHydrated]);

  if (!checked || !user || user.role !== 'ADMIN') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cream/20 border-t-gold-500" />
      </div>
    );
  }

  return <>{children}</>;
}
