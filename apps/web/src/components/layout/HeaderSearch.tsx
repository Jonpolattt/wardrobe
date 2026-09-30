'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useQuery } from '@apollo/client';
import { ArrowRight, ChevronRight, Clock, Search, X } from 'lucide-react';
import { GET_CATEGORIES, SEARCH_PRODUCTS } from '@/lib/graphql/queries';
import { formatPrice } from '@/lib/utils/format';
import { resolveMinPrice } from '@/lib/utils/variantPrice';
import {
  clearSearchHistory,
  pushSearchHistory,
  readSearchHistory,
  removeSearchHistory,
} from '@/lib/utils/searchHistory';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/get-dictionary';

// Natijalar panelida ko'pi bilan shuncha mahsulot ko'rsatiladi.
const PREVIEW_LIMIT = 6;
// Serverga so'rov yuborishdan oldin kutiladigan vaqt.
const DEBOUNCE_MS = 200;

interface ProductRow {
  id: string;
  title: string;
  titleRu?: string | null;
  slug: string;
  price: number;
  images?: string[] | null;
  sizes?: string[] | null;
  variants?: { size: string; color: string; price?: number | null }[] | null;
}

interface CategoryRow {
  id: string;
  name: string;
  nameRu?: string | null;
  slug: string;
}

