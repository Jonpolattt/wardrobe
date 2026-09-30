import type { MetadataRoute } from 'next';
import { SITE_URL, languageAlternates } from '@/lib/seo/site';
import { locales } from '@/i18n/config';
import { serverFetchGraphQL } from '@/lib/graphql/server-fetch';

// /sitemap.xml — Google'ga saytdagi BARCHA ochiq sahifalar ro'yxatini
// beradi. Avval bu fayl ham yo'q edi, ya'ni Google sahifalarni faqat
// havolalar orqali yurib topishi kerak edi; xarita bilan indekslash
// sezilarli tezlashadi.
//
// Mahsulot va toifalar backenddan REAL vaqtda olinadi — yangi mahsulot
// qo'shilsa, xaritaga o'zi tushadi, hech narsani qo'lda yangilash kerak
// emas.

// Har bir sahifa uchun ikkala til varianti + ular o'rtasidagi hreflang
// bog'lanishi. Google shu orqali "bu ikki manzil bir sahifaning ikki
// tildagi varianti" ekanini tushunadi va ularni dublikat deb hisoblamaydi.
function entriesForPath(
  path: string,
  options: { lastModified?: Date; changeFrequency?: MetadataRoute.Sitemap[number]['changeFrequency']; priority?: number } = {},
): MetadataRoute.Sitemap {
  const { lastModified, changeFrequency = 'weekly', priority = 0.7 } = options;
  return locales.map((locale) => ({
    url: `${SITE_URL}/${locale}${path}`,
    lastModified: lastModified ?? new Date(),
    changeFrequency,
    priority,
    alternates: { languages: languageAlternates(path) },
  }));
}

const PRODUCTS_FOR_SITEMAP = `
  query SitemapProducts($filter: ProductFilterInput!) {
    products(filter: $filter) {
      total
      list { slug createdAt }
    }
  }
`;

const CATEGORIES_FOR_SITEMAP = `
  query SitemapCategories {
    categories { slug }
  }
`;

const PAGE_SIZE = 500;
const MAX_PAGES = 20; // 10 000 mahsulotgacha yetadi; cheksiz siklning oldini oladi

async function fetchAllProducts(): Promise<{ slug: string; createdAt?: string }[]> {
  const all: { slug: string; createdAt?: string }[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const data = await serverFetchGraphQL<{ products: { total: number; list: { slug: string; createdAt?: string }[] } }>(
      PRODUCTS_FOR_SITEMAP,
      { filter: { page, limit: PAGE_SIZE, sort: 'NEWEST' } },
      3600,
    );
    const list = data.products?.list ?? [];
    all.push(...list);
    if (all.length >= (data.products?.total ?? 0) || list.length === 0) break;
  }
  return all;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Statik ochiq sahifalar. Yopiq sahifalar (profil, buyurtmalar, savat,
  // to'lov, kirish/ro'yxatdan o'tish, admin) ATAYLAB yo'q — ular
  // lib/seo/site.ts dagi PRIVATE_PATH_PREFIXES ro'yxatida turadi,
  // robots.txt ularni taqiqlaydi va middleware ularga noindex qo'yadi.
  const staticEntries: MetadataRoute.Sitemap = [
    ...entriesForPath('', { changeFrequency: 'daily', priority: 1 }),
    ...entriesForPath('/shop', { changeFrequency: 'daily', priority: 0.9 }),
    ...entriesForPath('/categories', { changeFrequency: 'weekly', priority: 0.8 }),
    ...entriesForPath('/about', { changeFrequency: 'monthly', priority: 0.5 }),
    ...entriesForPath('/contact', { changeFrequency: 'monthly', priority: 0.5 }),
    ...entriesForPath('/terms', { changeFrequency: 'yearly', priority: 0.3 }),
  ];

  // Backend o'chiq bo'lsa yoki so'rov xato bersa — sitemap butunlay
  // qulab tushmasligi kerak. Bunday holatda hech bo'lmasa statik
  // sahifalar ro'yxati qaytadi (bo'sh 500 xatolik o'rniga).
  let productEntries: MetadataRoute.Sitemap = [];
  let categoryEntries: MetadataRoute.Sitemap = [];

  try {
    const products = await fetchAllProducts();
    productEntries = products.flatMap((p) =>
      entriesForPath(`/product/${p.slug}`, {
        lastModified: p.createdAt ? new Date(p.createdAt) : undefined,
        changeFrequency: 'weekly',
        priority: 0.8,
      }),
    );
  } catch {
    // jim o'tkazib yuboriladi — pastdagi return baribir ishlaydi
  }

  try {
    const data = await serverFetchGraphQL<{ categories: { slug: string }[] }>(CATEGORIES_FOR_SITEMAP, undefined, 3600);
    // Toifa sahifasi alohida marshrut emas — do'kon sahifasining
    // filtrlangan ko'rinishi (/shop?category=...). Shuning uchun xaritaga
    // aynan shu manzil qo'shiladi.
    categoryEntries = (data.categories ?? []).flatMap((c) =>
      entriesForPath(`/shop?category=${encodeURIComponent(c.slug)}`, {
        changeFrequency: 'weekly',
        priority: 0.6,
      }),
    );
  } catch {
    // jim o'tkazib yuboriladi
  }

  return [...staticEntries, ...productEntries, ...categoryEntries];
}

// Xarita har soatda bir marta qayta hisoblanadi — yangi mahsulotlar tez
// tushadi, lekin har bir so'rovda backendga murojaat qilinavermaydi.
export const revalidate = 3600;
