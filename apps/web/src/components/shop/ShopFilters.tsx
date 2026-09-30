'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { translateColorName } from '@/lib/utils/colorNames';
import { swatchColor } from '@/lib/utils/colorSwatch';
import { useNavLoadingStore } from '@/lib/store/shop-loading-store';
// Toifaga qarab o'lcham ro'yxati — admin panelning mahsulot formasi
// (components/admin/ProductForm.tsx) bilan BITTA umumiy manbadan o'qiladi
// (lib/utils/categorySizes.ts). Avval shu faylda alohida nusxasi bor edi
// va u admindagisidan orqada qolib ketgan edi: adminda "o'lchamsiz"
// toifalar (aksessuar/kosmetika) hisobga olingan, bu yerda esa yo'q —
// natijada "Aksessuarlar" tanlansa ham XS-XXL chiqib turardi.
import { getSizeOptions } from '@/lib/utils/categorySizes';
import type { Dictionary } from '@/i18n/get-dictionary';

interface ShopFiltersProps {
  dict: Dictionary;
  categories: { slug: string; name: string; nameRu?: string }[];
  // Brend kabi — admin panelda o'zi yaratgan ro'yxat (masalan "Erkaklar",
  // "Ayollar"), Category kabi ixtiyoriy ruscha nom bilan.
  genders: { slug: string; name: string; nameRu?: string }[];
  // FAQAT tovarlarda haqiqatda ishlatilgan ranglar (do'kon sahifasi
  // backenddan olib beradi — `productColors`). Avval bu yerda tayyor
  // ro'yxatning HAMMASI (30 ta rang) ko'rsatilardi va ularning
  // ko'pchiligini bosganda hech qanday tovar chiqmasdi.
  colors: string[];
  locale: 'uz' | 'ru';
}

