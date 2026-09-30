'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { useMutation, useQuery } from '@apollo/client';
import { Check, ImagePlus, Pencil, Trash2, X } from 'lucide-react';
import { GET_ADMIN_BANNERS, GET_CATEGORIES, GET_PRODUCTS_ADMIN } from '@/lib/graphql/queries';
import { CREATE_BANNER, REMOVE_BANNER, UPDATE_BANNER } from '@/lib/graphql/mutations';
import { uploadProductImage } from '@/lib/utils/uploadProductImage';
import { Checkbox } from '@/components/ui/Checkbox';
import type { Locale } from '@/i18n/config';

// Bu sahifadagi matnlar shu yerda turadi (lug'at fayllariga qo'shilmagan) —
// faqat admin ko'radigan, bitta sahifada ishlatiladigan yozuvlar.
const TEXT = {
  uz: {
    title: 'Reklamalar',
    hint: "Bosh sahifadagi reklama karuseli. Har bir banner — bitta rasm; xohlasangiz uni mahsulot yoki kategoriya sahifasiga bog'lashingiz mumkin. Faqat “Faol” bannerlar saytda ko'rinadi.",
    newBanner: "Yangi banner qo'shish",
    editBanner: 'Bannerni tahrirlash',
    image: 'Banner rasmi',
    uploadImage: 'Kompyuterdan rasm tanlash',
    uploading: 'Yuklanmoqda…',
    imageRequired: 'Avval banner rasmini yuklang',
    titleUz: "Sarlavha (o'zbekcha)",
    titleRu: 'Sarlavha (ruscha)',
    titleHint: "Ixtiyoriy — bo'sh qoldirsangiz rasmning o'zi ko'rsatiladi",
    linkTitle: 'Bosilganda qayerga o’tsin?',
    linkNone: "Hech qayerga (oddiy rasm)",
    linkProduct: 'Mahsulot sahifasiga',
    linkProducts: 'Bir nechta mahsulotga',
    linkCategory: 'Kategoriya sahifasiga',
    selectProduct: '— Mahsulotni tanlang —',
    selectCategory: '— Kategoriyani tanlang —',
    productsHint:
      "Kerakli tovarlarni belgilang (masalan krossovka + ko'ylak + futbolka). Banner bosilganda do'kon sahifasi faqat shu tovarlarni ko'rsatadi.",
    productsSearch: 'Tovar nomi bo’yicha qidirish…',
    productsSelected: 'Tanlangan',
    productsNotFound: 'Tovar topilmadi',
    productsClear: 'Tanlovni tozalash',
    selectProductsError: 'Kamida bitta mahsulotni tanlang',
    order: 'Tartib raqami',
    orderHint: 'Kichik raqam oldinroq turadi',
    active: 'Faol (saytda ko’rinsin)',
    save: 'Saqlash',
    saving: 'Saqlanmoqda…',
    cancel: 'Bekor qilish',
    list: "Qo'shilgan bannerlar",
    empty: "Hali banner qo'shilmagan",
    inactive: 'Faol emas',
    deleteConfirm: "Bu banner o'chirilsinmi?",
    uploadError: 'Rasm yuklashda xatolik. Backend ishlab turganini tekshiring.',
    selectProductError: 'Mahsulotni tanlang',
    selectCategoryError: 'Kategoriyani tanlang',
  },
  ru: {
    title: 'Реклама',
    hint: 'Карусель рекламы на главной странице. Каждый баннер — одна картинка; при желании её можно связать со страницей товара или категории. На сайте показываются только «активные» баннеры.',
    newBanner: 'Добавить баннер',
    editBanner: 'Редактировать баннер',
    image: 'Изображение баннера',
    uploadImage: 'Выбрать файл с компьютера',
    uploading: 'Загрузка…',
    imageRequired: 'Сначала загрузите изображение',
    titleUz: 'Заголовок (узбекский)',
    titleRu: 'Заголовок (русский)',
    titleHint: 'Необязательно — если пусто, показывается только картинка',
    linkTitle: 'Куда вести при нажатии?',
    linkNone: 'Никуда (просто картинка)',
    linkProduct: 'На страницу товара',
    linkProducts: 'На несколько товаров',
    linkCategory: 'На страницу категории',
    selectProduct: '— Выберите товар —',
    selectCategory: '— Выберите категорию —',
    productsHint:
      'Отметьте нужные товары (например кроссовки + рубашка + футболка). При нажатии на баннер в магазине покажутся только они.',
    productsSearch: 'Поиск по названию товара…',
    productsSelected: 'Выбрано',
    productsNotFound: 'Товары не найдены',
    productsClear: 'Очистить выбор',
    selectProductsError: 'Выберите хотя бы один товар',
    order: 'Порядок',
    orderHint: 'Меньше число — раньше в списке',
    active: 'Активен (показывать на сайте)',
    save: 'Сохранить',
    saving: 'Сохранение…',
    cancel: 'Отмена',
    list: 'Добавленные баннеры',
    empty: 'Баннеров пока нет',
    inactive: 'Не активен',
    deleteConfirm: 'Удалить этот баннер?',
    uploadError: 'Ошибка загрузки изображения. Проверьте, запущен ли backend.',
    selectProductError: 'Выберите товар',
    selectCategoryError: 'Выберите категорию',
  },
} as const;

