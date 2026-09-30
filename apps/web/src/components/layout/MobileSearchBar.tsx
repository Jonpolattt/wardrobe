'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Heart } from 'lucide-react';
import { useQuery } from '@apollo/client';
import { GET_MY_WISHLIST } from '@/lib/graphql/queries';
import { useAuthStore } from '@/lib/store/auth-store';
import { HeaderSearch } from './HeaderSearch';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/get-dictionary';

interface MobileSearchBarProps {
  locale: Locale;
  dict: Dictionary;
}

// Header ostidagi qidiruv qatori — FAQAT kichik ekranlar uchun
// (`lg:hidden`). Chapda qidiruv maydoni, o'ng chetida sevimlilar
// (yurakcha) tugmasi; maydonga bosilganda yurakcha "Bekor qilish"
// tugmasiga almashadi.
//
// QIDIRUV MANTIG'I — DESKTOP BILAN AYNAN BIR XIL: bu yerda alohida
// qidiruv yozilmagan, kompyuterdagi headerda ishlatiladigan
// `HeaderSearch` komponentining O'ZI chiziladi. Ya'ni yozilgan harf
// bo'yicha darhol chiqadigan natijalar paneli (tovarlar, kategoriyalar),
// oxirgi qidiruvlar tarixi, klaviatura bilan boshqarish va Enter
// bosilganda do'kon sahifasiga o'tish — hammasi bir xil ishlaydi.
// Avval bu yerda oddiy `form` turardi: u faqat Enter bosilganda
// /shop?search=... ga yuborardi, natijalar paneli esa umuman yo'q edi.
//
// JOYLASHUVI: komponent headerdan TASHQARIDA, HeaderGate ichida
// `sticky` holatda chiziladi — shuning uchun sahifa scroll qilinganda
// headerning yuqori qismi tepaga chiqib ketadi, bu qator esa ekran
// tepasida yopishib qoladi.
export function MobileSearchBar({ locale, dict }: MobileSearchBarProps) {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);

  const { data: wishlistData } = useQuery(GET_MY_WISHLIST, { skip: !user, fetchPolicy: 'cache-first' });
  const wishlistCount = wishlistData?.myWishlist?.length ?? 0;

  // Qidiruv maydoniga bosilganda (fokus) yurakcha tugmasi "Bekor qilish"
  // tugmasiga almashadi.
  const [focused, setFocused] = useState(false);
  // Har bosilganda 1 ga oshadi — HeaderSearch shu o'zgarishni ko'rib
  // natijalar panelini yopadi (uning `closeToken` izohiga qarang).
  const [closeToken, setCloseToken] = useState(0);
  const rowRef = useRef<HTMLDivElement>(null);

  function handleCancel() {
    // `blur()` — telefonda klaviaturani yopadigan yagona ishonchli yo'l.
    // Fokus qidiruv maydonida bo'lgani uchun uni shu yerdan olib
    // tashlaymiz.
    const active = typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null;
    active?.blur();
    setFocused(false);
    // Pastdagi natijalar oynasi ham yopiladi.
    setCloseToken((t) => t + 1);
  }

  // Admin panelda xaridorga mo'ljallangan qidiruv qatori keraksiz —
  // MobileBottomNav ham xuddi shunday qilib o'zini yashiradi.
  if (pathname?.startsWith(`/${locale}/admin`)) return null;

  return (
    <div className="container-app py-2 lg:hidden">
      {/* Fokusni QATOR darajasida kuzatamiz: fokus maydondan natijalar
          panelidagi tugmaga o'tganda ham "Bekor qilish" joyida qolishi
          kerak. `relatedTarget` shu qator ichida bo'lsa — holat
          o'zgarmaydi. */}
      <div
        ref={rowRef}
        className="flex items-center gap-2"
        onFocusCapture={() => setFocused(true)}
        onBlurCapture={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setFocused(false);
        }}
      >
        {/* "Bekor qilish" tugmasi maydonning ICHIDA turadi (tozalash ×
            tugmasining o'ng tomonida), fon rangi — saytning asosiy ko'k
            aksenti. Qator ichida alohida joy egallamaydi, shuning uchun
            maydon to'liq kenglikda qoladi.

            Yopiq holatda `max-w-0` + `-ml-2.5`: nol kenglikdagi element
            ham ota `gap-2.5` tufayli bo'shliq qoldirar edi — manfiy
            chekka aynan shu bo'shliqni so'ndiradi. */}
        <HeaderSearch
          locale={locale}
          dict={dict}
          closeToken={closeToken}
          trailing={
            <button
              type="button"
              // `onPointerDown` da `preventDefault` — busiz tugmaga
              // tegilishi bilan maydon fokusni yo'qotib, tugma
              // bosilishidan OLDIN g'oyib bo'lardi. Amal ham shu yerda
              // bajariladi: `touchstart` ni to'xtatish ba'zi
              // brauzerlarda keyingi `click` hodisasini butunlay bekor
              // qiladi, ya'ni faqat `onClick` ga tayanib bo'lmaydi.
              onPointerDown={(e) => {
                e.preventDefault();
                handleCancel();
              }}
              onClick={handleCancel}
              tabIndex={focused ? undefined : -1}
              className={`flex h-8 shrink-0 items-center justify-center overflow-hidden whitespace-nowrap bg-gold-500 text-[13px] font-semibold transition-all duration-300 ease-[cubic-bezier(.33,1,.68,1)] motion-reduce:transition-none ${
                focused ? 'max-w-[140px] px-3 opacity-100' : 'pointer-events-none -ml-2.5 max-w-0 px-0 opacity-0'
              }`}
            >
              {dict.profile.cancel}
            </button>
          }
        />

        {/* Yurakcha va "Bekor qilish" — bitta joyda almashadigan juftlik.
            Ikkalasi ham doim DOM'da turadi: fokusda yurakchaning kengligi
            0 ga tushadi, tugmaniki esa ochiladi (va aksincha). Shuning
            uchun o'tish silliq — element paydo bo'lib/yo'qolib
            sakramaydi.

            `overflow-hidden` ATAYLAB tashqi TO'RTBURCHAK o'ramda, dumaloq
            tugmaning o'zida emas: `rounded-full` + `overflow-hidden`
            kesishni DOIRA bo'ylab bajaradi va burchakdagi sanoq
            doirachasi (badge) qirqilib qolardi — aynan shu nosozlik
            kuzatilgan edi. */}
        <div
          className={`relative h-11 shrink-0 overflow-hidden transition-all duration-300 ease-[cubic-bezier(.33,1,.68,1)] motion-reduce:transition-none ${
            focused ? 'w-0 opacity-0' : 'w-11 opacity-100'
          }`}
        >
          <Link
            href={`/${locale}/wishlist`}
            prefetch={false}
            aria-label={dict.nav.wishlist}
            tabIndex={focused ? -1 : undefined}
            className="flex h-11 w-11 items-center justify-center rounded-[10px] border border-[color:var(--surface-border)] bg-[color:var(--surface-input)] text-ink-900 transition-colors active:bg-ink-900/10 dark:text-cream"
          >
            <Heart size={19} strokeWidth={1.75} />
          </Link>
          {wishlistCount > 0 && (
            // Sanoq o'ramning ICHIDA (right-0/top-0) — shuning uchun u
            // hech qachon kesilmaydi.
            <span className="pointer-events-none absolute right-0 top-0 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-gold-500 px-1 text-[9px] font-bold leading-none text-white">
              {wishlistCount}
            </span>
          )}
        </div>

      </div>
    </div>
  );
}
