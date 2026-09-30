import type { Metadata } from 'next';
import { getDictionary } from '@/i18n/get-dictionary';
import type { Locale } from '@/i18n/config';
import { pageSeo } from '@/lib/seo/site';
import { serverFetchGraphQL } from '@/lib/graphql/server-fetch';
import { GET_PRODUCTS_STR, GET_CATEGORIES_STR, GET_GENDERS_STR, GET_PRODUCT_COLORS_STR } from '@/lib/graphql/server-queries';
import { ProductCard, type ProductCardData } from '@/components/ui/ProductCard';
import { ShopFilters } from '@/components/shop/ShopFilters';
import { SortDropdown } from '@/components/shop/SortDropdown';
import { Pagination } from '@/components/ui/Pagination';
import { Reveal } from '@/components/ui/Reveal';

interface ShopPageProps {
  params: { locale: Locale };
  searchParams: Record<string, string | undefined>;
}

const LIMIT = 30;

// Do'kon sahifasi. MUHIM nuqta: canonical HAR DOIM filtrsiz "/shop" ga
// ishora qiladi. Sababi — /shop?category=x&sizes=M&page=3 kabi filtr
// kombinatsiyalari cheksiz ko'p va ularning har biri Google uchun alohida
// (deyarli bir xil mazmunli) sahifa bo'lib ko'rinadi. Bu "duplicate
// content" deb baholanib, saytning umumiy reytingini pasaytiradi. Barchasi
// bitta asosiy manzilga yig'ilsa, Google aynan o'shani indekslaydi.
export async function generateMetadata({ params }: ShopPageProps): Promise<Metadata> {
  const dict = await getDictionary(params.locale);
  return pageSeo({
    locale: params.locale,
    path: '/shop',
    title: dict.nav.shop,
    description: dict.home.heroSubtitle,
  });
}

export default async function ShopPage({ params, searchParams }: ShopPageProps) {
  const { locale } = params;
  const dict = await getDictionary(locale);

  const page = Number(searchParams.page ?? '1') || 1;
  const filter = {
    search: searchParams.search || undefined,
    // `?products=id1,id2` — bannerga bir nechta tovar biriktirilganda
    // (BannerCarousel) shu manzil ochiladi va sahifa faqat o'sha
    // tovarlarni ko'rsatadi. Qolgan filtrlar avvalgidek ishlayveradi.
    ids: searchParams.products ? searchParams.products.split(',').filter(Boolean) : undefined,
    categorySlug: searchParams.category || undefined,
    sizes: searchParams.sizes ? searchParams.sizes.split(',') : undefined,
    colors: searchParams.colors ? searchParams.colors.split(',') : undefined,
    minPrice: searchParams.minPrice ? Number(searchParams.minPrice) : undefined,
    maxPrice: searchParams.maxPrice ? Number(searchParams.maxPrice) : undefined,
    genderSlug: searchParams.gender || undefined,
    // Do'konda sukut bo'yicha ARALASH (tasodifiy) tartib — xaridor har
    // safar bir xil ro'yxatni emas, turli tovarlarni ko'radi. Xaridor
    // saralashni o'zgartirsa (`?sort=`) o'sha tanlov ustun turadi.
    // Sahifalash buzilmaydi: backend aralashtirishni soatlik "urug'"dan
    // hisoblaydi, ya'ni 2-sahifada ro'yxat qaytadan aralashib ketmaydi
    // (product.service.ts, seededRandom izohiga qarang).
    sort: searchParams.sort || 'RANDOM',
    page,
    limit: LIMIT,
  };

  const [productsData, categoriesData, gendersData, colorsData] = await Promise.all([
    serverFetchGraphQL<{ products: { list: ProductCardData[]; total: number } }>(
      GET_PRODUCTS_STR,
      { filter },
      0,
    ).catch(() => ({ products: { list: [], total: 0 } })),
    serverFetchGraphQL<{ categories: any[] }>(GET_CATEGORIES_STR, undefined, 0).catch(() => ({ categories: [] })),
    serverFetchGraphQL<{ genders: any[] }>(GET_GENDERS_STR, undefined, 0).catch(() => ({ genders: [] })),
    // Filtrdagi rang doirachalari — tayyor ro'yxatdan emas, tovarlarda
    // haqiqatda ishlatilgan ranglardan. So'rov yiqilsa filtr shunchaki
    // ranglarsiz ko'rsatiladi, sahifa esa ochilaveradi.
    serverFetchGraphQL<{ productColors: string[] }>(GET_PRODUCT_COLORS_STR, undefined, 0).catch(() => ({
      productColors: [],
    })),
  ]);

  const products = productsData.products.list ?? [];
  const total = productsData.products.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div className="container-app py-12">
      <Reveal>
        <h1 className="section-title">{dict.nav.shop}</h1>
      </Reveal>

      <div className="mt-8 flex flex-col gap-10 lg:flex-row">
        <ShopFilters
          dict={dict}
          categories={categoriesData.categories ?? []}
          genders={gendersData.genders ?? []}
          colors={colorsData.productColors ?? []}
          locale={locale}
        />

        <div className="flex-1">
          <div className="mb-6 flex items-center justify-between">
            <p className="text-sm text-ink-900/50">
              {total} {locale === 'ru' ? 'товаров' : 'ta mahsulot'}
            </p>
            <SortDropdown dict={dict} />
          </div>

          {products.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-ink-900/15 py-24 text-center">
              <p className="text-sm text-ink-900/50">{dict.product.noResults}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 xl:grid-cols-4">
              {products.map((product, i) => (
                <Reveal key={product.id} delay={Math.min(i * 0.04, 0.3)}>
                  <ProductCard product={product} locale={locale} dict={dict} />
                </Reveal>
              ))}
            </div>
          )}

          <Pagination page={page} totalPages={totalPages} />
        </div>
      </div>
    </div>
  );
}