// Taqqoslash uchun matnni bir ko'rinishga keltiradi:
//  - NFKC: turli Unicode yozilishlarini bitta shaklga soladi;
//  - kichik harf (til qoidalari bilan);
//  - o'zbekchadagi turli apostroflar (‘ ’ ʻ ʼ ` ´) bitta ' ga;
//    shunda "O‘ylak" va "O'ylak" bir xil hisoblanadi;
//  - chetlardagi bo'sh joylar olib tashlanadi.
function normalize(value: string | null | undefined): string {
  return String(value ?? '')
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[‘’ʻʼ`´]/g, "'")
    .trim();
}

interface HeaderSearchProps {
  locale: Locale;
  dict: Dictionary;
  // Header `fixed` (ixcham) holatda bo'lsa matn bir pog'ona kichrayadi.
  compact?: boolean;
  // Qidiruv paneli ochilganda katalog menyusi yopilishi uchun (ikkalasi
  // bir vaqtda bir-birining ustida turmasligi kerak).
  onOpen?: () => void;
  // Maydonning ICHIGA, tozalash (×) tugmasidan keyin qo'shiladigan
  // element. Telefondagi qatorda shu yerga "Bekor qilish" tugmasi
  // qo'yiladi — MobileSearchBar.tsx ga qarang. Desktopda berilmaydi,
  // ya'ni u yerda hech narsa o'zgarmaydi.
  trailing?: ReactNode;
  // Tashqaridan "panelni yop" signali. Qiymati har o'zgarganda natijalar
  // paneli yopiladi. Telefondagi "Bekor qilish" tugmasi shuni
  // ishlatadi: u maydonning ICHIDA turgani uchun komponentning o'z
  // "tashqariga bosildi" mantig'i uni tashqi klik deb hisoblamaydi.
  closeToken?: number;
}

export function HeaderSearch({ locale, dict, compact = false, onOpen, trailing, closeToken }: HeaderSearchProps) {
  const router = useRouter();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);

  // Yuqoridagi `closeToken` izohiga qarang. Birinchi renderda ham
  // ishlaydi, lekin panel allaqachon yopiq — hech narsa o'zgarmaydi.
  useEffect(() => {
    if (closeToken === undefined) return;
    setOpen(false);
  }, [closeToken]);
  // Oxirgi qidiruvlar — faqat brauzerda saqlanadi
  // (lib/utils/searchHistory.ts). Serverdan o'qilmaydi.
  // Boshlang'ich qiymat ataylab bo'sh: localStorage faqat brauzerda
  // mavjud, server render paytida esa yo'q — darhol o'qilsa server va
  // brauzer HTML'i mos kelmay, hydration xatosi chiqardi.
  const [history, setHistory] = useState<string[]>([]);
  useEffect(() => {
    setHistory(readSearchHistory());
  }, []);
  // Klaviatura bilan yurish uchun tanlangan qator (-1 — hech biri).
  const [activeIndex, setActiveIndex] = useState(-1);

  // Debounce: har bir harfdan keyin emas, yozish to'xtagach so'rov
  // yuboriladi. Eskirgan javob muammosi bu yerda o'z-o'zidan hal bo'ladi:
  // Apollo `data`ni HAR DOIM oxirgi o'zgaruvchilarga moslab qaytaradi,
  // ya'ni kechikib kelgan eski javob ekranga tushmaydi.
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const normalizedQuery = normalize(debounced);

  const { data, loading } = useQuery(SEARCH_PRODUCTS, {
    // `search` — backenddagi mavjud filtr (LIKE %q%). Kengroq to'plam
    // olinadi, "boshlanadi" bo'yicha yakuniy saralash pastda.
    variables: { filter: { search: debounced, page: 1, limit: 40, sort: 'NEWEST' } },
    skip: normalizedQuery.length === 0,
    fetchPolicy: 'cache-first',
  });

  const { data: categoriesData } = useQuery(GET_CATEGORIES, { fetchPolicy: 'cache-first' });

  function productName(product: ProductRow): string {
    return locale === 'ru' && product.titleRu ? product.titleRu : product.title;
  }

  function categoryName(category: CategoryRow): string {
    return locale === 'ru' && category.nameRu ? category.nameRu : category.name;
  }

  // ── "Nomi shu matn bilan BOSHLANADI" ────────────────────────────────
  // Ataylab `includes()` emas, `startsWith()`: "k" yozilganda "Ko'ylak",
  // "Krossovka" chiqadi, lekin "Futbolka" (ichida k bor) yoki "Polo
  // ko'ylak" (P bilan boshlanadi) chiqmaydi.
  const products: ProductRow[] = useMemo(() => {
    if (!normalizedQuery) return [];
    const list: ProductRow[] = data?.products?.list ?? [];
    return list.filter((p) => normalize(productName(p)).startsWith(normalizedQuery));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, normalizedQuery, locale]);

  const categories: CategoryRow[] = useMemo(() => {
    if (!normalizedQuery) return [];
    const list: CategoryRow[] = categoriesData?.categories ?? [];
    return list.filter((c) => normalize(categoryName(c)).startsWith(normalizedQuery));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoriesData, normalizedQuery, locale]);

  const previewProducts = products.slice(0, PREVIEW_LIMIT);

  // DIQQAT — E'LON TARTIBI MUHIM: quyidagi uchta qiymat `navigableRows`
  // dan OLDIN turishi shart, chunki u `showHistory` ga tayanadi.
  // `const` "temporal dead zone" qoidasiga bo'ysunadi: e'lon
  // qilinishidan oldin ishlatilsa, render paytida
  // "Cannot access 'showHistory' before initialization" xatosi chiqadi
  // (aynan shunday bo'lgan edi).
  const hasQuery = normalizedQuery.length > 0;
  const hasResults = previewProducts.length > 0 || categories.length > 0;
  // So'rov bo'sh bo'lsa — natijalar o'rniga tarix ko'rsatiladi.
  const showHistory = !hasQuery && history.length > 0;

  // Klaviatura bilan yuriladigan yagona ro'yxat: tarix ko'rsatilayotgan
  // bo'lsa — tarix qatorlari; aks holda avval mahsulotlar, keyin
  // kategoriyalar.
  const navigableRows = showHistory
    ? history.map((term) => ({ kind: 'history' as const, href: `/${locale}/shop?search=${encodeURIComponent(term)}`, term }))
    : [
        ...previewProducts.map((p) => ({ kind: 'product' as const, href: `/${locale}/product/${p.slug}`, term: '' })),
        ...categories.map((c) => ({
          kind: 'category' as const,
          href: `/${locale}/shop?category=${encodeURIComponent(c.slug)}`,
          term: '',
        })),
      ];

  useEffect(() => {
    setActiveIndex(-1);
  }, [normalizedQuery]);

  // Tashqariga bosilganda yopiladi.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent | TouchEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, [open]);

  // Qidiruv "bajarildi" deb hisoblangan har bir holatda so'rov tarixga
  // yoziladi: natijani bosganda ham, "Barcha natijalar"ga o'tganda ham.
  function remember(term: string) {
    const value = term.trim();
    if (!value) return;
    setHistory(pushSearchHistory(value));
  }

  function goToAllResults() {
    const q = query.trim();
    remember(q);
    setOpen(false);
    router.push(q ? `/${locale}/shop?search=${encodeURIComponent(q)}` : `/${locale}/shop`);
  }

  function runHistoryTerm(term: string) {
    remember(term);
    setQuery(term);
    setDebounced(term);
    setOpen(false);
    router.push(`/${locale}/shop?search=${encodeURIComponent(term)}`);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (navigableRows.length === 0) return;
      setOpen(true);
      setActiveIndex((i) => (i + 1) % navigableRows.length);
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (navigableRows.length === 0) return;
      setActiveIndex((i) => (i <= 0 ? navigableRows.length - 1 : i - 1));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      // Tanlangan qator bo'lsa — o'sha sahifa; bo'lmasa "Barcha natijalar".
      const row = navigableRows[activeIndex];
      if (row) {
        if (row.kind === 'history') remember(row.term);
        else remember(query);
        setOpen(false);
        router.push(row.href);
      } else {
        goToAllResults();
      }
    }
  }

  function clearQuery() {
    setQuery('');
    setDebounced('');
    // Fokus maydonda qoladi — X bosilgach darhol qaytadan yozish mumkin.
    inputRef.current?.focus();
  }

  const panelOpen = open && (hasQuery || showHistory);

  return (
    <div ref={wrapperRef} className="relative min-w-0 flex-1">
      {/* Fokus halqasi ICHKI inputda emas, tashqi konteynerda — shunda
          "ikki qavat ramka" hosil bo'lmaydi. Input o'zining chegarasi va
          fonini umuman olmaydi (bg-transparent + border-0). */}
      <div
        className={`flex h-11 items-center gap-2.5 rounded-[10px] border bg-[color:var(--surface-input)] px-4 transition-colors ${
          panelOpen || open ? 'border-gold-500' : 'border-[color:var(--surface-border)]'
        }`}
      >
        <Search size={17} strokeWidth={1.75} className="shrink-0 text-ink-900/40 dark:text-cream/40" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            onOpen?.();
          }}
          onFocus={() => {
            setOpen(true);
            onOpen?.();
          }}
          onKeyDown={handleKeyDown}
          placeholder={dict.nav.searchPlaceholder}
          aria-label={dict.nav.searchPlaceholder}
          aria-expanded={panelOpen}
          aria-controls="header-search-results"
          // !bg-transparent va !border-0 — globals.css dagi umumiy input
          // qoidalari (fon + chegara) aynan shu yerda kerak emas.
          className={`h-full min-w-0 flex-1 !border-0 !bg-transparent text-ink-950 outline-none placeholder:text-ink-900/45 dark:text-cream dark:placeholder:text-cream/45 ${
            compact ? 'text-xs' : 'text-[13px]'
          }`}
        />
        {query && (
          <button
            type="button"
            onClick={clearQuery}
            aria-label="×"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-ink-900/40 transition-colors hover:bg-ink-900/10 hover:text-ink-950 dark:text-cream/40 dark:hover:bg-cream/10 dark:hover:text-cream"
          >
            <X size={14} />
          </button>
        )}
        {/* Tozalash (×) tugmasidan KEYIN — ya'ni × har doim uning chap
            tomonida turadi. */}
        {trailing}
      </div>

      {/* ── Natijalar paneli ──────────────────────────────────────────
          Inputning bevosita ostida, aynan shu kenglikda. Sahifa ustida
          suzib turadi (absolute), ya'ni pastdagi kontentni surmaydi.
          Yopiq holatda `invisible` — ko'rinmaydi, klik qabul qilmaydi va
          klaviatura fokusini ham ushlab qolmaydi. */}
      <div
        id="header-search-results"
        className={`absolute left-0 right-0 top-full z-50 mt-2 origin-top overflow-hidden rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-panel)] shadow-soft transition-all duration-200 ease-[cubic-bezier(.22,1,.36,1)] motion-reduce:transition-none ${
          panelOpen ? 'visible translate-y-0 opacity-100' : 'invisible -translate-y-2 opacity-0'
        }`}
      >
        <div className="max-h-[min(70vh,520px)] overflow-y-auto p-4">
          {showHistory ? (
            /* ── Oxirgi qidiruvlar ──────────────────────────────────
               Maydon bo'sh bo'lganda ko'rsatiladi. Ro'yxat faqat shu
               brauzerda saqlanadi; har bir qatorni alohida o'chirish
               yoki hammasini tozalash mumkin. */
            <>
              <div className="flex items-center justify-between px-1 pb-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-900/45 dark:text-cream/45">
                  {dict.nav.searchHistory}
                </p>
                <button
                  type="button"
                  onClick={() => setHistory(clearSearchHistory())}
                  className="text-[11px] font-semibold text-ink-900/45 transition-colors hover:text-gold-600 dark:text-cream/45 dark:hover:text-gold-400"
                >
                  {dict.nav.searchHistoryClear}
                </button>
              </div>

              <div className="space-y-0.5">
                {history.map((term, index) => (
                  <div
                    key={term}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={`flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors ${
                      activeIndex === index ? 'bg-gold-500/10' : 'hover:bg-ink-900/5 dark:hover:bg-cream/5'
                    }`}
                  >
                    <Clock size={15} strokeWidth={1.75} className="shrink-0 text-ink-900/35 dark:text-cream/35" />
                    <button
                      type="button"
                      onClick={() => runHistoryTerm(term)}
                      className="min-w-0 flex-1 truncate text-left text-[13px] font-medium text-ink-950 dark:text-cream"
                    >
                      {term}
                    </button>
                    <button
                      type="button"
                      aria-label="×"
                      // Faqat shu bitta so'rovni ro'yxatdan o'chiradi.
                      onClick={() => setHistory(removeSearchHistory(term))}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-ink-900/35 transition-colors hover:bg-ink-900/10 hover:text-ink-950 dark:text-cream/35 dark:hover:bg-cream/10 dark:hover:text-cream"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <p className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-900/45 dark:text-cream/45">
                {dict.nav.searchResults}
              </p>

              {!hasResults ? (
                <p className="px-1 py-6 text-center text-sm text-ink-900/50 dark:text-cream/50">
                  {loading ? '…' : dict.nav.searchNoResults}
                </p>
              ) : (
                <>
                  <div className="space-y-0.5">
                    {previewProducts.map((product, index) => {
                      const image = product.images?.[0] || '/placeholder-product.svg';
                      const price = resolveMinPrice(product as any);
                      return (
                        <button
                          key={product.id}
                          type="button"
                          onMouseEnter={() => setActiveIndex(index)}
                          onClick={() => {
                            remember(query);
                            setOpen(false);
                            router.push(`/${locale}/product/${product.slug}`);
                          }}
                          className={`flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors ${
                            activeIndex === index ? 'bg-gold-500/10' : 'hover:bg-ink-900/5 dark:hover:bg-cream/5'
                          }`}
                        >
                          <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-ink-900/5 dark:bg-cream/5">
                            <Image src={image} alt="" fill className="object-cover" unoptimized />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-medium text-ink-950 dark:text-cream">
                              {productName(product)}
                            </span>
                            <span className="block text-[13px] font-semibold text-gold-600 dark:text-gold-400">
                              {formatPrice(price, locale)}
                            </span>
                          </span>
                          <ChevronRight size={16} className="shrink-0 text-ink-900/30 dark:text-cream/30" />
                        </button>
                      );
                    })}
                  </div>

                  {categories.length > 0 && (
                    <>
                      <div className="my-3 border-t border-[color:var(--surface-border)]" />
                      <p className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-900/45 dark:text-cream/45">
                        {dict.nav.categories}
                      </p>
                      <div className="space-y-0.5">
                        {categories.map((category, i) => {
                          const index = previewProducts.length + i;
                          return (
                            <button
                              key={category.id}
                              type="button"
                              onMouseEnter={() => setActiveIndex(index)}
                              onClick={() => {
                                remember(query);
                                setOpen(false);
                                router.push(`/${locale}/shop?category=${encodeURIComponent(category.slug)}`);
                              }}
                              className={`flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors ${
                                activeIndex === index ? 'bg-gold-500/10' : 'hover:bg-ink-900/5 dark:hover:bg-cream/5'
                              }`}
                            >
                              <Search size={16} strokeWidth={1.75} className="shrink-0 text-ink-900/40 dark:text-cream/40" />
                              <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink-950 dark:text-cream">
                                {categoryName(category)}
                              </span>
                              <ChevronRight size={16} className="shrink-0 text-ink-900/30 dark:text-cream/30" />
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}

                  <button
                    type="button"
                    onClick={goToAllResults}
                    className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-[10px] border border-[color:var(--surface-border)] py-2.5 text-xs font-semibold text-gold-600 transition-colors hover:border-gold-500 dark:text-gold-400"
                  >
                    {dict.nav.searchAllResults}
                    <ArrowRight size={14} />
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