// "PRODUCTS" — bitta bannerga bir nechta tovar biriktiriladi
// (backenddagi ro'yxat bilan bir xil: banner.input.ts, BANNER_LINK_TYPES).
type LinkType = 'NONE' | 'PRODUCT' | 'PRODUCTS' | 'CATEGORY';

const EMPTY_FORM = {
  image: '',
  title: '',
  titleRu: '',
  linkType: 'NONE' as LinkType,
  productId: '',
  // Tanlangan tovarlar tartibi saqlanadi — shu tartibda bazaga yoziladi.
  productIds: [] as string[],
  categoryId: '',
  isActive: true,
  sortOrder: 0,
};

// Qidiruv uchun oddiy normallashtirish: katta-kichik harf va o'zbekcha
// apostrof variantlari ("o'" / "o‘" / "o’") farq qilmasligi uchun.
function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .trim();
}

export default function AdminBannersPage({ params }: { params: { locale: Locale } }) {
  const { locale } = params;
  const t = TEXT[locale === 'ru' ? 'ru' : 'uz'];

  const { data, loading, refetch } = useQuery(GET_ADMIN_BANNERS, { fetchPolicy: 'cache-and-network' });
  const { data: categoriesData } = useQuery(GET_CATEGORIES);
  // Bannerni mahsulotga bog'lash uchun ro'yxat. `productsAdmin` — admin
  // uchun mo'ljallangan mavjud so'rov (yashirilgan tovarlarni ham
  // ko'rsatadi), yangi endpoint yozilmadi.
  const { data: productsData } = useQuery(GET_PRODUCTS_ADMIN, {
    variables: { filter: { page: 1, limit: 200, sort: 'NEWEST' } },
  });

  const [createBanner] = useMutation(CREATE_BANNER);
  const [updateBanner] = useMutation(UPDATE_BANNER);
  const [removeBanner] = useMutation(REMOVE_BANNER);

  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Ko'p tovarli banner uchun ro'yxat ichidagi qidiruv maydoni.
  const [productQuery, setProductQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const banners = data?.adminBanners ?? [];
  const categories = categoriesData?.categories ?? [];
  const products = productsData?.productsAdmin?.list ?? [];

  // Qidiruv bo'sh bo'lsa — hamma tovar. Ro'yxat balandligi cheklangan
  // (scroll), shuning uchun yuzlab tovar ham sahifani cho'zib yubormaydi.
  const productSearch = normalize(productQuery);
  const visibleProducts = productSearch
    ? products.filter((p: any) => normalize(String(p.title ?? '')).includes(productSearch))
    : products;

  function toggleProduct(id: string) {
    setForm((f) => ({
      ...f,
      productIds: f.productIds.includes(id)
        ? f.productIds.filter((x) => x !== id)
        : [...f.productIds, id],
    }));
  }

  function resetForm() {
    setForm({ ...EMPTY_FORM, productIds: [] });
    setEditingId(null);
    setError(null);
    setProductQuery('');
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      // Mahsulot rasmlari bilan AYNAN bir xil yuklash yo'li — token
      // muddati tugab qolsa o'zi yangilab qayta urinadi
      // (lib/utils/uploadProductImage.ts izohiga qarang).
      const url = await uploadProductImage(file);
      setForm((f) => ({ ...f, image: url }));
    } catch {
      setError(t.uploadError);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function startEdit(banner: any) {
    setEditingId(banner.id);
    setError(null);
    setProductQuery('');
    setForm({
      image: banner.image,
      title: banner.title ?? '',
      titleRu: banner.titleRu ?? '',
      linkType: (banner.linkType ?? 'NONE') as LinkType,
      productId: banner.productId ?? '',
      // Avval tanlangan tovarlar belgilangan holda ochiladi.
      productIds: (banner.products ?? []).map((p: any) => p.id),
      categoryId: banner.categoryId ?? '',
      isActive: banner.isActive,
      sortOrder: banner.sortOrder ?? 0,
    });
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleSave() {
    if (!form.image) {
      setError(t.imageRequired);
      return;
    }
    if (form.linkType === 'PRODUCT' && !form.productId) {
      setError(t.selectProductError);
      return;
    }
    if (form.linkType === 'PRODUCTS' && form.productIds.length === 0) {
      setError(t.selectProductsError);
      return;
    }
    if (form.linkType === 'CATEGORY' && !form.categoryId) {
      setError(t.selectCategoryError);
      return;
    }

    const input = {
      image: form.image,
      title: form.title.trim() || undefined,
      titleRu: form.titleRu.trim() || undefined,
      linkType: form.linkType,
      // Tanlanmagan tomon ataylab `null` bo'lib ketmaydi — backend
      // linkType bo'yicha keraksizini o'zi tozalaydi (banner.service.ts,
      // normalizeLink).
      productId: form.linkType === 'PRODUCT' ? form.productId : undefined,
      productIds: form.linkType === 'PRODUCTS' ? form.productIds : undefined,
      categoryId: form.linkType === 'CATEGORY' ? form.categoryId : undefined,
      isActive: form.isActive,
      sortOrder: Number(form.sortOrder) || 0,
    };

    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await updateBanner({ variables: { id: editingId, input } });
      } else {
        await createBanner({ variables: { input } });
      }
      resetForm();
      await refetch();
    } catch (err: any) {
      setError(err?.message ?? 'Error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    // eslint-disable-next-line no-alert
    if (!window.confirm(t.deleteConfirm)) return;
    await removeBanner({ variables: { id } });
    if (editingId === id) resetForm();
    await refetch();
  }

  async function toggleActive(banner: any) {
    await updateBanner({ variables: { id: banner.id, input: { isActive: !banner.isActive } } });
    await refetch();
  }

  const inputClass =
    'w-full rounded-xl border border-ink-900/15 px-4 py-3 text-sm text-ink-950 outline-none focus:border-ink-950 dark:border-cream/15 dark:bg-ink-900 dark:text-cream dark:placeholder:text-cream/40 dark:focus:border-cream';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="section-title">{t.title}</h1>
        <p className="mt-2 max-w-2xl text-xs text-ink-900/50 dark:text-cream/50">{t.hint}</p>
      </div>

      {/* ── Qo'shish / tahrirlash formasi ── */}
      <div className="card-surface space-y-4 p-6">
        <h2 className="text-sm font-bold uppercase tracking-wider">
          {editingId ? t.editBanner : t.newBanner}
        </h2>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-ink-900/60 dark:text-cream/60">{t.image}</label>
          {form.image && (
            <div className="relative mb-3 aspect-[21/9] w-full max-w-xl overflow-hidden rounded-xl bg-ink-900/5">
              <Image src={form.image} alt="" fill className="object-cover" unoptimized />
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleUpload}
            className="hidden"
            id="banner-image-input"
          />
          <label
            htmlFor="banner-image-input"
            className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-ink-900/15 px-4 py-2.5 text-sm font-semibold transition-colors hover:border-ink-950 dark:border-cream/15 dark:hover:border-cream"
          >
            <ImagePlus size={16} />
            {uploading ? t.uploading : t.uploadImage}
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-ink-900/60 dark:text-cream/60">{t.titleUz}</label>
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-ink-900/60 dark:text-cream/60">{t.titleRu}</label>
            <input
              value={form.titleRu}
              onChange={(e) => setForm((f) => ({ ...f, titleRu: e.target.value }))}
              className={inputClass}
            />
          </div>
        </div>
        <p className="text-xs text-ink-900/40 dark:text-cream/40">{t.titleHint}</p>

        <div className="space-y-3 border-t border-ink-900/10 pt-4 dark:border-cream/10">
          <h3 className="text-xs font-bold uppercase tracking-wider text-ink-900/50 dark:text-cream/50">
            {t.linkTitle}
          </h3>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['NONE', t.linkNone],
                ['PRODUCT', t.linkProduct],
                ['PRODUCTS', t.linkProducts],
                ['CATEGORY', t.linkCategory],
              ] as [LinkType, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setForm((f) => ({ ...f, linkType: value }))}
                className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                  form.linkType === value
                    ? 'border-ink-950 bg-ink-950 text-cream'
                    : 'border-ink-900/15 hover:border-ink-950 dark:border-cream/15 dark:hover:border-cream'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {form.linkType === 'PRODUCT' && (
            <select
              value={form.productId}
              onChange={(e) => setForm((f) => ({ ...f, productId: e.target.value }))}
              className={inputClass}
            >
              <option value="">{t.selectProduct}</option>
              {products.map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          )}

          {/* ── Bir nechta tovar tanlash ──
              Bitta bannerga bir NECHTA tovar biriktiriladi. Ro'yxat
              belgilash (checkbox) usulida: "select multiple" bo'lsa admin
              Ctrl tugmasini bosib turishi kerak bo'lardi va bitta
              noto'g'ri bosishda butun tanlov yo'qolardi. */}
          {form.linkType === 'PRODUCTS' && (
            <div className="space-y-2">
              <p className="text-xs text-ink-900/45 dark:text-cream/45">{t.productsHint}</p>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={productQuery}
                  onChange={(e) => setProductQuery(e.target.value)}
                  placeholder={t.productsSearch}
                  className={`${inputClass} sm:max-w-sm`}
                />
                <span className="text-xs font-semibold text-ink-900/50 dark:text-cream/50">
                  {t.productsSelected}: {form.productIds.length}
                </span>
                {form.productIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, productIds: [] }))}
                    className="text-xs font-semibold text-ink-900/45 underline-offset-2 hover:underline dark:text-cream/45"
                  >
                    {t.productsClear}
                  </button>
                )}
              </div>

              {/* Balandligi cheklangan — tovar ko'p bo'lsa ichida
                  aylantiriladi, sahifa esa cho'zilib ketmaydi. */}
              <div className="max-h-72 space-y-1 overflow-y-auto rounded-xl border border-ink-900/12 p-2 dark:border-cream/12">
                {visibleProducts.length === 0 ? (
                  <p className="px-2 py-3 text-sm text-ink-900/45 dark:text-cream/45">{t.productsNotFound}</p>
                ) : (
                  visibleProducts.map((p: any) => {
                    const checked = form.productIds.includes(p.id);
                    return (
                      <label
                        key={p.id}
                        className={`flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 transition-colors ${
                          checked ? 'bg-gold-500/10' : 'hover:bg-ink-900/5 dark:hover:bg-cream/5'
                        }`}
                      >
                        <Checkbox checked={checked} onChange={() => toggleProduct(p.id)} />
                        {p.images?.[0] && (
                          <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-ink-900/5">
                            <Image src={p.images[0]} alt="" fill className="object-cover" unoptimized />
                          </span>
                        )}
                        <span className="min-w-0 flex-1 truncate text-sm">{p.title}</span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {form.linkType === 'CATEGORY' && (
            <select
              value={form.categoryId}
              onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
              className={inputClass}
            >
              <option value="">{t.selectCategory}</option>
              {categories.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {locale === 'ru' && c.nameRu ? c.nameRu : c.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="grid gap-4 border-t border-ink-900/10 pt-4 sm:grid-cols-2 dark:border-cream/10">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-ink-900/60 dark:text-cream/60">{t.order}</label>
            <input
              type="number"
              value={form.sortOrder}
              onChange={(e) => setForm((f) => ({ ...f, sortOrder: Number(e.target.value) || 0 }))}
              className={inputClass}
            />
            <p className="mt-1 text-xs text-ink-900/40 dark:text-cream/40">{t.orderHint}</p>
          </div>
          <label className="flex items-center gap-2.5 self-end pb-3 text-sm font-medium">
            {/* Umumiy Checkbox komponenti — brauzerning o'z katakchasi
                qorong'i fonda ko'rinmay qolardi (components/ui/Checkbox.tsx). */}
            <Checkbox
              checked={form.isActive}
              onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
            />
            {t.active}
          </label>
        </div>

        {error && <p className="text-sm font-medium text-red-500">{error}</p>}

        <div className="flex gap-2">
          <button onClick={handleSave} disabled={saving || uploading} className="btn-primary disabled:opacity-60">
            {saving ? t.saving : t.save}
          </button>
          {editingId && (
            <button onClick={resetForm} className="btn-outline">
              {t.cancel}
            </button>
          )}
        </div>
      </div>

      {/* ── Mavjud bannerlar ── */}
      <div className="card-surface space-y-3 p-6">
        <h2 className="text-sm font-bold uppercase tracking-wider">{t.list}</h2>

        {loading && banners.length === 0 ? (
          <div className="flex h-24 items-center justify-center">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-ink-900/10 border-t-ink-950" />
          </div>
        ) : banners.length === 0 ? (
          <p className="text-sm text-ink-900/50 dark:text-cream/50">{t.empty}</p>
        ) : (
          <div className="space-y-3">
            {banners.map((banner: any) => (
              <div
                key={banner.id}
                className="flex flex-wrap items-center gap-4 rounded-xl border border-ink-900/8 p-3 dark:border-cream/10"
              >
                <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded-lg bg-ink-900/5">
                  <Image src={banner.image} alt="" fill className="object-cover" unoptimized />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {banner.title || banner.titleRu || '—'}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-ink-900/45 dark:text-cream/45">
                    {banner.linkType === 'PRODUCT'
                      ? `${t.linkProduct}: ${banner.productTitle ?? '—'}`
                      : banner.linkType === 'PRODUCTS'
                        ? `${t.linkProducts}: ${(banner.products ?? [])
                            .map((p: any) => p.title)
                            .join(', ')}`
                        : banner.linkType === 'CATEGORY'
                          ? `${t.linkCategory}: ${banner.categoryName ?? '—'}`
                          : t.linkNone}
                  </p>
                  {!banner.isActive && (
                    <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700">
                      {t.inactive}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleActive(banner)}
                    title={t.active}
                    className={banner.isActive ? 'text-emerald-600' : 'text-ink-900/30 dark:text-cream/30'}
                  >
                    {banner.isActive ? <Check size={18} /> : <X size={18} />}
                  </button>
                  <button
                    onClick={() => startEdit(banner)}
                    className="text-ink-900/30 hover:text-ink-950 dark:text-cream/30 dark:hover:text-cream"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(banner.id)}
                    className="text-ink-900/30 hover:text-red-500 dark:text-cream/30"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
