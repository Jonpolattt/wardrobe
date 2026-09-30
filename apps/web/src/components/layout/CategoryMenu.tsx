'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@apollo/client';
import {
  ChevronDown,
  Footprints,
  Gem,
  Glasses,
  LayoutGrid,
  Shirt,
  ShoppingBasket,
  Sparkles,
  SprayCan,
  Tag,
  Watch,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { GET_CATEGORIES } from '@/lib/graphql/queries';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/get-dictionary';

interface CategoryRow {
  id: string;
  name: string;
  nameRu?: string | null;
  slug: string;
}

// Toifa nomiga mos ikonka. Nom bazada turlicha yozilgan bo'lishi mumkin
// (lotin/kirill aralash, ko'plik/birlik, ruscha/o'zbekcha), shuning uchun
// bu yerda ham `categorySizes.ts` dagi kabi "ildiz" bo'yicha taqqoslash
// ishlatiladi: matn kichik harfga keltiriladi, kirill harflari lotinga
// o'giriladi, so'ng ro'yxatdagi bo'laklar qidiriladi.
//
// Hammasi bitta ikonka oilasidan (lucide, outline), bir xil o'lcham (18px)
// va bir xil chiziq qalinligida (1.75) chiziladi.
const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'j', з: 'z', и: 'i',
  й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't',
  у: 'u', ф: 'f', х: 'x', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sh', ъ: '', ы: 'i', ь: '',
  э: 'e', ю: 'yu', я: 'ya', ғ: 'g', қ: 'q', ҳ: 'h', ў: 'o',
};

function normalize(text: string): string {
  let out = '';
  for (const ch of text.toLowerCase()) {
    out += CYRILLIC_TO_LATIN[ch] ?? ch;
  }
  return out.replace(/[^a-z0-9]/g, '');
}

const ICON_RULES: { roots: string[]; icon: LucideIcon }[] = [
  { roots: ['krosov', 'krasov', 'keda', 'poyabzal', 'obuv', 'tufli', 'botin', 'sapog', 'sandal', 'shoe', 'sneaker'], icon: Footprints },
  { roots: ['soat', 'chasi', 'watch'], icon: Watch },
  { roots: ['duxi', 'atir', 'parf', 'odekolon', 'perfume', 'tualet'], icon: SprayCan },
  { roots: ['ochki', 'kozoynak', 'ochk', 'glass'], icon: Glasses },
  { roots: ['zargar', 'bijuter', 'uzuk', 'zolot', 'jewel'], icon: Gem },
  { roots: ['sumk', 'ryukzak', 'bag', 'portfel'], icon: ShoppingBasket },
  { roots: ['kosmetik', 'kosmet', 'cosmet', 'krem'], icon: Sparkles },
  { roots: ['akses', 'aksessuar', 'aksesuar'], icon: Tag },
  { roots: ['kiyim', 'odejd', 'futbolk', 'koylak', 'rubash', 'shim', 'bryuk', 'jins', 'kurtk', 'palto', 'sviter', 'tolstovk', 'shirt', 'tshirt', 'dress'], icon: Shirt },
];

function iconForCategory(category: CategoryRow): LucideIcon {
  const haystack = `${normalize(category.name)} ${normalize(category.nameRu ?? '')} ${normalize(category.slug)}`;
  for (const rule of ICON_RULES) {
    if (rule.roots.some((root) => haystack.includes(root))) return rule.icon;
  }
  // Mos kelmasa — neytral yorliq ikonkasi (hech qachon bo'sh joy qolmaydi).
  return Tag;
}

interface CategoryMenuProps {
  locale: Locale;
  dict: Dictionary;
}

