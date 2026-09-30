'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Check, ChevronDown } from 'lucide-react';
import { locales, localeNames, type Locale } from '@/i18n/config';
import { FlagIcon } from '@/components/ui/FlagIcon';

// Bayroq + to'liq til nomi + kichik chevron ko'rinishidagi til tanlagich —
// headerning yuqori qatori uchun.
//
// Bayroqlar INLINE SVG (components/ui/FlagIcon.tsx) — emoji EMAS:
// Windows emoji bayroqlarni chizmaydi va ularning o'rniga "UZ"/"RU"
// harflari ko'rinib qolardi. O'lcham 20×14, matngacha 8px oraliq.
//
// MUHIM: mavjud `LanguageSwitcher.tsx` (UZ/RU tugmachalari) o'chirilmadi —
// u mobil ko'rinishdagi headerda hali ham ishlatiladi. Bu esa faqat
// yuqori qator uchun qo'shimcha ko'rinish; til almashtirish MANTIG'I
// ikkalasida ham bir xil: manzildagi til bo'lagini almashtirib, query
// parametrlarini saqlab qolgan holda o'sha sahifaga o'tiladi.
export function LanguageMenu({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Tashqariga bosilganda va Escape bosilganda yopiladi.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent | TouchEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  function switchTo(next: Locale) {
    setOpen(false);
    if (next === locale) return;
    const segments = pathname.split('/');
    segments[1] = next;
    // `window.location.search` — LanguageSwitcher.tsx dagi bilan aynan bir
    // xil sabab: useSearchParams() butun sahifani dinamik render qilishga
    // majburlaydi, bu komponent esa har bir sahifada chiziladi.
    const query = typeof window !== 'undefined' ? window.location.search : '';
    router.push((segments.join('/') || `/${next}`) + query);
  }

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] font-medium text-ink-900/70 transition-colors hover:text-ink-950 dark:text-cream/70 dark:hover:text-cream"
      >
        <FlagIcon locale={locale} />
        <span>{localeNames[locale]}</span>
        <ChevronDown size={14} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Yopiq holatda `invisible` — bu nafaqat ko'rinmas qiladi, balki
          elementni klaviatura fokus tartibidan ham chiqaradi
          (visibility: hidden elementlar fokuslanmaydi), ya'ni yopiq menyu
          Tab bosilganda "ushlab qolmaydi". */}
      <div
        role="listbox"
        className={`absolute right-0 top-full z-50 mt-1 min-w-[150px] overflow-hidden rounded-xl border bg-white py-1 shadow-soft transition-all duration-200 ease-out dark:bg-ink-800 ${
          open ? 'visible translate-y-0 opacity-100' : 'invisible -translate-y-1 opacity-0'
        }`}
        style={{ borderColor: 'var(--surface-border)' }}
      >
        {locales.map((l) => (
          <button
            key={l}
            type="button"
            role="option"
            aria-selected={l === locale}
            onClick={() => switchTo(l)}
            className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] font-medium transition-colors hover:bg-ink-900/5 dark:hover:bg-cream/5 ${
              l === locale ? 'text-gold-600 dark:text-gold-400' : 'text-ink-900/80 dark:text-cream/80'
            }`}
          >
            <FlagIcon locale={l} />
            <span className="flex-1">{localeNames[l]}</span>
            {l === locale && <Check size={13} />}
          </button>
        ))}
      </div>
    </div>
  );
}
