'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, ShoppingBag, Megaphone, ClipboardList, Tag, Store, Users, Settings, Ticket, LogOut, X } from 'lucide-react';
import { useAuthStore } from '@/lib/store/auth-store';
import { useScrollLock } from '@/lib/hooks/use-scroll-lock';
import type { Dictionary } from '@/i18n/get-dictionary';
import type { Locale } from '@/i18n/config';

interface AdminSidebarProps {
  locale: Locale;
  dict: Dictionary;
  // Controls the mobile off-canvas drawer only — on `lg+` screens the
  // sidebar is always visible regardless of these (see the `lg:translate-x-0
  // lg:static` overrides below), so open/onClose have no effect on desktop.
  open: boolean;
  onClose: () => void;
}

export function AdminSidebar({ locale, dict, open, onClose }: AdminSidebarProps) {
  const pathname = usePathname();
  const clearSession = useAuthStore((s) => s.clearSession);

  // Same `lg` breakpoint (1024px) the drawer's own `lg:static` styling uses.
  // Below it, `open` really does mean "a full-screen overlay is covering the
  // page", so scroll gets locked; at `lg` and above the sidebar is already
  // permanently visible as part of the static layout (not an overlay), so
  // `open` being true there (e.g. left over from resizing down from mobile)
  // must NOT lock scroll — the admin panel would otherwise become
  // unscrollable on desktop for no visible reason.
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  useScrollLock(open && !isDesktop);

  const links = [
    { href: `/${locale}/admin`, label: dict.admin.dashboard, icon: LayoutDashboard, exact: true },
    { href: `/${locale}/admin/products`, label: dict.admin.products, icon: ShoppingBag },
    // Bosh sahifadagi reklama karuseli — mahsulotlar bo'limidan keyin
    // turadi, chunki banner ko'pincha aynan bir tovarga bog'lanadi.
    { href: `/${locale}/admin/banners`, label: dict.admin.banners, icon: Megaphone },
    { href: `/${locale}/admin/promo-codes`, label: dict.admin.promoCodes, icon: Ticket },
    { href: `/${locale}/admin/orders`, label: dict.admin.orders, icon: ClipboardList },
    { href: `/${locale}/admin/categories`, label: dict.admin.categories, icon: Tag },
    { href: `/${locale}/admin/stores`, label: dict.admin.stores, icon: Store },
    { href: `/${locale}/admin/users`, label: dict.admin.users, icon: Users },
    { href: `/${locale}/admin/settings`, label: dict.admin.settings, icon: Settings },
  ];

  return (
    <>
      {/* Backdrop — tapping outside the drawer closes it, mobile only */}
      {open && <div onClick={onClose} className="fixed inset-0 z-40 bg-black/50 lg:hidden" />}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-full w-64 shrink-0 flex-col border-r border-ink-900/5 bg-ink-950 text-cream transition-transform duration-200 ease-out lg:static lg:z-auto lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-6 py-8">
          <Link href={`/${locale}`} className="flex items-baseline gap-2" onClick={onClose}>
            <span
              className="brand-wordmark text-base font-semibold uppercase"
              style={{ letterSpacing: '0.18em' }}
            >
              Wardrobe
            </span>
            <span className="text-xs font-normal text-cream/40">Admin</span>
          </Link>
          <button onClick={onClose} className="text-cream/60 hover:text-cream lg:hidden">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-3">
          {links.map((link) => {
            const active = link.exact ? pathname === link.href : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={onClose}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                  active ? 'bg-gold-500 text-ink-950' : 'text-cream/60 hover:bg-cream/5 hover:text-cream'
                }`}
              >
                <link.icon size={17} />
                {link.label}
              </Link>
            );
          })}
        </nav>

        <button
          onClick={() => {
            clearSession();
            window.location.href = `/${locale}`;
          }}
          className="m-3 flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-cream/60 hover:bg-cream/5 hover:text-cream"
        >
          <LogOut size={17} />
          {dict.nav.logout}
        </button>
      </aside>
    </>
  );
}
