import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight, Truck, ShieldCheck, CheckCircle2, CreditCard } from 'lucide-react';
import { getDictionary } from '@/i18n/get-dictionary';
import type { Locale } from '@/i18n/config';
import { pageSeo, SITE_NAME, SITE_DESCRIPTION } from '@/lib/seo/site';
import { serverFetchGraphQL } from '@/lib/graphql/server-fetch';
import { GET_BEST_SELLERS_STR, GET_CATEGORIES_STR, GET_BANNERS_STR } from '@/lib/graphql/server-queries';
import { ProductCard, type ProductCardData } from '@/components/ui/ProductCard';
import { Reveal } from '@/components/ui/Reveal';
import { CategoryCarousel } from '@/components/ui/CategoryCarousel';
import { BannerCarousel, type BannerItem } from '@/components/home/BannerCarousel';

type HomeCategory = {
  id: string;
  name: string;
  nameRu?: string | null;
  slug: string;
  description?: string | null;
};

// Each "why us" card gets its own icon + accent color (matching the four
// items in the dictionary, in order: originals / delivery / trust /
// payment) — a soft tinted square in light mode, the same hue at low
// opacity on a dark card in dark mode, so the row reads as four distinct
// colors instead of one repeated brand tone.
// Ikonka fonlari avval to'rt xil rangda edi (yashil/ko'k/binafsha/sariq)
// — yangi uslub talabi bo'yicha barchasi bitta aksent rangda, ya'ni
// qator yaxlit ko'rinadi. Ikonkalarning o'zi, o'lchami va tartibi
// o'zgarmadi.
const WHY_ITEMS = [
  { icon: CheckCircle2, ring: 'bg-gold-500/10 text-gold-600 dark:bg-gold-500/15 dark:text-gold-400' },
  { icon: Truck, ring: 'bg-gold-500/10 text-gold-600 dark:bg-gold-500/15 dark:text-gold-400' },
  { icon: ShieldCheck, ring: 'bg-gold-500/10 text-gold-600 dark:bg-gold-500/15 dark:text-gold-400' },
  { icon: CreditCard, ring: 'bg-gold-500/10 text-gold-600 dark:bg-gold-500/15 dark:text-gold-400' },
];

// Bosh sahifa uchun canonical (https://wardrobestore.uz/uz) + hreflang
// (uz/ru/x-default) + Open Graph. Avval bularning birortasi ham yo'q edi:
// Google uchun /uz va /ru ikki alohida, bir-biriga aloqasiz sahifa
// ko'rinardi va qaysi biri asosiy ekani noaniq edi.
// DIQQAT: sahifaning o'z metadata'si layout'dagisini BEKOR QILADI. Ya'ni
// bosh sahifaning sarlavhasi va tavsifi aynan shu yerdan olinadi,
// layout.tsx dagi `title.default` dan emas. Shuning uchun brend nomi
// ("Wardrobe Store") va qidiruv tavsifi bu yerda ham bir xil manbadan
// (lib/seo/site.ts) o'qiladi — avval bu yerda "Wardrobe" qo'lda yozilgan
// edi va layout yangilangach ham bosh sahifa eski sarlavhani ko'rsatib
// turavergan edi.
export async function generateMetadata({ params }: { params: { locale: Locale } }): Promise<Metadata> {
  const dict = await getDictionary(params.locale);
  return pageSeo({
    locale: params.locale,
    path: '',
    title: `${SITE_NAME} — ${dict.home.heroTitle}`,
    description: SITE_DESCRIPTION[params.locale] ?? SITE_DESCRIPTION.uz,
  });
}

