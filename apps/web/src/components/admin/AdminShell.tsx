'use client';

import { useState } from 'react';
import { Menu } from 'lucide-react';
import { AdminSidebar } from './AdminSidebar';
import type { Dictionary } from '@/i18n/get-dictionary';
import type { Locale } from '@/i18n/config';

// Holds the mobile drawer's open/closed state and renders the small
// hamburger top bar that's the only way to reach the sidebar on phones —
// AdminSidebar itself is fixed/off-canvas below the `lg` breakpoint (see
// AdminSidebar.tsx), so this shell is what ties "tap hamburger" to
// "sidebar slides in".
export function AdminShell({ locale, dict, children }: { locale: Locale; dict: Dictionary; children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-cream dark:bg-ink-950">
      <AdminSidebar locale={locale} dict={dict} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 overflow-x-hidden">
        <div className="flex items-center gap-3 border-b border-ink-900/5 bg-white px-4 py-3 dark:border-cream/10 dark:bg-ink-900 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-ink-900/10 dark:border-cream/15"
          >
            <Menu size={18} />
          </button>
          <span className="flex items-baseline gap-2">
            <span
              className="font-display text-sm font-semibold uppercase"
              style={{ letterSpacing: '0.16em' }}
            >
              Wardrobe
            </span>
            <span className="text-xs font-normal text-ink-900/40 dark:text-cream/40">Admin</span>
          </span>
        </div>

        <div className="px-4 py-6 sm:px-10 sm:py-8">{children}</div>
      </div>
    </div>
  );
}