export function ShopFilters({ dict, categories, genders, colors, locale }: ShopFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [minPrice, setMinPrice] = useState(searchParams.get('minPrice') ?? '');
  const [maxPrice, setMaxPrice] = useState(searchParams.get('maxPrice') ?? '');
  // Mobile-only accordion state: on phones the filter panel used to render
  // fully expanded and pushed the product grid way down below the fold.
  // Collapsed by default on mobile; the `lg:block` override below keeps it
  // always-open on desktop regardless of this flag.
  const [expanded, setExpanded] = useState(false);

  const activeCategory = searchParams.get('category');
  const activeGender = searchParams.get('gender');
  const activeSizes = searchParams.get('sizes')?.split(',').filter(Boolean) ?? [];
  const activeColors = searchParams.get('colors')?.split(',').filter(Boolean) ?? [];
  const activeCategoryObj = categories.find((c) => c.slug === activeCategory);
  // Poyabzal toifasi → 36-45; aksessuar/kosmetika kabi o'lchamsiz toifa →
  // bo'sh ro'yxat (pastda o'lcham bo'limi umuman chizilmaydi); qolganlari
  // va "Barchasi" → kiyim o'lchamlari.
  const SIZES = getSizeOptions(activeCategoryObj);

  function updateParams(mutator: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    mutator(params);
    params.set('page', '1');
    // Filter clicks change the URL via router.push() directly (no <a> tag
    // involved), so RouteProgressBar's own click-capture listener never
    // sees them — signal the loading store ourselves so the skeleton
    // overlay still takes over immediately instead of the old grid just
    // sitting there until the new one lands.
    useNavLoadingStore.getState().start('shop');
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  // Toifa almashtirilganda tanlangan o'lchamlar HAR DOIM tozalanadi.
  // Sababi: "M" tanlab turib "Krossovkalar"ga o'tilsa, URL'da sizes=M
  // qolib ketardi — backend esa o'lchami "M" bo'lgan krossovkani
  // topolmay, ro'yxat butunlay bo'sh chiqardi. Eng yomoni, "M" tugmasi
  // endi chizilmaydi (ro'yxat 36-45 ga almashgan), shuning uchun
  // xaridorda uni bekor qilishning IMKONI ham qolmasdi — "hech narsa
  // topilmadi" degan boshi berk ko'chaga tushib qolardi. Aksessuar kabi
  // o'lchamsiz toifalarda ham xuddi shu holat.
  function selectCategory(slug: string | null) {
    updateParams((p) => {
      if (slug) p.set('category', slug);
      else p.delete('category');
      p.delete('sizes');
    });
  }

  function toggleListParam(key: string, value: string, currentList: string[]) {
    updateParams((params) => {
      const next = currentList.includes(value) ? currentList.filter((v) => v !== value) : [...currentList, value];
      if (next.length) params.set(key, next.join(','));
      else params.delete(key);
    });
  }

  return (
    <aside className="w-full shrink-0 lg:w-64 lg:space-y-8">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex flex-1 items-center gap-2 py-1 text-left lg:pointer-events-none lg:flex-none"
        >
          <h3 className="text-sm font-bold uppercase tracking-wider text-ink-950 dark:text-cream">{dict.product.filters}</h3>
          <ChevronDown size={18} className={`text-ink-900/50 transition-transform dark:text-cream/50 lg:hidden ${expanded ? 'rotate-180' : ''}`} />
        </button>
        <button
          onClick={() => router.push(pathname)}
          className="text-xs font-semibold text-ink-900/50 transition-colors hover:text-red-500 dark:text-cream/50 dark:hover:text-red-400"
        >
          {dict.product.clearFilters}
        </button>
      </div>

      <div className={`${expanded ? 'mt-6 block' : 'hidden'} space-y-8 lg:mt-0 lg:block`}>
      {/* Filtrlar ichidagi qidiruv maydoni OLIB TASHLANDI — qidiruv
          saytning yuqorisida, headerda (va telefonda uning ostidagi
          qatorda) turadi, ikkita qidiruv bir sahifada chalkashtirardi.
          Manzildagi `?search=...` parametri esa avvalgidek ishlayveradi:
          headerdan qidirilganda do'kon sahifasi uni o'qiydi. */}

      {/* Kategoriya bo'limi bilan bir xil naqsh: ro'yxat to'liq admin
          tomonidan yaratiladi (Brend kabi — admin/categories sahifasi),
          shuning uchun MALE/FEMALE kabi qattiq belgilangan qiymatlar yo'q.
          Admin hali birorta ham yozuv qo'shmagan bo'lsa, bo'lim umuman
          ko'rinmaydi. */}
      {genders.length > 0 && (
        <div>
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-900/50 dark:text-cream/50">{dict.product.gender}</h4>
          <div className="flex flex-col gap-1">
            <button
              onClick={() => updateParams((p) => p.delete('gender'))}
              className={`rounded-lg border-l-2 px-3 py-2 text-left text-sm transition-colors ${
                !activeGender
                  ? 'border-gold-500 bg-gold-500/10 font-bold text-gold-600 dark:text-gold-400'
                  : 'border-transparent text-ink-900/60 hover:bg-ink-900/5 hover:text-ink-950 dark:text-cream/60 dark:hover:bg-cream/5 dark:hover:text-cream'
              }`}
            >
              {dict.product.genderAll}
            </button>
            {genders.map((g) => (
              <button
                key={g.slug}
                onClick={() => updateParams((p) => p.set('gender', g.slug))}
                className={`rounded-lg border-l-2 px-3 py-2 text-left text-sm transition-colors ${
                  activeGender === g.slug
                    ? 'border-gold-500 bg-gold-500/10 font-bold text-gold-600 dark:text-gold-400'
                    : 'border-transparent text-ink-900/60 hover:bg-ink-900/5 hover:text-ink-950 dark:text-cream/60 dark:hover:bg-cream/5 dark:hover:text-cream'
                }`}
              >
                {locale === 'ru' && g.nameRu ? g.nameRu : g.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-900/50 dark:text-cream/50">{dict.nav.categories}</h4>
        {/* Bold-text-only used to be the only signal for which category was
            active — easy to miss at a glance, especially scanning a list of
            5+ items. Active rows now also get a green-tinted background and
            left accent bar (the site's usual selected-state treatment), and
            every row — active or not — gets a hover background so the whole
            list reads as clickable, not just the ones that happen to be
            links. */}
        <div className="flex flex-col gap-1">
          <button
            onClick={() => selectCategory(null)}
            className={`rounded-lg border-l-2 px-3 py-2 text-left text-sm transition-colors ${
              !activeCategory
                ? 'border-gold-500 bg-gold-500/10 font-bold text-gold-600 dark:text-gold-400'
                : 'border-transparent text-ink-900/60 hover:bg-ink-900/5 hover:text-ink-950 dark:text-cream/60 dark:hover:bg-cream/5 dark:hover:text-cream'
            }`}
          >
            {dict.product.allCategories}
          </button>
          {categories.map((cat) => (
            <button
              key={cat.slug}
              onClick={() => selectCategory(cat.slug)}
              className={`rounded-lg border-l-2 px-3 py-2 text-left text-sm transition-colors ${
                activeCategory === cat.slug
                  ? 'border-gold-500 bg-gold-500/10 font-bold text-gold-600 dark:text-gold-400'
                  : 'border-transparent text-ink-900/60 hover:bg-ink-900/5 hover:text-ink-950 dark:text-cream/60 dark:hover:bg-cream/5 dark:hover:text-cream'
              }`}
            >
              {locale === 'ru' && cat.nameRu ? cat.nameRu : cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* O'lchamsiz toifada (aksessuar, kosmetika, sumka...) bu bo'lim
          BUTUNLAY chizilmaydi — avval bunday toifada ham kiyim
          o'lchamlari (XS-XXL) chiqib turardi, ular esa u yerda hech
          qachon mos kelmaydi. */}
      {SIZES.length > 0 && (
      <div>
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-900/50 dark:text-cream/50">{dict.product.size}</h4>
        <div className="flex flex-wrap gap-2">
          {SIZES.map((size) => (
            <button
              key={size}
              onClick={() => toggleListParam('sizes', size, activeSizes)}
              className={`h-9 min-w-9 rounded-lg border px-2 text-xs font-semibold transition-colors ${
                activeSizes.includes(size)
                  ? 'border-gold-500 bg-gold-500 text-white'
                  : 'border-ink-900/15 text-ink-900/70 hover:border-ink-950 hover:bg-ink-900/5 dark:border-cream/20 dark:text-cream dark:hover:border-cream dark:hover:bg-cream/5'
              }`}
            >
              {size}
            </button>
          ))}
        </div>
      </div>
      )}

      {/* Bironta tovarda rang ko'rsatilmagan bo'lsa — bo'lim umuman
          chizilmaydi (bo'sh sarlavha osilib qolmasligi uchun). */}
      {colors.length > 0 && (
      <div>
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-900/50 dark:text-cream/50">{dict.product.color}</h4>
        <div className="flex flex-wrap gap-2">
          {colors.map((name) => (
            <button
              key={name}
              title={translateColorName(name, locale)}
              onClick={() => toggleListParam('colors', name, activeColors)}
              // Tus nomdan olinadi (lib/utils/colorSwatch.ts) — admin
              // qo'lda yozgan, ro'yxatda yo'q rang ham neytral doiracha
              // bo'lib ko'rinadi, ya'ni hech narsa sinmaydi.
              style={{ backgroundColor: swatchColor(name) }}
              className={`h-8 w-8 rounded-full border-2 transition-transform hover:scale-110 ${
                activeColors.includes(name)
                  ? 'border-gold-500 ring-2 ring-gold-500/40'
                  : 'border-ink-900/10 dark:border-cream/20'
              }`}
            />
          ))}
        </div>
      </div>
      )}

      <div>
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-900/50 dark:text-cream/50">{dict.product.priceRange}</h4>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            onBlur={() => updateParams((p) => (minPrice ? p.set('minPrice', minPrice) : p.delete('minPrice')))}
            placeholder="0"
            className="w-full rounded-lg border border-ink-900/15 px-3 py-2 text-sm text-ink-950 outline-none focus:border-ink-950 dark:border-cream/15 dark:bg-ink-800 dark:text-cream dark:placeholder:text-cream/40"
          />
          <span className="text-ink-900/30 dark:text-cream/30">—</span>
          <input
            type="number"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            onBlur={() => updateParams((p) => (maxPrice ? p.set('maxPrice', maxPrice) : p.delete('maxPrice')))}
            placeholder="1000000"
            className="w-full rounded-lg border border-ink-900/15 px-3 py-2 text-sm text-ink-950 outline-none focus:border-ink-950 dark:border-cream/15 dark:bg-ink-800 dark:text-cream dark:placeholder:text-cream/40"
          />
        </div>
      </div>
      </div>
    </aside>
  );
}
