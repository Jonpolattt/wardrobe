import type { Locale } from '@/i18n/config';

// Til tanlash uchun bayroqlar — INLINE SVG.
//
// NEGA emoji emas: avval bu yerda 🇺🇿 / 🇷🇺 emojilari turardi, lekin
// Windows ular uchun bayroq shaklini umuman chizmaydi (tizim shriftida
// mamlakat bayroqlari yo'q) va o'rniga ikkita harf — "UZ" / "RU" —
// ko'rinib qolardi. Inline SVG esa har qanday tizim va brauzerda bir xil
// chiziladi, qo'shimcha kutubxona yoki rasm fayli ham talab qilmaydi.
//
// O'lcham 20×14 (nisbat 10:7 — bayroqlarning odatiy nisbati).

const FLAG_CLASS = 'block shrink-0 rounded-[2px] ring-1 ring-black/10 dark:ring-white/15';

function UzFlag({ width, height }: { width: number; height: number }) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 30 21"
      className={FLAG_CLASS}
      role="img"
      aria-label="O'zbekiston"
    >
      {/* Uchta gorizontal yo'l: moviy — oq — yashil, orasida ingichka
          qizil chiziqlar. */}
      <rect width="30" height="21" fill="#fff" />
      <rect width="30" height="6.5" fill="#0099B5" />
      <rect y="14.5" width="30" height="6.5" fill="#1EB53A" />
      <rect y="6.5" width="30" height="0.6" fill="#CE1126" />
      <rect y="13.9" width="30" height="0.6" fill="#CE1126" />
      {/* Yangi oy: to'liq doira ustiga fon rangidagi doira qo'yiladi —
          shunda o'roq shakli hosil bo'ladi. */}
      <circle cx="5.6" cy="3.3" r="2.2" fill="#fff" />
      <circle cx="6.5" cy="3.3" r="2.2" fill="#0099B5" />
      {/* Yulduzlar (ramziy, ixchamlashtirilgan) */}
      <g fill="#fff">
        <circle cx="11" cy="1.9" r="0.45" />
        <circle cx="13.2" cy="1.9" r="0.45" />
        <circle cx="15.4" cy="1.9" r="0.45" />
        <circle cx="11" cy="3.8" r="0.45" />
        <circle cx="13.2" cy="3.8" r="0.45" />
        <circle cx="15.4" cy="3.8" r="0.45" />
        <circle cx="12.1" cy="5.4" r="0.45" />
        <circle cx="14.3" cy="5.4" r="0.45" />
      </g>
    </svg>
  );
}

function RuFlag({ width, height }: { width: number; height: number }) {
  return (
    <svg width={width} height={height} viewBox="0 0 30 21" className={FLAG_CLASS} role="img" aria-label="Россия">
      <rect width="30" height="7" fill="#fff" />
      <rect y="7" width="30" height="7" fill="#0039A6" />
      <rect y="14" width="30" height="7" fill="#D52B1E" />
    </svg>
  );
}

export function FlagIcon({ locale, width = 20, height = 14 }: { locale: Locale; width?: number; height?: number }) {
  if (locale === 'ru') return <RuFlag width={width} height={height} />;
  return <UzFlag width={width} height={height} />;
}
