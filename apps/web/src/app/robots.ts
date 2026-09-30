import type { MetadataRoute } from 'next';
import { SITE_URL, PRIVATE_PATH_PREFIXES } from '@/lib/seo/site';
import { locales } from '@/i18n/config';

// /robots.txt — Next.js shu fayldan avtomatik yasaydi (App Router'ning
// o'z imkoniyati, qo'lda public/robots.txt yozish shart emas; bu usulning
// afzalligi — domen .env dan olinadi va yopiq sahifalar ro'yxati bitta
// joyda, lib/seo/site.ts da turadi).
//
// Avval bu fayl UMUMAN yo'q edi: /robots.txt so'ralganda sayt 404
// qaytarardi. Google bunday holatda odatda saytni baribir crawl qiladi,
// lekin sitemap'ni topolmaydi va indekslash sekinlashadi.
export default function robots(): MetadataRoute.Robots {
  // Har bir yopiq bo'lim ikkala til prefiksi bilan ham yopiladi:
  // /admin, /uz/admin, /ru/admin — chunki haqiqiy manzillar til
  // prefiksi bilan keladi.
  //
  // Oxirida "/" ATAYLAB qo'yilmagan: robots.txt qoidalari prefiks
  // bo'yicha solishtiriladi, ya'ni "Disallow: /uz/login/" faqat
  // "/uz/login/..." ko'rinishidagi manzillarni yopadi va sahifaning
  // O'ZINI ("/uz/login") ochiq qoldirib yuborardi. Slashsiz yozilganda
  // esa ikkalasi ham — sahifaning o'zi ham, ichidagi hamma narsa ham —
  // qamrab olinadi.
  const disallow = PRIVATE_PATH_PREFIXES.flatMap((p) => [p, ...locales.map((l) => `/${l}${p}`)]);

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow,
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
