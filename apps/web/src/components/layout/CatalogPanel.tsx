'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useQuery } from '@apollo/client';
import {
  ArrowRight,
  ChevronRight,
  Footprints,
  Gem,
  Glasses,
  Percent,
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

// Toifa nomiga mos ikonka. Nom bazada turlicha yozilishi mumkin
// (lotin/kirill aralash, ko'plik/birlik, ruscha/o'zbekcha), shuning uchun
// `categorySizes.ts` dagi kabi "ildiz" bo'yicha taqqoslanadi: matn kichik
// harfga keltiriladi, kirill lotinga o'giriladi, so'ng bo'laklar
// qidiriladi. Hammasi bitta oiladan (lucide, outline), 19px, bir xil
// chiziq qalinligi (1.75).
const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'j', з: 'z', и: 'i',
  й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't',
  у: 'u', ф: 'f', х: 'x', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sh', ъ: '', ы: 'i', ь: '',
  э: 'e', ю: 'yu', я: 'ya', ғ: 'g', қ: 'q', ҳ: 'h', ў: 'o',
};

function normalize(text: string): string {
  let out = '';
  for (const ch of text.toLowerCase()) out += CYRILLIC_TO_LATIN[ch] ?? ch;
  return out.replace(/[^a-z0-9]/g, '');
}

const ICON_RULES: { roots: string[]; icon: LucideIcon }[] = [
  { roots: ['krosov', 'krasov', 'keda', 'poyabzal', 'obuv', 'tufli', 'botin', 'sapog', 'sandal', 'shoe', 'sneaker'], icon: Footprints },
  { roots: ['soat', 'chasi', 'watch'], icon: Watch },
  { roots: ['duxi', 'atir', 'parf', 'odekolon', 'perfume', 'tualet'], icon: SprayCan },
  { roots: ['chegirm', 'skidk', 'aksiy', 'sale', 'discount'], icon: Percent },
  { roots: ['ochki', 'kozoynak', 'glass'], icon: Glasses },
  { roots: ['zargar', 'bijuter', 'uzuk', 'zolot', 'jewel'], icon: Gem },
  { roots: ['sumk', 'ryukzak', 'bag', 'portfel'], icon: ShoppingBasket },
  { roots: ['kosmetik', 'kosmet', 'cosmet', 'krem'], icon: Sparkles },
  { roots: ['akses', 'aksessuar', 'aksesuar'], icon: Tag },
  { roots: ['kiyim', 'odejd', 'futbolk', 'koylak', 'rubash', 'shim', 'bryuk', 'jins', 'kurtk', 'palto', 'sviter', 'tolstovk', 'shirt', 'dress'], icon: Shirt },
];

function iconForCategory(category: CategoryRow): LucideIcon {
  const haystack = `${normalize(category.name)} ${normalize(category.nameRu ?? '')} ${normalize(category.slug)}`;
  for (const rule of ICON_RULES) {
    if (rule.roots.some((root) => haystack.includes(root))) return rule.icon;
  }
  return Tag;
}

interface CatalogPanelProps {
  open: boolean;
  onClose: () => void;
  locale: Locale;
  dict: Dictionary;
}

// Katalogning keng "mega-menu" paneli — kichkina dropdown emas: asosiy
// headerning ichki konteyneri kengligida, to'rtta teng ustunda.
//
// MA'LUMOT MANBAI: mavjud `GET_CATEGORIES` so'rovi. Tanlanganda mavjud
// yo'l ishlatiladi — `/shop?category=<slug>` (do'kon sahifasidagi filtr
// aynan shu parametrni o'qiydi). Yangi API yaratilmagan, toifa nomi, id
// va manzili o'zgarmaydi.
//
// ANIMATSIYA: `clip-path: inset(...)` — panel yuqoridan pastga qarab
// "ochiladi" va teskari yig'iladi. Ataylab `scaleY` EMAS: scaleY matn va
// ikonkalarni cho'zib yuborardi, clip-path esa mazmunni umuman
// o'zgartirmaydi, shunchaki ko'rinadigan qismini kesadi.
//
// Panel DOM'dan olib tashlanmaydi — doim chizilgan turadi va faqat
// klasslari almashadi, shuning uchun yopilish animatsiyasi to'liq
// o'ynaydi va tez-tez bosilganda harakat joriy holatidan teskari
// yo'nalishga silliq o'tadi. Yopiq holatda `invisible` +
// `pointer-events-none` — ya'ni panel inert: na klikni to'sadi, na
// klaviatura fokusini ushlaydi.
export function CatalogPanel({ open, onClose, locale, dict }: CatalogPanelProps) {
  const { data } = useQuery(GET_CATEGORIES, { fetchPolicy: 'cache-first' });
  const categories: CategoryRow[] = data?.categories ?? [];

  // Escape bosilganda yopiladi (fokusni tugmaga qaytarish — Header'da,
  // chunki tugma o'sha yerda).
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-hidden={!open}
      // `inset-x-0` — panel bar bilan AYNAN bitta o'ram ichida turadi
      // (Header.tsx), shuning uchun uning chap/o'ng chetlari har doim
      // barnikiga teng: header scroll'da torayganda panel ham u bilan
      // birga toraya­di va tekislanish buzilmaydi.
      className={`catalog-panel absolute inset-x-0 top-full z-40 mt-2.5 ${open ? 'is-open' : ''}`}
    >
      <div className="rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-panel)] p-6 shadow-soft sm:p-7">
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="text-[18px] font-bold text-ink-950 dark:text-cream">{dict.nav.categories}</h2>
          <Link
            href={`/${locale}/categories`}
            prefetch={false}
            onClick={onClose}
            className="flex items-center gap-1.5 text-[13px] font-semibold text-gold-600 transition-colors hover:text-gold-500 dark:text-gold-400"
          >
            {dict.nav.allCategories}
            <ArrowRight size={15} />
          </Link>
        </div>

        {categories.length === 0 ? (
          <p className="py-6 text-sm text-ink-900/50 dark:text-cream/50">{dict.product.noResults}</p>
        ) : (
          <div className="grid max-h-[min(60vh,420px)] grid-cols-1 gap-x-4 gap-y-0.5 overflow-y-auto sm:grid-cols-2 lg:grid-cols-4">
            {categories.map((category) => {
              const Icon = iconForCategory(category);
              const title = locale === 'ru' && category.nameRu ? category.nameRu : category.name;
              return (
                <Link
                  key={category.id}
                  href={`/${locale}/shop?category=${encodeURIComponent(category.slug)}`}
                  prefetch={false}
                  // Kategoriya tanlanganda menyu yopiladi.
                  onClick={onClose}
                  // min-h-[44px] — barmoq bilan bosishga qulay o'lcham.
                  className="group flex min-h-[44px] items-center gap-3 rounded-[10px] px-3 py-2.5 text-left transition-colors hover:bg-gold-500/10"
                >
                  <Icon
                    size={18}
                    strokeWidth={1.75}
                    className="shrink-0 text-ink-900/55 transition-colors group-hover:text-gold-600 dark:text-cream/55 dark:group-hover:text-gold-400"
                  />
                  <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-ink-900/90 transition-colors group-hover:text-gold-600 dark:text-cream/90 dark:group-hover:text-gold-400">
                    {title}
                  </span>
                  <ChevronRight
                    size={15}
                    className="shrink-0 text-ink-900/25 transition-colors group-hover:text-gold-600 dark:text-cream/25 dark:group-hover:text-gold-400"
                  />
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
