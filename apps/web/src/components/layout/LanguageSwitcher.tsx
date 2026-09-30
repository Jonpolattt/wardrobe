'use client';

import { usePathname, useRouter } from 'next/navigation';
import { locales, localeNames, type Locale } from '@/i18n/config';

export function LanguageSwitcher({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const router = useRouter();

  function switchTo(next: Locale) {
    if (next === locale) return;
    const segments = pathname.split('/');
    segments[1] = next;
    // usePathname() never includes the query string, so without this, every
    // language switch silently dropped it — e.g. mid-flow on
    // reset-password (?token=... / ?identifier=...) or verify-email
    // (?email=...&phone=...), that sent the user to a URL those pages
    // treat as "arrived with nothing," showing their "missing" error
    // screen instead of just switching language. Reading it straight from
    // the browser (not next/navigation's useSearchParams()) deliberately —
    // that hook requires whatever renders it to sit inside a <Suspense>
    // boundary to avoid opting every page that renders it out of static
    // rendering, and this component (via Header) is mounted in the root
    // layout on literally every route with no Suspense wrapper.
    // switchTo only ever runs from a browser click handler, so
    // window.location.search is always available here.
    const query = typeof window !== 'undefined' ? window.location.search : '';
    router.push((segments.join('/') || `/${next}`) + query);
  }

  return (
    <div className="flex items-center gap-1 rounded-full border border-ink-900/10 p-1 text-xs font-semibold dark:border-cream/10">
      {locales.map((l) => (
        <button
          key={l}
          onClick={() => switchTo(l)}
          className={`rounded-full px-2 py-1 uppercase transition-colors sm:px-3 sm:py-1.5 ${
            l === locale
              ? 'bg-gold-500 text-ink-950'
              : 'text-ink-900/60 hover:text-ink-950 dark:text-cream/60 dark:hover:text-cream'
          }`}
          aria-label={localeNames[l]}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
