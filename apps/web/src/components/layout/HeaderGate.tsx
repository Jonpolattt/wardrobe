'use client';

import { usePathname } from 'next/navigation';
import { Header } from './Header';
import { MobileSearchBar } from './MobileSearchBar';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/get-dictionary';

// Headerni ko'rsatish/yashirish qaroriga javob beradigan yupqa qobiq.
//
// NEGA ALOHIDA FAYL: [locale]/layout.tsx — server komponenti (u sozlamalarni
// serverdan o'qiydi), `usePathname()` esa faqat brauzer komponentida
// ishlaydi. Shu sababli qaror shu kichik 'use client' komponentga
// chiqarildi; Header'ning O'ZI umuman o'zgarmadi.
//
// QOIDA: profil sahifasida telefonda header ko'rinmaydi — u yerdagi
// dizayn bo'yicha ekranning tepasida bo'limning o'z sarlavhasi va orqaga
// tugmasi turadi. Desktopda esa header avvalgidek joyida qoladi (profil
// sahifasining desktop ko'rinishi va ishlashi o'zgarmasligi kerak).
//
// `hidden lg:block` — sof CSS: hech qanday o'lcham o'lchash yo'q, ya'ni
// oyna kengligi o'zgarganda holat darhol va to'g'ri almashadi.
export function HeaderGate({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const pathname = usePathname();
  // `/uz/profile`, `/ru/profile` va ularning ichki yo'llari.
  const isProfile = /^\/[^/]+\/profile(\/|$)/.test(pathname ?? '');

  return (
    <>
      <div className={isProfile ? 'hidden lg:block' : ''}>
        <Header locale={locale} dict={dict} />
      </div>

      {/* Telefondagi qidiruv qatori — headerdan TASHQARIDA va `sticky`.
          Scroll qilinganda headerning yuqori qismi (logotip qatori)
          sahifa bilan birga tepaga chiqib ketadi, bu qator esa ekran
          tepasida yopishib qoladi.

          NEGA AYNAN SHU YERDA: `sticky` element faqat O'Z OTASI
          ko'rinib turganda yopishib turadi. Qator header ichida qolsa,
          header tepaga chiqishi bilan u ham g'oyib bo'lardi. Bu yerda
          otasi — sahifaning butun bo'yiga cho'zilgan tashqi qatlam,
          shuning uchun qator har qanday balandlikda joyida qoladi.

          Foni — headerning o'zi bilan bir xil rang: ostidan o'tayotgan
          sahifa mazmuni qatorning atrofidan ko'rinib qolmasligi
          uchun. */}
      <div
        // `mobile-search-row` — globals.css dagi burchak qoidasi uchun:
        // bu qator headerdan tashqarida bo'lgani uchun undagi tugmalar
        // umumiy 5px qoidasiga tushib qolardi, header ichidagilari esa
        // 10px. Shu klass ikkalasini bir xil qiladi.
        className={`mobile-search-row sticky top-0 z-[900] bg-[color:var(--surface-header)] lg:hidden ${
          isProfile ? 'hidden' : ''
        }`}
      >
        <MobileSearchBar locale={locale} dict={dict} />
      </div>
    </>
  );
}
