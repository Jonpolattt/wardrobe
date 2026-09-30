'use client';

import { forwardRef, type InputHTMLAttributes } from 'react';
import { Check } from 'lucide-react';

// Sayt bo'ylab yagona checkbox ko'rinishi.
//
// NEGA KERAK BO'LDI: oddiy `<input type="checkbox">` brauzerning O'Z
// (native) uslubida chiziladi va unga berilgan border/rang klasslarining
// ko'pchiligini butunlay e'tiborsiz qoldiradi — faqat `accent-color`
// ta'sir qiladi. Natijada:
//   • ro'yxatdan o'tish sahifasida checkbox deyarli ko'rinmasdi;
//   • admin panelda `accent-ink-950` (qora) berilgani uchun qora fonda
//     butunlay yo'qolib ketgandi — "knopka yo'q" bo'lib tuyulgan.
//
// Bu yerda haqiqiy input `sr-only` bilan ko'zdan yashiriladi (lekin
// funksional qoladi: bosish, klaviatura, forma qiymati — hammasi
// ishlaydi), ko'rinadigan quti esa o'zimiz chizamiz. Shuning uchun
// natija qaysi brauzer va qaysi mavzuda (kunduzgi/tungi) bo'lishidan
// qat'i nazar bir xil.
//
// Belgi (✓) alohida React holatini talab qilmaydi: quti `peer-checked:`
// orqali CSS darajasida bo'yaladi va ✓ belgisi `currentColor` dan rang
// oladi — belgilanmaganda `text-transparent`, belgilanganda oq. Shu
// tufayli komponent HAM oddiy (`checked`/`onChange`), HAM react-hook-form
// (`{...register('x')}`) bilan birdek ishlaydi.
export const Checkbox = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Checkbox({ className = '', ...props }, ref) {
    return (
      <span className={`relative inline-flex shrink-0 ${className}`}>
        <input ref={ref} type="checkbox" {...props} className="peer sr-only" />
        <span
          aria-hidden="true"
          className="flex h-5 w-5 cursor-pointer items-center justify-center rounded-md border-2 border-ink-900/25 bg-white text-transparent transition-colors peer-checked:border-gold-500 peer-checked:bg-gold-500 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-gold-500 peer-focus-visible:ring-offset-2 dark:border-cream/30 dark:bg-ink-900"
        >
          <Check size={14} strokeWidth={3.5} />
        </span>
      </span>
    );
  },
);