export default async function HomePage({ params }: { params: { locale: Locale } }) {
  // The temporary `?stage=N` diagnostic scaffolding (used to binary-isolate
  // the ~30s iOS Safari stall down to Header's backdrop-blur + Hero's glow
  // blobs — see Header.tsx for the full finding) has done its job and is
  // removed now that the fix (no more blur/backdrop-blur anywhere on the
  // site) is in place. This is back to a plain Home page again.
  const { locale } = params;
  const dict = await getDictionary(locale);

  // Categories section is back on the home page (previously removed) — this
  // time as the BANNER section's content, replacing the old static
  // image+text pair with an auto-scrolling carousel of category cards. The
  // GET_SITE_SETTINGS_STR/heroImage fetch that only fed that static image is
  // gone since nothing renders it anymore; GET_CATEGORIES_STR (the same
  // query the /categories page already uses) takes its place.
  // ROOT-CAUSE FIX: `serverFetchGraphQL`'s 3rd arg is Next.js's Data Cache
  // `revalidate` window (in seconds) for that ONE fetch call — it's not
  // route-wide, each `fetch()` on the page has its own independent cache
  // entry. This bestSellers call used to omit it, falling back to
  // `serverFetchGraphQL`'s own default of 60s (see server-fetch.ts) — so
  // after an admin added/edited/deleted a product, Home kept serving a
  // cached response for up to 60 seconds (even across a manual browser
  // refresh, since the stale copy lives in the Next.js SERVER's cache, not
  // the browser's), while /shop's identical-shaped fetch already used
  // `revalidate: 0` (see shop/page.tsx) and updated immediately — exactly
  // the "shop is fresh, home is stale until I wait/refresh" symptom
  // reported. Categories right below already used 0 for the same reason
  // (see its own comment). Bringing bestSellers in line with both.
  //
  // Bosh sahifada MASHHUR tovarlar — eng ko'p sotilganlar (`bestSellers`,
  // backendda soldCount bo'yicha). Bir muddat bu yerda tasodifiy tartib
  // ishlatilgan edi; so'rovga ko'ra tasodifiy tartib endi faqat DO'KON
  // (/shop) sahifasida qoldi, bosh sahifa esa haqiqiy mashhurlarni
  // ko'rsatadi.
  // `revalidate: 0` — admin tovar qo'shsa/o'zgartirsa bosh sahifa darhol
  // yangilanishi uchun (aks holda keshlangan javob bir muddat eski
  // ro'yxatni ko'rsatib turardi).
  const [bestSellersData, categoriesData, bannersData] = await Promise.all([
    serverFetchGraphQL<{ bestSellers: ProductCardData[] }>(GET_BEST_SELLERS_STR, { limit: 10 }, 0).catch(() => ({
      bestSellers: [],
    })),
    // revalidate: 0 — a newly added/renamed category should show up in the
    // carousel on the next request, not wait out a stale cached page.
    serverFetchGraphQL<{ categories: HomeCategory[] }>(GET_CATEGORIES_STR, undefined, 0).catch(() => ({
      categories: [],
    })),
    // Reklama bannerlari — admin panelning "Reklamalar" bo'limidan
    // boshqariladi, hech narsa hardcode qilinmagan. Backend ishlamay
    // qolsa ham bosh sahifa ochilaveradi (catch -> bo'sh ro'yxat), shunchaki
    // karusel ko'rinmaydi.
    serverFetchGraphQL<{ banners: BannerItem[] }>(GET_BANNERS_STR, undefined, 0).catch(() => ({
      banners: [],
    })),
  ]);

  const bestSellers = bestSellersData.bestSellers ?? [];
  const categories = categoriesData.categories ?? [];
  const banners = bannersData.banners ?? [];

  // Bosh sahifadagi katta "Zamonaviy uslub, premium sifat" bloki (hero)
  // butunlay olib tashlandi — endi sahifa to'g'ridan-to'g'ri reklama
  // banneri bilan boshlanadi. Shu sababli sarlavhani ranglangan so'z
  // bo'yicha bo'lib chiqadigan yordamchi o'zgaruvchilar ham keraksiz.
  // `dict.home.heroTitle` faqat generateMetadata'da (sahifa <title>si va
  // Google uchun tavsif) qolgan — u ko'rinadigan matn emas.

  return (
    <div>
      {/* REKLAMA BANNERLARI — mobil ko'rinishda qidiruv qatoridan keyin
          keladigan birinchi blok (qidiruv qatori layout.tsx da, <main>
          boshida turadi). Banner qo'shilmagan bo'lsa bu bo'lim umuman
          chizilmaydi. */}
      <BannerCarousel banners={banners} locale={locale} />

      {/* BEST SELLERS — shown before the category grid, per request: product
          cards should be the first thing shoppers see below the fold, with
          "shop by category" browsing further down as a secondary option. */}
      <section className="bg-white py-20 dark:bg-ink-950">
        <div className="container-app">
          <div className="flex items-end justify-between">
            <Reveal>
              <h2 className="section-title">{dict.home.bestSellers}</h2>
            </Reveal>
            {/* Site's green accent instead of plain gray, with a hover
                effect: the text deepens and the arrow nudges right —
                per request. */}
            <Link
              href={`/${locale}/shop`}
              className="group hidden items-center gap-1 text-sm font-semibold text-gold-600 transition-colors duration-300 hover:text-gold-700 dark:text-gold-400 dark:hover:text-gold-300 sm:flex"
            >
              {dict.home.shopNow}
              <ArrowRight size={14} className="transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          </div>

          {bestSellers.length === 0 ? (
            <p className="mt-10 text-sm text-ink-900/50">{dict.product.noResults}</p>
          ) : (
            <div className="mt-10 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
              {bestSellers.map((product, i) => (
                <Reveal key={product.id} delay={i * 0.05}>
                  <ProductCard product={product} locale={locale} dict={dict} />
                </Reveal>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* BANNER */}
      <section className="relative overflow-hidden bg-white py-20 dark:bg-ink-950">
        {/* Same soft blurred-glow treatment as the hero up top. Per latest
            request the section's own base fill is pulled close to
            white/black (matching the hero's bg-white/dark:bg-ink-950) so the
            glow blobs read as the dominant color signal — blobs are bigger,
            more opaque, and more blurred than the earlier passes. */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: 'linear-gradient(135deg, rgba(70,95,255,0.04) 0%, rgba(70,95,255,0.02) 100%)',
          }}
        />
        {/* ROOT-CAUSE FIX — the 3 glow-orb divs (blur-[140-170px]) that used
            to sit here are removed entirely, same reasoning as the Hero
            section above: no more backdrop-blur anywhere on the page means
            nothing needs a heavily blurred backdrop to show through, and
            these were themselves an expensive `filter: blur()` cost on
            every paint. */}
        <div className="container-app relative">
          <div className="flex items-end justify-between">
            <Reveal>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gold-600">{dict.home.newArrivals}</p>
              <h2 className="mt-4 font-display text-3xl font-medium sm:text-4xl dark:text-cream">{dict.nav.categories}</h2>
            </Reveal>
            <Link
              href={`/${locale}/categories`}
              className="group hidden items-center gap-1 text-sm font-semibold text-gold-600 transition-colors duration-300 hover:text-gold-700 dark:text-gold-400 dark:hover:text-gold-300 sm:flex"
            >
              {dict.home.exploreCategories}
              <ArrowRight size={14} className="transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          </div>
        </div>

        {/* Category showcase — per follow-up request this is no longer a
            row of separate cards scrolling past each other; it's ONE big
            box, and the categories rotate (crossfade) inside that single
            box instead. See CategoryCarousel.tsx for the rotation itself
            (timer-driven, since the category count is dynamic). */}
        <div className="container-app relative mt-10">
          {categories.length === 0 ? (
            <p className="text-sm text-ink-900/50 dark:text-cream/50">{dict.product.noResults}</p>
          ) : (
            <Reveal delay={0.15}>
              <CategoryCarousel categories={categories} locale={locale} />
            </Reveal>
          )}
        </div>
      </section>

      {/* WHY US — "Original mahsulotlar / Tezkor yetkazib berish /
          Ishonchli xarid / Xavfsiz to'lov" kartalari.
          Avval sahifaning eng tepasida, hero ostida turardi; so'rovga
          ko'ra endi eng pastga, KATEGORIYALARDAN KEYIN tushirildi —
          xaridor avval tovar va kategoriyalarni ko'radi, do'kon haqidagi
          ishonch beruvchi yozuvlar esa pastda qoladi.
          `border-b` `border-t` ga almashtirildi: bo'lim endi oxirgi
          bo'lgani uchun chegara ustidan kerak, ostidan emas (pastda
          darhol Footer boshlanadi). Gradient ham teskari yo'nalishga
          (to-b -> to-t) o'girildi, shunda och yashil tus yuqoridagi oq
          fon bilan emas, pastdagi Footer bilan tutashadi. */}
      <section className="relative overflow-hidden border-t border-ink-900/8 bg-white py-16 dark:border-cream/10 dark:bg-ink-950">
        <div className="container-app grid grid-cols-2 gap-5 lg:grid-cols-4">
          {dict.home.whyUsItems.map((item, i) => {
            const { icon: Icon, ring } = WHY_ITEMS[i % WHY_ITEMS.length];
            return (
              <Reveal key={item.title} delay={i * 0.08}>
                <div className="flex h-full flex-col items-start gap-4 rounded-2xl border border-ink-900/8 bg-white p-6 transition-transform hover:-translate-y-1 dark:border-cream/10 dark:bg-ink-900/60">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${ring}`}>
                    <Icon size={22} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-ink-950 dark:text-cream">{item.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-ink-900/55 dark:text-cream/55">{item.desc}</p>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </section>
    </div>
  );
}