// Asosiy headerdagi "Kategoriyalar" tugmasi va uning ostidan ochiladigan
// menyu.
//
// MA'LUMOT MANBAI: mavjud `GET_CATEGORIES` so'rovi — yangi API yoki
// alohida katalog tizimi yaratilmadi. Tanlanganda ham mavjud yo'l
// ishlatiladi: `/shop?category=<slug>` (do'kon sahifasidagi filtr aynan
// shu parametrni o'qiydi), ya'ni toifa nomi, id va havolasi o'zgarmaydi.
export function CategoryMenu({ locale, dict }: CategoryMenuProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // `cache-first` — toifalar kam o'zgaradi va bu so'rov sayt bo'ylab
  // boshqa sahifalarda ham ishlatiladi, ya'ni odatda keshdan darhol
  // keladi (qo'shimcha tarmoq so'rovi yo'q).
  const { data } = useQuery(GET_CATEGORIES, { fetchPolicy: 'cache-first' });
  const categories: CategoryRow[] = data?.categories ?? [];

  // Yopish: tashqariga bosilganda va Escape bosilganda.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent | TouchEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={wrapperRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`flex items-center gap-2 rounded-[10px] border px-3 py-2 text-sm font-semibold transition-colors ${
          open
            ? 'border-gold-500 text-gold-600 dark:text-gold-400'
            : 'border-transparent text-ink-900/80 hover:text-ink-950 dark:text-cream/80 dark:hover:text-cream'
        }`}
      >
        <LayoutGrid size={18} strokeWidth={1.75} />
        <span className="hidden xl:inline">{dict.nav.categories}</span>
        <ChevronDown size={14} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {/*
        OCHILISH/YOPILISH ANIMATSIYASI.

        `grid-template-rows: 0fr -> 1fr` usuli ishlatilgan: panel yuqoridan
        pastga qarab "ochiladi", yopilganda esa teskari yig'iladi. Bu
        ataylab `scaleY` emas — scaleY matn va ikonkalarni cho'zib
        yuborardi; bu yerda esa mazmun hech qachon deformatsiyalanmaydi,
        shunchaki ko'rinadigan balandligi o'zgaradi.

        Panel DOM'dan OLIB TASHLANMAYDI — u doim chizilgan turadi va faqat
        klasslari almashadi, shuning uchun yopilish animatsiyasi to'liq
        o'ynaydi (React uni yarim yo'lda olib qo'ymaydi) va tez-tez
        bosilganda harakat silliq teskari yo'nalishga o'tadi.

        Yopiq holatda `invisible` — `visibility: hidden` elementlar klik
        ham, klaviatura fokusini ham qabul qilmaydi, ya'ni yopiq menyu
        hech narsani "ushlab qolmaydi".
      */}
      <div
        className={`absolute left-0 top-full z-50 grid w-[min(92vw,320px)] overflow-hidden pt-2 transition-all duration-[280ms] ease-[cubic-bezier(.22,1,.36,1)] motion-reduce:transition-none ${
          open ? 'visible grid-rows-[1fr] translate-y-0 opacity-100' : 'invisible grid-rows-[0fr] -translate-y-1 opacity-0'
        }`}
      >
        <div className="min-h-0">
          <div
            role="menu"
            className="max-h-[70vh] overflow-y-auto rounded-2xl border bg-white p-2 shadow-soft dark:bg-ink-800"
            style={{ borderColor: 'var(--surface-border)' }}
          >
            {categories.length === 0 ? (
              <p className="px-3 py-4 text-xs text-ink-900/50 dark:text-cream/50">{dict.product.noResults}</p>
            ) : (
              categories.map((category) => {
                const Icon = iconForCategory(category);
                const title = locale === 'ru' && category.nameRu ? category.nameRu : category.name;
                return (
                  <Link
                    key={category.id}
                    role="menuitem"
                    href={`/${locale}/shop?category=${encodeURIComponent(category.slug)}`}
                    prefetch={false}
                    // Toifa tanlanganda menyu yopiladi.
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-medium text-ink-900/85 transition-colors hover:bg-gold-500/10 hover:text-gold-600 dark:text-cream/85 dark:hover:text-gold-400"
                  >
                    <Icon size={18} strokeWidth={1.75} className="shrink-0" />
                    <span className="truncate">{title}</span>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
