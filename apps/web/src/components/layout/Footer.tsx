'use client';

import Link from 'next/link';
import { Instagram, Send } from 'lucide-react';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/get-dictionary';
import { BRAND_SOCIAL_LINKS } from '@/lib/seo/site';

// BRAND_SOCIAL_LINKS — JSON-LD (`sameAs`) uchun ham ishlatiladigan bitta
// manba: [Instagram, Telegram]. Admin sozlamada boshqa havola yozmaguncha
// footer ham aynan shularni ko'rsatadi.
const DEFAULT_INSTAGRAM_URL = BRAND_SOCIAL_LINKS[0];
const DEFAULT_TELEGRAM_URL = BRAND_SOCIAL_LINKS[1];

// TikTok ikonkasi lucide-react'da yo'q (u brend logotiplarini saqlamaydi),
// shuning uchun shu yerda oddiy SVG sifatida chizilgan. `currentColor` —
// qolgan ikonkalar bilan bir xil rangda bo'lishi va hover'da birga
// o'zgarishi uchun; `size` propi ham lucide'nikiga o'xshab ishlaydi,
// shunda pastdagi ro'yxatda uchalasi bir xil chaqiriladi.
function TiktokIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M16.5 3c.4 2.2 1.8 3.7 4 4v2.8c-1.4.1-2.8-.3-4-1v6.6c0 3.6-2.6 6.1-6 6.1a5.9 5.9 0 0 1 0-11.8c.3 0 .6 0 .9.1v2.9a3.1 3.1 0 1 0 2.2 2.9V3h2.9Z" />
    </svg>
  );
}

// Ijtimoiy tarmoq havolalari admin panelning "Sozlamalar" bo'limidan
// keladi (layout.tsx ularni serverda o'qib, shu yerga uzatadi).
// Bo'sh bo'lsa — lib/seo/site.ts dagi standart havolalar ishlatiladi,
// shunda footer hech qachon "#" (hech qayerga olib bormaydigan) havola
// ko'rsatmaydi.
//
// Facebook ATAYLAB olib tashlandi — do'konning Facebook sahifasi yo'q,
// ikonka esa "#" ga ishora qilib turardi.
export function Footer({
  locale,
  dict,
  telegramUrl,
  instagramUrl,
  tiktokUrl,
}: {
  locale: Locale;
  dict: Dictionary;
  telegramUrl?: string | null;
  instagramUrl?: string | null;
  tiktokUrl?: string | null;
}) {
  const year = new Date().getFullYear();

  // TikTok'da standart havola YO'Q — Telegram/Instagram'dan farqli
  // o'laroq, u faqat admin sozlamada manzil yozgandan keyin paydo
  // bo'ladi. Aks holda footer'da hech qayerga olib bormaydigan ikonka
  // turib qolardi (aynan Facebook bilan shunday bo'lgan edi).
  const socials = [
    { Icon: Send, href: telegramUrl || DEFAULT_TELEGRAM_URL, label: 'Telegram' },
    { Icon: Instagram, href: instagramUrl || DEFAULT_INSTAGRAM_URL, label: 'Instagram' },
    ...(tiktokUrl ? [{ Icon: TiktokIcon, href: tiktokUrl, label: 'TikTok' }] : []),
  ];

  return (
    <footer className="border-t border-ink-900/5 bg-ink-950 text-cream ">
      <div className="container-app grid gap-10 py-16 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div
            className="brand-wordmark text-xl font-semibold uppercase"
            style={{ letterSpacing: '0.25em' }}
          >
            Wardrobe
          </div>
          <p className="mt-4 max-w-xs text-sm text-cream/60">{dict.home.heroSubtitle}</p>
          <div className="mt-6 flex gap-3">
            {socials.map(({ Icon, href, label }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                title={label}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-cream/15 transition-colors hover:border-gold-400 hover:text-gold-400"
              >
                <Icon size={16} />
              </a>
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wider text-cream/50">{dict.footer.quickLinks}</h4>
          {/* prefetch={false} on every link in this footer: Next.js's
              viewport-prefetch trigger fires once a Link is within its
              rootMargin of the viewport, not only once fully visible — on a
              short homepage this footer qualifies soon after mount, well
              before a visitor has scrolled anywhere near it. Diagnostics on
              a real iPhone (perf overlay, LTE) caught these exact routes
              (/categories, /about, /contact, /orders, /profile) bursting as
              background fetches and stalling for 10-15s, competing with the
              actual page's own critical resources. Doesn't change what
              happens on tap. */}
          <div className="mt-4 flex flex-col gap-3 text-sm text-cream/70">
            <Link href={`/${locale}/shop`} prefetch={false}>{dict.nav.shop}</Link>
            <Link href={`/${locale}/categories`} prefetch={false}>{dict.nav.categories}</Link>
            <Link href={`/${locale}/about`} prefetch={false}>{dict.nav.about}</Link>
            <Link href={`/${locale}/contact`} prefetch={false}>{dict.nav.contact}</Link>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wider text-cream/50">{dict.footer.support}</h4>
          <div className="mt-4 flex flex-col gap-3 text-sm text-cream/70">
            <Link href={`/${locale}/orders`} prefetch={false}>{dict.nav.orders}</Link>
            <Link href={`/${locale}/profile`} prefetch={false}>{dict.nav.profile}</Link>
            <Link href={`/${locale}/contact`} prefetch={false}>{dict.contact.title}</Link>
            <Link href={`/${locale}/terms`} prefetch={false}>{dict.terms.title}</Link>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wider text-cream/50">{dict.home.newsletterTitle}</h4>
          <p className="mt-4 text-sm text-cream/60">{dict.home.newsletterSubtitle}</p>
          <form className="mt-4 flex gap-2" onSubmit={(e) => e.preventDefault()}>
            <input
              type="email"
              placeholder="email@example.com"
              className="w-full rounded-full border border-cream/15 bg-transparent px-4 py-2.5 text-sm outline-none placeholder:text-cream/40 focus:border-gold-400"
            />
            <button className="shrink-0 rounded-full bg-gold-500 px-4 py-2.5 text-xs font-semibold text-ink-950 transition-colors hover:bg-gold-400">
              {dict.home.subscribe}
            </button>
          </form>
        </div>
      </div>

      {/* Brend nomining to'liq shakli ("Wardrobe Store") va mamlakat shu
          yerda HAR BIR sahifada oddiy matn sifatida turadi — Google brend
          nomini domendan emas, aynan sahifadagi matndan o'qiydi.
          Dizaynga ta'siri yo'q: bu o'sha eski mayda mualliflik qatori. */}
      <div className="border-t border-cream/10 py-6 text-center text-xs text-cream/40">
        © {year} Wardrobe Store — {locale === 'ru' ? 'Узбекистан' : "O'zbekiston"}. {dict.footer.rights}.
      </div>
    </footer>
  );
}
