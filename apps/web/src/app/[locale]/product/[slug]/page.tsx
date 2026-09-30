import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getDictionary } from '@/i18n/get-dictionary';
import type { Locale } from '@/i18n/config';
import { serverFetchGraphQL } from '@/lib/graphql/server-fetch';
import { GET_PRODUCT_STR, GET_PRODUCTS_STR } from '@/lib/graphql/server-queries';
import { ProductGalleryForColor } from '@/components/product/ProductGalleryForColor';
import { ProductActions } from '@/components/product/ProductActions';
import { ProductColorProvider } from '@/lib/store/product-color-context';
import { ProductReviews } from '@/components/product/ProductReviews';
import { ProductCard, type ProductCardData } from '@/components/ui/ProductCard';
import { Reveal } from '@/components/ui/Reveal';
import { formatPrice } from '@/lib/utils/format';
import { hasVariantPricing, resolveMinPrice } from '@/lib/utils/variantPrice';
import { pageSeo, canonicalUrl, SITE_URL, SITE_NAME } from '@/lib/seo/site';

interface ProductPageProps {
  params: { locale: Locale; slug: string };
}

async function fetchProduct(slug: string) {
  try {
    const data = await serverFetchGraphQL<{ product: any }>(GET_PRODUCT_STR, { slug }, 0);
    return data.product;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const product = await fetchProduct(params.slug);
  // Mahsulot topilmasa — sahifa 404 qaytaradi (pastdagi notFound()), shu
  // sababli qidiruv tizimlariga bu manzilni indekslamaslik aniq aytiladi.
  if (!product) return { robots: { index: false, follow: false } };

  const title = params.locale === 'ru' && product.titleRu ? product.titleRu : product.title;
  const rawDescription = params.locale === 'ru' && product.descriptionRu ? product.descriptionRu : product.description;
  // Tavsif bo'sh bo'lsa ham, qidiruv natijasida bo'sh qator turmasligi
  // uchun mahsulot nomi va toifasidan qisqa matn yig'iladi.
  const categoryName = product.category
    ? params.locale === 'ru' && product.category.nameRu
      ? product.category.nameRu
      : product.category.name
    : '';
  const description = (rawDescription || `${title}${categoryName ? ` — ${categoryName}` : ''}. Wardrobe.`).slice(0, 160);

  return pageSeo({
    locale: params.locale,
    path: `/product/${params.slug}`,
    title,
    description,
    images: product.images?.length ? product.images.slice(0, 3) : undefined,
    // Mahsulot kartochkasi uchun og:type = "website" emas, balki mazmunli
    // sahifa sifatida beriladi.
    ogType: 'article',
  });
}

export default async function ProductDetailPage({ params }: ProductPageProps) {
  const { locale, slug } = params;
  const dict = await getDictionary(locale);
  const product = await fetchProduct(slug);

  if (!product) notFound();

  const similarData = await serverFetchGraphQL<{ products: { list: ProductCardData[] } }>(
    GET_PRODUCTS_STR,
    { filter: { categorySlug: product.category?.slug, page: 1, limit: 4, sort: 'NEWEST' } },
    30,
  ).catch(() => ({ products: { list: [] } }));

  const similar = (similarData.products.list ?? []).filter((p) => p.id !== product.id);

  const title = locale === 'ru' && product.titleRu ? product.titleRu : product.title;
  const description = locale === 'ru' && product.descriptionRu ? product.descriptionRu : product.description;
  const hasDiscount = product.oldPrice && product.oldPrice > product.price;
  // Duxi kabi, narxi hajmga qarab o'zgaradigan mahsulotlar uchun.
  const variantPricing = hasVariantPricing(product);
  const minPrice = resolveMinPrice(product);

  // Total stock across every size/color combination, not just the overall
  // `stock` field (which some products don't keep in sync with their real
  // variant rows). Falls back to `stock` for older/simple products that
  // have no variant data at all.
  const productVariants: { size: string; color: string; stock: number }[] = product.variants ?? [];
  const totalStock =
    productVariants.length > 0
      ? productVariants.reduce((sum: number, v: { stock: number }) => sum + (v.stock ?? 0), 0)
      : product.stock;

  // ── Structured data (JSON-LD) ──────────────────────────────────────
  // Product schema — Google qidiruv natijasida narx, mavjudlik va reyting
  // yulduzchalarini ko'rsatishi mumkin ("rich result"). Bularsiz mahsulot
  // oddiy ko'k havola bo'lib chiqadi. Narx va mavjudlik REAL ma'lumotdan
  // olinadi, hardcode qilinmagan.
  const productUrl = canonicalUrl(locale, `/product/${slug}`);
  const absoluteImages = (product.images ?? []).map((src: string) =>
    src.startsWith('http') ? src : `${SITE_URL}${src.startsWith('/') ? '' : '/'}${src}`,
  );

  const productJsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: title,
    description: description || title,
    image: absoluteImages.length > 0 ? absoluteImages : [`${SITE_URL}/logo.svg`],
    sku: product.sku,
    url: productUrl,
    ...(product.brand ? { brand: { '@type': 'Brand', name: product.brand.name } } : {}),
    ...(product.category
      ? { category: locale === 'ru' && product.category.nameRu ? product.category.nameRu : product.category.name }
      : {}),
    offers: {
      '@type': 'Offer',
      url: productUrl,
      // Valyuta kodi ISO 4217 bo'yicha — O'zbekiston so'mi.
      priceCurrency: 'UZS',
      // Narxi hajmga qarab o'zgaradigan mahsulotda Google'ga ENG ARZON
      // variant narxi beriladi — sahifada ko'rinayotgan "... dan" narxi
      // bilan bir xil bo'lishi uchun (ular farq qilsa, Google
      // strukturali ma'lumotni "sahifaga mos emas" deb belgilaydi).
      price: variantPricing ? minPrice : product.price,
      availability: totalStock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
      seller: { '@type': 'Organization', name: SITE_NAME },
    },
  };

  // aggregateRating faqat HAQIQIY sharh bo'lganda qo'shiladi. Sharhsiz
  // mahsulotga reyting yozib qo'yish Google qoidalarini buzadi va butun
  // sayt bo'yicha rich result'dan chetlatilishga olib kelishi mumkin.
  if (product.reviewsCount > 0 && product.rating > 0) {
    productJsonLd.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: product.rating,
      reviewCount: product.reviewsCount,
    };
  }

  // BreadcrumbList — natijada "Wardrobe › Do'kon › Krossovka" ko'rinishidagi
  // yo'lni chiqaradi.
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: SITE_NAME, item: canonicalUrl(locale, '') },
      { '@type': 'ListItem', position: 2, name: dict.nav.shop, item: canonicalUrl(locale, '/shop') },
      { '@type': 'ListItem', position: 3, name: title, item: productUrl },
    ],
  };

  return (
    <div className="container-app py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {/* ProductColorProvider shares the selected color between the two
          sibling client components below — ProductActions (the size/color
          picker) writes to it, ProductGalleryForColor reads it to show that
          color's dedicated photos, per the "picking blue should show the
          blue shirt's photos" request. Initial color mirrors ProductActions'
          own first-available-color logic loosely (just colors[0] here); if
          that color turns out to be out of stock for the default size,
          ProductActions corrects it on mount and the gallery updates then. */}
      <ProductColorProvider initialColor={product.colors?.[0] ?? ''}>
      <div className="grid gap-12 lg:grid-cols-2">
        <Reveal>
          <ProductGalleryForColor
            images={product.images ?? []}
            colorImages={product.colorImages ?? []}
            title={title}
          />
        </Reveal>

        <Reveal delay={0.1}>
          <div>
            {product.category && (
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-900/40">
                {locale === 'ru' && product.category.nameRu ? product.category.nameRu : product.category.name}
                {product.brand ? ` · ${product.brand.name}` : ''}
              </p>
            )}
            <h1 className="mt-2 font-display text-3xl font-medium sm:text-4xl">{title}</h1>

            {/* Narxi hajmga bog'liq mahsulotlarda (duxi) bu yerda eng
                arzon hajm narxi "dan" izohi bilan ko'rsatiladi — aniq
                narx esa xaridor hajmni tanlagach, tanlov tugmalari
                ostida chiqadi (ProductActions). Oddiy mahsulotlarda
                hammasi avvalgidek: bitta narx, hech qanday qo'shimcha
                yozuvsiz. */}
            <div className="mt-4 flex items-baseline gap-3">
              <span className="text-2xl font-bold">
                {formatPrice(variantPricing ? minPrice : product.price, locale)}
              </span>
              {variantPricing && (
                <span className="text-sm font-medium text-ink-900/50 dark:text-cream/50">
                  {locale === 'ru' ? 'от' : 'dan'}
                </span>
              )}
              {hasDiscount && (
                <span className="text-base text-ink-900/40 line-through">{formatPrice(product.oldPrice, locale)}</span>
              )}
              {hasDiscount && (
                <span className="rounded-full bg-gold-500/15 px-2.5 py-1 text-xs font-bold text-gold-600">
                  -{Math.round(100 - (product.price / product.oldPrice) * 100)}%
                </span>
              )}
            </div>

            <p className="mt-2 text-xs text-ink-900/50 dark:text-cream/50">
              {totalStock > 0 ? (
                <>
                  {dict.product.totalInStock}
                  {' '}
                  {totalStock} {dict.product.stockLeft}
                  {/* Neutral black/white instead of red per request — the
                      color no longer carries the "urgent" signal here,
                      that now lives in the amber per-variant message below
                      the size/color pickers. */}
                  {totalStock <= 5 && (
                    <span className="ml-1.5 font-bold text-ink-950 dark:text-cream">{dict.product.lastPieces}</span>
                  )}
                </>
              ) : (
                dict.product.outOfStock
              )}
              {' · '}
              {product.reviewsCount} {dict.product.reviews}
            </p>

            <div className="mt-8 border-t border-ink-900/10 pt-8">
              <ProductActions
                productId={product.id}
                title={title}
                price={product.price}
                sizes={product.sizes ?? []}
                colors={product.colors ?? []}
                stock={product.stock}
                variants={product.variants ?? []}
                dict={dict}
                locale={locale}
              />
            </div>

            {/* Tavsif — o'lcham va rang tanlovidan KEYIN. Avval u
                yuqorida, narx bilan tanlov tugmalari orasida turardi:
                uzun tavsifda xaridor asosiy amalni (o'lcham/rang tanlab
                savatga qo'shish) ko'rish uchun pastga surishga majbur
                bo'lardi. */}
            {description && (
              <div className="mt-8 border-t border-ink-900/10 pt-8">
                {/* `whitespace-pre-line` — admin yozgan matndagi qator
                    tashlashlar (Enter) va bo'sh qatorlar aynan
                    saqlanadi. Busiz HTML barcha qator tashlashni oddiy
                    bo'shliqqa aylantirib, butun tavsifni bitta uzun
                    xatboshi qilib ko'rsatardi — ro'yxatlar ham bir
                    qatorga yopishib qolardi. Ortiqcha bo'shliqlar esa
                    avvalgidek yig'iladi, ya'ni tasodifan qo'sh probel
                    qo'yilsa matn buzilmaydi. */}
                <p className="whitespace-pre-line text-sm leading-relaxed text-ink-900/70 dark:text-cream/70">
                  {description}
                </p>
              </div>
            )}

            <div className="mt-8 grid grid-cols-2 gap-4 border-t border-ink-900/10 pt-8 text-sm">
              <div>
                <p className="text-xs text-ink-900/40">{dict.product.sku}</p>
                <p className="font-semibold">{product.sku}</p>
              </div>
              {product.brand && (
                <div>
                  <p className="text-xs text-ink-900/40">{dict.product.brand}</p>
                  <p className="font-semibold">{product.brand.name}</p>
                </div>
              )}
            </div>
          </div>
        </Reveal>
      </div>
      </ProductColorProvider>

      <ProductReviews productId={product.id} locale={locale} dict={dict} />

      {similar.length > 0 && (
        <section className="mt-24">
          <Reveal>
            <h2 className="section-title">{dict.product.similar}</h2>
          </Reveal>
          <div className="mt-8 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
            {similar.map((p, i) => (
              <Reveal key={p.id} delay={i * 0.06}>
                <ProductCard product={p} locale={locale} dict={dict} />
              </Reveal>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
