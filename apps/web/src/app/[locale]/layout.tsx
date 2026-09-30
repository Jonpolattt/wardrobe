import type { Metadata, Viewport } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
import '../globals.css';
import { Providers } from '@/components/providers/Providers';
// Header endi to'g'ridan-to'g'ri emas, HeaderGate orqali chiziladi —
// u profil sahifasida telefonda headerni yashiradi (izohi shu
// faylning o'zida).
import { HeaderGate } from '@/components/layout/HeaderGate';
import { Footer } from '@/components/layout/Footer';
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';
import { locales, type Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/get-dictionary';
import { serverFetchGraphQL } from '@/lib/graphql/server-fetch';
import { GET_SITE_SETTINGS_STR } from '@/lib/graphql/server-queries';
import { SITE_URL, SITE_NAME, BRAND_ALTERNATE_NAMES, BRAND_SOCIAL_LINKS, SITE_DESCRIPTION } from '@/lib/seo/site';

const inter = Inter({ subsets: ['latin', 'cyrillic'], variable: '--font-sans', display: 'swap' });
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-display', display: 'swap' });

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

// Explicit, in case an embedding webview (e.g. Telegram's in-app browser)
// ignores Next.js's implicit default and falls back to a desktop-width
// virtual viewport (~980-1024px) scaled down to fit the screen — that's
// what makes everything look tiny/cramped and can even make `lg:`-gated
// desktop-only elements (like the header's Login button) show up on a
// phone, since the browser genuinely believes it has 1024px of width.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export async function generateMetadata({
  params,
}: {
  params: { locale: Locale };
}): Promise<Metadata> {
  const dict = await getDictionary(params.locale);
  return {
    // Ijtimoiy tarmoqlarga (Telegram, Instagram va h.k.) havola
    // tashlanganda Open Graph/Twitter rasm-manzillari nisbiy holda
    // ("/logo.svg" kabi) beriladi — Next.js ularni to'liq URL'ga
    // aylantirish uchun shu asosiy manzildan foydalanadi. Bu qiymat
    // bo'lmasa, Next.js "http://localhost:3000" ga tushib qoladi va
    // preview rasm/link ishlamay qoladi. Ishlab chiqarish domenini
    // .env orqali (NEXT_PUBLIC_SITE_URL) ham almashtirish mumkin —
    // masalan vaqtinchalik tunnel manzili bilan sinash uchun.
    metadataBase: new URL(SITE_URL),
    // Sarlavhada "Wardrobe Store" to'liq yozilishi muhim — qidiruv
    // natijasida ko'rinadigan matn ham shu, va Google brend nomini
    // aynan shu yerdan o'qiydi. `template` tufayli ichki sahifalar ham
    // (masalan "Do'kon — Wardrobe Store") brend nomini olib yuradi.
    title: {
      default: `Wardrobe Store — ${dict.home.heroTitle}`,
      template: '%s — Wardrobe Store',
    },
    description: SITE_DESCRIPTION[params.locale] ?? SITE_DESCRIPTION.uz,
    // Qidiruv so'zlari. Google bu tegga deyarli e'tibor bermaydi, lekin
    // Yandex va ba'zi mahalliy qidiruv tizimlari hisobga oladi — zarari
    // yo'q, foydasi bor.
    keywords: [
      ...BRAND_ALTERNATE_NAMES,
      ...(params.locale === 'ru'
        ? ['интернет-магазин одежды', 'одежда Узбекистан', 'кроссовки', 'футболки', 'рубашки', 'Джизак', 'доставка по Узбекистану']
        : ["onlayn kiyim do'koni", "kiyim O'zbekiston", 'krossovka', 'futbolka', "ko'ylak", 'Jizzax', 'yetkazib berish']),
    ],
    icons: {
      icon: '/logo.svg',
      shortcut: '/logo.svg',
      apple: '/logo.svg',
    },
    // Butun sayt bo'yicha indekslashga ruxsat — ochiq sahifalarning
    // birortasida ham tasodifan `noindex` qolib ketmasligi uchun bu
    // ATAYLAB aniq yozilgan. Yopiq sahifalar (profil, savat, admin...)
    // esa middleware.ts dagi X-Robots-Tag orqali yopiladi.
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-image-preview': 'large',
        'max-snippet': -1,
        'max-video-preview': -1,
      },
    },
    // DIQQAT: bu yerda `alternates` ATAYLAB berilmagan. Avval shu joyda
    // `languages: { uz: '/uz', ru: '/ru' }` turardi va u layout bo'lgani
    // uchun HAMMA sahifaga meros bo'lib o'tardi — natijada /uz/shop ham,
    // /uz/product/... ham o'zining til variantlari sifatida BOSH SAHIFAni
    // ko'rsatardi, bu esa Google uchun noto'g'ri signal. Endi har bir
    // sahifa o'zining canonical + hreflang juftini pageSeo() orqali
    // o'zi beradi (lib/seo/site.ts).
    // Ijtimoiy tarmoqlarda havola ulashilganda ko'rinadigan sarlavha/tavsif
    // ham brend nomining to'liq shaklini olib yuradi — SITE_NAME bitta
    // manbadan keladi, shuning uchun kelajakda nom o'zgarsa hamma joyda
    // birdek o'zgaradi.
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      title: `${SITE_NAME} — ${dict.home.heroTitle}`,
      description: SITE_DESCRIPTION[params.locale] ?? SITE_DESCRIPTION.uz,
      locale: params.locale === 'ru' ? 'ru_RU' : 'uz_UZ',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${SITE_NAME} — ${dict.home.heroTitle}`,
      description: SITE_DESCRIPTION[params.locale] ?? SITE_DESCRIPTION.uz,
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { locale: Locale };
}) {
  const dict = await getDictionary(params.locale);

  // Footer'dagi Telegram/Instagram havolalari admin panelning
  // "Sozlamalar" bo'limidan keladi. Serverda o'qiladi (brauzerdan
  // qo'shimcha so'rov yubormaslik uchun); backend javob bermasa —
  // footer o'zining standart havolalariga qaytadi, sahifa buzilmaydi.
  const siteSettings = await serverFetchGraphQL<{
    siteSettings: {
      socialTelegram?: string | null;
      socialInstagram?: string | null;
      socialTiktok?: string | null;
    } | null;
  }>(GET_SITE_SETTINGS_STR, undefined, 300)
    .then((r) => r.siteSettings)
    .catch(() => null);

  // Structured data (JSON-LD) — Google qidiruv natijasida sayt nomini,
  // logotipini va ichki qidiruv maydonini to'g'ri ko'rsatishi uchun.
  // Organization: "bu qanday tashkilot"; WebSite + SearchAction: Google
  // natijada to'g'ridan-to'g'ri sayt ichida qidirish maydonini
  // chiqarishi mumkin (sitelinks searchbox).
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        // OnlineStore — oddiy "Organization" emas, aynan onlayn do'kon
        // ekanini bildiradi. `alternateName` va `sameAs` — brend
        // so'rovlarini ("wardrobestore", "wardrobe uzbekistan") hal
        // qiladigan asosiy joy: Google shular orqali sayt, Instagram
        // profili va turli yozilishlarni BITTA brend deb tanidi.
        '@type': 'OnlineStore',
        '@id': `${SITE_URL}/#organization`,
        name: SITE_NAME,
        alternateName: BRAND_ALTERNATE_NAMES,
        url: SITE_URL,
        logo: `${SITE_URL}/logo.svg`,
        image: `${SITE_URL}/logo.svg`,
        description: SITE_DESCRIPTION[params.locale] ?? SITE_DESCRIPTION.uz,
        sameAs: BRAND_SOCIAL_LINKS,
        address: {
          '@type': 'PostalAddress',
          addressLocality: params.locale === 'ru' ? 'Джизак' : 'Jizzax',
          addressCountry: 'UZ',
        },
        areaServed: {
          '@type': 'Country',
          name: params.locale === 'ru' ? 'Узбекистан' : "O'zbekiston",
        },
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        url: SITE_URL,
        name: SITE_NAME,
        alternateName: BRAND_ALTERNATE_NAMES,
        description: SITE_DESCRIPTION[params.locale] ?? SITE_DESCRIPTION.uz,
        inLanguage: params.locale === 'ru' ? 'ru-RU' : 'uz-UZ',
        publisher: { '@id': `${SITE_URL}/#organization` },
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: `${SITE_URL}/${params.locale}/shop?search={search_term_string}`,
          },
          'query-input': 'required name=search_term_string',
        },
      },
    ],
  };

  return (
    <html
      lang={params.locale}
      className={`${inter.variable} ${playfair.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Runs before React hydrates so the page never flashes the wrong
            theme on load — reads the same zustand-persist key ThemeStore
            writes to. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var raw=localStorage.getItem('fashion-marketplace-theme');var theme=raw?JSON.parse(raw).state.theme:'light';if(theme==='dark'){document.documentElement.classList.add('dark');}}catch(e){}})();`,
          }}
        />
        {/* Organization + WebSite structured data — yuqoridagi `jsonLd`ga
            qarang. Server'da render bo'ladi, ya'ni Google HTML'ning
            o'zidayoq ko'radi (JavaScript ishga tushishini kutmaydi). */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body>
        <Providers>
          <HeaderGate locale={params.locale} dict={dict} />
          {/* Header endi `fixed` EMAS: yuqori qator oddiy oqimda
              (scroll qilinganda sahifa bilan ketadi), asosiy qator esa
              `sticky top-0` (Header.tsx). Sticky element hujjat oqimida
              o'z joyini egallaydi, shuning uchun bu yerda avvalgidek
              sun'iy `pt-[68px] sm:pt-[84px]` berish SHART EMAS — aksincha,
              u endi tepada bo'sh joy qoldirib ketardi. Shu sababli
              MobileSearchBarSpacer ham olib tashlandi: qidiruv qatori
              sticky blok ichida, ya'ni o'z joyini o'zi egallaydi. */}
          <main className="min-h-[70vh]">{children}</main>
          <Footer
            locale={params.locale}
            dict={dict}
            telegramUrl={siteSettings?.socialTelegram}
            instagramUrl={siteSettings?.socialInstagram}
            tiktokUrl={siteSettings?.socialTiktok}
          />
          {/* Clears the fixed MobileBottomNav below on small screens so the
              end of the Footer isn't hidden behind it; not needed on lg+
              where that nav is hidden. Taller than the nav's own height
              because the nav now floats with its own bottom margin (plus
              the iPhone home-indicator safe area on notched devices)
              instead of sitting flush against the bottom edge. */}
          <div className="h-28 lg:hidden" />
          <MobileBottomNav locale={params.locale} dict={dict} />
        </Providers>
      </body>
    </html>
  );
}
