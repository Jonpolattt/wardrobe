import type { Metadata } from 'next';
import { locales, defaultLocale, type Locale } from '@/i18n/config';

// Saytning yagona (canonical) manzili. .env dagi NEXT_PUBLIC_SITE_URL
// ustun turadi — layout.tsx dagi metadataBase ham xuddi shu qiymatni
// ishlatadi, shuning uchun bu yerda ham aynan o'sha manba o'qiladi va
// domen ikki joyda ikki xil bo'lib qolmaydi. Oxiridagi "/" olib
// tashlanadi, aks holda manzillar "//uz" ko'rinishida yig'ilib qolardi.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://wardrobestore.uz').replace(/\/+$/, '');

export const SITE_NAME = 'Wardrobe Store';

// ── Brend so'rovlari uchun ──────────────────────────────────────────
// "wardrobestore", "wardrobe uzbekistan" kabi so'rovlarda sayt chiqishi
// uchun Google shu nomlarni sayt bilan BOG'LASHI kerak. Buning uchun
// nomlar sahifada MATN sifatida bo'lishi shart — faqat domen nomida
// turgani yetarli emas, chunki Google domen ichidagi so'zlarni alohida
// brend nomi deb qabul qilishi shart emas.
//
// Quyidagilar Organization structured data'siga "alternateName" bo'lib
// tushadi — bu Google uchun "bu sayt ana shu nomlar bilan ham ataladi"
// degani, ya'ni aynan brend so'rovlarini hal qiladigan joy.
export const BRAND_ALTERNATE_NAMES = [
  'Wardrobe',
  'Wardrobe Store',
  'Wardrobe Uzbekistan',
  "Wardrobe O'zbekiston",
  'wardrobestore',
  'wardrobestore.uz',
];

// Ijtimoiy tarmoqlar — "sameAs". Google shu havolalar orqali sayt va
// Instagram profilini BITTA brend deb bog'laydi. Bog'lanish ikki
// tomonlama bo'lgani muhim: Instagram profilining bio qismida ham
// saytga havola turishi kerak.
export const BRAND_SOCIAL_LINKS = [
  'https://www.instagram.com/wardrobe.uzbekistan/',
  'https://t.me/qqw3130',
];

// Qidiruv natijasida ko'rinadigan tavsif. Saytning O'ZIDAGI matnlar
// (hero sarlavhasi va h.k.) o'zgarmaydi — bu faqat Google uchun va
// ataylab brend nomi + joylashuv + asosiy toifalarni o'z ichiga oladi.
export const SITE_DESCRIPTION: Record<string, string> = {
  uz: "Wardrobe Store (wardrobestore.uz) — O'zbekistondagi onlayn kiyim do'koni. Futbolka, ko'ylak, shim, krossovka va aksessuarlar. Jizzax shahridan O'zbekiston bo'ylab yetkazib berish.",
  ru: 'Wardrobe Store (wardrobestore.uz) — интернет-магазин одежды в Узбекистане. Футболки, рубашки, брюки, кроссовки и аксессуары. Доставка по всему Узбекистану из Джизака.',
};

// Sayt bo'ylab OG/Twitter uchun zaxira rasm. Hozircha logotip — keyinchalik
// public/ ichiga 1200x630 o'lchamli og-image.jpg qo'yilsa, shu yerdagi
// bitta qatorni o'zgartirish kifoya.
export const DEFAULT_OG_IMAGE = '/logo.svg';

// Google'ga "bu sahifaning har tildagi varianti qayerda" deb aytish uchun.
// x-default — tili mos kelmagan foydalanuvchi (masalan ingliz tilidagi
// brauzer) uchun ko'rsatiladigan variant; saytning asosiy tili o'zbekcha
// bo'lgani uchun o'sha beriladi.
export function languageAlternates(path: string): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const l of locales) languages[l] = `${SITE_URL}/${l}${path}`;
  languages['x-default'] = `${SITE_URL}/${defaultLocale}${path}`;
  return languages;
}

export function canonicalUrl(locale: Locale, path: string): string {
  return `${SITE_URL}/${locale}${path}`;
}

interface PageSeoInput {
  locale: Locale;
  /** Til prefiksisiz yo'l: '' (bosh sahifa), '/shop', '/product/oq-koylak' */
  path: string;
  title: string;
  description?: string;
  images?: string[];
  /** Mahsulot sahifalari uchun 'article' emas, OG turini aniq berish */
  ogType?: 'website' | 'article';
}

// Har bir public sahifa uchun bir xil, to'liq metadata to'plami:
// canonical + hreflang + Open Graph + Twitter. Bitta joyda turgani uchun
// keyinchalik biror narsa qo'shilsa (masalan yangi til), hamma sahifa
// birdek yangilanadi.
export function pageSeo({ locale, path, title, description, images, ogType = 'website' }: PageSeoInput): Metadata {
  const url = canonicalUrl(locale, path);
  const ogImages = (images && images.length > 0 ? images : [DEFAULT_OG_IMAGE]).map((src) =>
    src.startsWith('http') ? src : `${SITE_URL}${src.startsWith('/') ? '' : '/'}${src}`,
  );

  return {
    title,
    description,
    alternates: {
      canonical: url,
      languages: languageAlternates(path),
    },
    openGraph: {
      type: ogType,
      url,
      siteName: SITE_NAME,
      title,
      description,
      images: ogImages,
      locale: locale === 'ru' ? 'ru_RU' : 'uz_UZ',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ogImages,
    },
  };
}

// Qidiruv tizimlari indekslamasligi kerak bo'lgan sahifalar ro'yxati —
// tizimga kirish talab qiladigan, shaxsiy yoki admin bo'limlari. Bitta
// manba sifatida middleware.ts shu ro'yxatdan o'qiydi (X-Robots-Tag:
// noindex sarlavhasini qo'yadi) va sitemap.ts ham shu ro'yxatga tayanib
// bu sahifalarni xaritaga KIRITMAYDI. Til prefiksisiz yoziladi.
export const PRIVATE_PATH_PREFIXES = [
  '/admin',
  '/cart',
  '/checkout',
  '/orders',
  '/profile',
  '/wishlist',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
];

// Yo'lni til prefiksidan tozalab (/uz/profile → /profile), yopiq
// sahifalar ro'yxatiga tushadimi — shuni tekshiradi.
export function isPrivatePath(pathname: string): boolean {
  let path = pathname;
  for (const l of locales) {
    if (path === `/${l}`) return false;
    if (path.startsWith(`/${l}/`)) {
      path = path.slice(l.length + 1);
      break;
    }
  }
  return PRIVATE_PATH_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}
