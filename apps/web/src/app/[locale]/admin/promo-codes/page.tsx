'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { Check, Pencil, Trash2, X } from 'lucide-react';
import { GET_ADMIN_PROMO_CODES, GET_CATEGORIES, GET_PRODUCTS_ADMIN } from '@/lib/graphql/queries';
import { CREATE_PROMO_CODE, REMOVE_PROMO_CODE, UPDATE_PROMO_CODE } from '@/lib/graphql/mutations';
import { Checkbox } from '@/components/ui/Checkbox';
import { formatPrice } from '@/lib/utils/format';
import type { Locale } from '@/i18n/config';

// Bu sahifadagi matnlar shu yerda turadi (lug'at fayllariga qo'shilmagan) —
// faqat admin ko'radigan, bitta sahifada ishlatiladigan yozuvlar.
const TEXT = {
  uz: {
    title: 'Promokodlar',
    hint: "Chegirma kodlari. Har bir kod bitta telefon raqamidan FAQAT BIR MARTA ishlatiladi; boshqa kod chiqsa, o'sha raqam uni yana ishlata oladi.",
    newOne: "Yangi promokod qo'shish",
    editOne: 'Promokodni tahrirlash',
    code: 'Kod',
    codeHint: "Katta harflarda saqlanadi — xaridor qanday yozishidan qat'i nazar topiladi",
    discountType: 'Chegirma turi',
    percent: 'Foiz (%)',
    amount: "Aniq summa (so'm)",
    value: 'Chegirma qiymati',
    maxDiscount: "Eng ko'p chegirma (so'm)",
    maxDiscountHint: "Faqat foizli chegirma uchun — ixtiyoriy",
    minOrder: "Eng kam buyurtma summasi (so'm)",
    minOrderHint: 'Ixtiyoriy',
    startsAt: 'Boshlanish sanasi',
    endsAt: 'Tugash sanasi',
    dateHint: "Bo'sh qoldirilsa — muddat cheklanmaydi",
    scope: 'Qaysi tovarlarga amal qiladi?',
    scopeAll: 'Hamma tovarga',
    scopeCategories: 'Tanlangan kategoriyalarga',
    scopeProducts: 'Tanlangan tovarlarga',
    pickCategories: 'Kategoriyalarni belgilang',
    pickProducts: 'Tovarlarni belgilang',
    search: 'Qidirish…',
    selected: 'Tanlangan',
    clear: 'Tanlovni tozalash',
    notFound: 'Topilmadi',
    active: "Faol (ishlatish mumkin)",
    save: 'Saqlash',
    saving: 'Saqlanmoqda…',
    cancel: 'Bekor qilish',
    list: "Qo'shilgan promokodlar",
    empty: "Hali promokod qo'shilmagan",
    inactive: 'Faol emas',
    used: 'ishlatilgan',
    deleteConfirm: "Bu promokod o'chirilsinmi?",
    codeRequired: 'Kodni kiriting',
    valueRequired: "Chegirma qiymatini kiriting",
  },
  ru: {
    title: 'Промокоды',
    hint: 'Коды скидок. Каждый код можно использовать с одного номера телефона ТОЛЬКО ОДИН РАЗ; другой код тот же номер сможет использовать снова.',
    newOne: 'Добавить промокод',
    editOne: 'Редактировать промокод',
    code: 'Код',
    codeHint: 'Сохраняется заглавными — найдётся, как бы покупатель его ни ввёл',
    discountType: 'Тип скидки',
    percent: 'Процент (%)',
    amount: 'Фиксированная сумма (сум)',
    value: 'Размер скидки',
    maxDiscount: 'Максимальная скидка (сум)',
    maxDiscountHint: 'Только для процентной скидки — необязательно',
    minOrder: 'Минимальная сумма заказа (сум)',
    minOrderHint: 'Необязательно',
    startsAt: 'Дата начала',
    endsAt: 'Дата окончания',
    dateHint: 'Если пусто — срок не ограничен',
    scope: 'На какие товары действует?',
    scopeAll: 'На все товары',
    scopeCategories: 'На выбранные категории',
    scopeProducts: 'На выбранные товары',
    pickCategories: 'Отметьте категории',
    pickProducts: 'Отметьте товары',
    search: 'Поиск…',
    selected: 'Выбрано',
    clear: 'Очистить выбор',
    notFound: 'Ничего не найдено',
    active: 'Активен (можно использовать)',
    save: 'Сохранить',
    saving: 'Сохранение…',
    cancel: 'Отмена',
    list: 'Добавленные промокоды',
    empty: 'Промокодов пока нет',
    inactive: 'Не активен',
    used: 'использован',
    deleteConfirm: 'Удалить этот промокод?',
    codeRequired: 'Введите код',
    valueRequired: 'Введите размер скидки',
  },
} as const;

type Scope = 'ALL' | 'CATEGORIES' | 'PRODUCTS';
type DiscountType = 'PERCENT' | 'AMOUNT';

const EMPTY_FORM = {
  code: '',
  discountType: 'PERCENT' as DiscountType,
  discountValue: '',
  maxDiscount: '',
  minOrderAmount: '',
  startsAt: '',
  endsAt: '',
  isActive: true,
  scope: 'ALL' as Scope,
  categoryIds: [] as string[],
  productIds: [] as string[],
};

// Qidiruv uchun oddiy normallashtirish (katta-kichik harf va o'zbekcha
// apostrof variantlari farq qilmasligi uchun).
function normalize(value: string) {
  return value.toLowerCase().replace(/[’‘`´]/g, "'").trim();
}

// "2026-10-01T00:00:00.000Z" → "2026-10-01" (date inputi shuni kutadi).
function toDateInput(value?: string | null) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

export default function AdminPromoCodesPage({ params }: { params: { locale: Locale } }) {
  const { locale } = params;
  const t = TEXT[locale === 'ru' ? 'ru' : 'uz'];

  const { data, loading, refetch } = useQuery(GET_ADMIN_PROMO_CODES, { fetchPolicy: 'cache-and-network' });
  const { data: categoriesData } = useQuery(GET_CATEGORIES);
  const { data: productsData } = useQuery(GET_PRODUCTS_ADMIN, {
    variables: { filter: { page: 1, limit: 200, sort: 'NEWEST' } },
  });

  const [createPromo] = useMutation(CREATE_PROMO_CODE);
  const [updatePromo] = useMutation(UPDATE_PROMO_CODE);
  const [removePromo] = useMutation(REMOVE_PROMO_CODE);

  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const promos = data?.adminPromoCodes ?? [];
  const categories = categoriesData?.categories ?? [];
  const products = productsData?.productsAdmin?.list ?? [];

  const search = normalize(query);
  const visibleProducts = search
    ? products.filter((p: any) => normalize(String(p.title ?? '')).includes(search))
    : products;

  function toggleId(key: 'categoryIds' | 'productIds', id: string) {
    setForm((f) => ({
      ...f,
      [key]: f[key].includes(id) ? f[key].filter((x) => x !== id) : [...f[key], id],
    }));
  }

  function resetForm() {
    setForm({ ...EMPTY_FORM, categoryIds: [], productIds: [] });
    setEditingId(null);
    setError(null);
    setQuery('');
  }

  function startEdit(promo: any) {
    setEditingId(promo.id);
    setError(null);
    setQuery('');
    setForm({
      code: promo.code,
      discountType: promo.discountType,
      discountValue: String(promo.discountValue ?? ''),
      maxDiscount: promo.maxDiscount != null ? String(promo.maxDiscount) : '',
      minOrderAmount: promo.minOrderAmount != null ? String(promo.minOrderAmount) : '',
      startsAt: toDateInput(promo.startsAt),
      endsAt: toDateInput(promo.endsAt),
      isActive: promo.isActive,
      scope: promo.scope,
      categoryIds: (promo.categories ?? []).map((c: any) => c.id),
      productIds: (promo.products ?? []).map((p: any) => p.id),
    });
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleSave() {
    if (!form.code.trim()) {
      setError(t.codeRequired);
      return;
    }
    if (!form.discountValue || Number(form.discountValue) <= 0) {
      setError(t.valueRequired);
      return;
    }

    const input = {
      code: form.code.trim(),
      discountType: form.discountType,
      discountValue: Number(form.discountValue),
      // Bo'sh maydon `undefined` bo'lib ketadi — backend uni "qiymat
      // yo'q" deb qabul qiladi (0 emas).
      maxDiscount: form.discountType === 'PERCENT' && form.maxDiscount ? Number(form.maxDiscount) : undefined,
      minOrderAmount: form.minOrderAmount ? Number(form.minOrderAmount) : undefined,
      startsAt: form.startsAt || undefined,
      endsAt: form.endsAt || undefined,
      isActive: form.isActive,
      scope: form.scope,
      categoryIds: form.scope === 'CATEGORIES' ? form.categoryIds : undefined,
      productIds: form.scope === 'PRODUCTS' ? form.productIds : undefined,
    };

    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await updatePromo({ variables: { id: editingId, input } });
      } else {
        await createPromo({ variables: { input } });
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
    await removePromo({ variables: { id } });
    if (editingId === id) resetForm();
    await refetch();
  }

  async function toggleActive(promo: any) {
    await updatePromo({ variables: { id: promo.id, input: { isActive: !promo.isActive } } });
    await refetch();
  }

  const inputClass =
    'w-full rounded-xl border border-ink-900/15 px-4 py-3 text-sm text-ink-950 outline-none focus:border-ink-950 dark:border-cream/15 dark:bg-ink-900 dark:text-cream dark:placeholder:text-cream/40 dark:focus:border-cream';
  const labelClass = 'mb-1.5 block text-xs font-semibold text-ink-900/60 dark:text-cream/60';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="section-title">{t.title}</h1>
        <p className="mt-2 max-w-2xl text-xs text-ink-900/50 dark:text-cream/50">{t.hint}</p>
      </div>

      {/* ── Qo'shish / tahrirlash formasi ── */}
      <div className="card-surface space-y-4 p-6">
        <h2 className="text-sm font-bold uppercase tracking-wider">{editingId ? t.editOne : t.newOne}</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>{t.code}</label>
            <input
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
              placeholder="WELCOME10"
              className={`${inputClass} uppercase`}
            />
            <p className="mt-1 text-xs text-ink-900/40 dark:text-cream/40">{t.codeHint}</p>
          </div>
          <div>
            <label className={labelClass}>{t.discountType}</label>
            <div className="flex gap-2">
              {(
                [
                  ['PERCENT', t.percent],
                  ['AMOUNT', t.amount],
                ] as [DiscountType, string][]
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, discountType: value }))}
                  className={`flex-1 rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors ${
                    form.discountType === value
                      ? 'border-ink-950 bg-ink-950 text-cream'
                      : 'border-ink-900/15 hover:border-ink-950 dark:border-cream/15 dark:hover:border-cream'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className={labelClass}>{t.value}</label>
            <input
              type="number"
              value={form.discountValue}
              onChange={(e) => setForm((f) => ({ ...f, discountValue: e.target.value }))}
              className={inputClass}
            />
          </div>
          {form.discountType === 'PERCENT' && (
            <div>
              <label className={labelClass}>{t.maxDiscount}</label>
              <input
                type="number"
                value={form.maxDiscount}
                onChange={(e) => setForm((f) => ({ ...f, maxDiscount: e.target.value }))}
                className={inputClass}
              />
              <p className="mt-1 text-xs text-ink-900/40 dark:text-cream/40">{t.maxDiscountHint}</p>
            </div>
          )}
          <div>
            <label className={labelClass}>{t.minOrder}</label>
            <input
              type="number"
              value={form.minOrderAmount}
              onChange={(e) => setForm((f) => ({ ...f, minOrderAmount: e.target.value }))}
              className={inputClass}
            />
            <p className="mt-1 text-xs text-ink-900/40 dark:text-cream/40">{t.minOrderHint}</p>
          </div>
        </div>

        <div className="grid gap-4 border-t border-ink-900/10 pt-4 sm:grid-cols-2 dark:border-cream/10">
          <div>
            <label className={labelClass}>{t.startsAt}</label>
            <input
              type="date"
              value={form.startsAt}
              onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>{t.endsAt}</label>
            <input
              type="date"
              value={form.endsAt}
              onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))}
              className={inputClass}
            />
            <p className="mt-1 text-xs text-ink-900/40 dark:text-cream/40">{t.dateHint}</p>
          </div>
        </div>

        {/* ── Qamrov ── */}
        <div className="space-y-3 border-t border-ink-900/10 pt-4 dark:border-cream/10">
          <h3 className="text-xs font-bold uppercase tracking-wider text-ink-900/50 dark:text-cream/50">{t.scope}</h3>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['ALL', t.scopeAll],
                ['CATEGORIES', t.scopeCategories],
                ['PRODUCTS', t.scopeProducts],
              ] as [Scope, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setForm((f) => ({ ...f, scope: value }))}
                className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                  form.scope === value
                    ? 'border-ink-950 bg-ink-950 text-cream'
                    : 'border-ink-900/15 hover:border-ink-950 dark:border-cream/15 dark:hover:border-cream'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {form.scope === 'CATEGORIES' && (
            <div className="space-y-2">
              <p className="text-xs text-ink-900/45 dark:text-cream/45">{t.pickCategories}</p>
              <div className="max-h-60 space-y-1 overflow-y-auto rounded-xl border border-ink-900/12 p-2 dark:border-cream/12">
                {categories.map((c: any) => {
                  const checked = form.categoryIds.includes(c.id);
                  return (
                    <label
                      key={c.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 transition-colors ${
                        checked ? 'bg-gold-500/10' : 'hover:bg-ink-900/5 dark:hover:bg-cream/5'
                      }`}
                    >
                      <Checkbox checked={checked} onChange={() => toggleId('categoryIds', c.id)} />
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {locale === 'ru' && c.nameRu ? c.nameRu : c.name}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {form.scope === 'PRODUCTS' && (
            <div className="space-y-2">
              <p className="text-xs text-ink-900/45 dark:text-cream/45">{t.pickProducts}</p>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t.search}
                  className={`${inputClass} sm:max-w-sm`}
                />
                <span className="text-xs font-semibold text-ink-900/50 dark:text-cream/50">
                  {t.selected}: {form.productIds.length}
                </span>
                {form.productIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, productIds: [] }))}
                    className="text-xs font-semibold text-ink-900/45 underline-offset-2 hover:underline dark:text-cream/45"
                  >
                    {t.clear}
                  </button>
                )}
              </div>
              <div className="max-h-72 space-y-1 overflow-y-auto rounded-xl border border-ink-900/12 p-2 dark:border-cream/12">
                {visibleProducts.length === 0 ? (
                  <p className="px-2 py-3 text-sm text-ink-900/45 dark:text-cream/45">{t.notFound}</p>
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
                        <Checkbox checked={checked} onChange={() => toggleId('productIds', p.id)} />
                        <span className="min-w-0 flex-1 truncate text-sm">{p.title}</span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        <label className="flex items-center gap-2.5 border-t border-ink-900/10 pt-4 text-sm font-medium dark:border-cream/10">
          <Checkbox checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} />
          {t.active}
        </label>

        {error && <p className="text-sm font-medium text-red-500">{error}</p>}

        <div className="flex gap-2">
          <button onClick={handleSave} disabled={saving} className="btn-primary disabled:opacity-60">
            {saving ? t.saving : t.save}
          </button>
          {editingId && (
            <button onClick={resetForm} className="btn-outline">
              {t.cancel}
            </button>
          )}
        </div>
      </div>

      {/* ── Mavjud promokodlar ── */}
      <div className="card-surface space-y-3 p-6">
        <h2 className="text-sm font-bold uppercase tracking-wider">{t.list}</h2>

        {loading && promos.length === 0 ? (
          <div className="flex h-24 items-center justify-center">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-ink-900/10 border-t-ink-950" />
          </div>
        ) : promos.length === 0 ? (
          <p className="text-sm text-ink-900/50 dark:text-cream/50">{t.empty}</p>
        ) : (
          <div className="space-y-3">
            {promos.map((promo: any) => (
              <div
                key={promo.id}
                className="flex flex-wrap items-center gap-4 rounded-xl border border-ink-900/8 p-3 dark:border-cream/10"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold tracking-wide">{promo.code}</p>
                  <p className="mt-0.5 text-xs text-ink-900/45 dark:text-cream/45">
                    {promo.discountType === 'PERCENT'
                      ? `−${promo.discountValue}%`
                      : `−${formatPrice(promo.discountValue, locale)}`}
                    {' · '}
                    {promo.scope === 'ALL'
                      ? t.scopeAll
                      : promo.scope === 'CATEGORIES'
                        ? `${t.scopeCategories}: ${(promo.categories ?? []).map((c: any) => c.name).join(', ')}`
                        : `${t.scopeProducts}: ${(promo.products ?? []).map((p: any) => p.name).join(', ')}`}
                    {' · '}
                    {promo.usedCount} {t.used}
                  </p>
                  {(promo.startsAt || promo.endsAt) && (
                    <p className="mt-0.5 text-xs text-ink-900/40 dark:text-cream/40">
                      {toDateInput(promo.startsAt) || '…'} — {toDateInput(promo.endsAt) || '…'}
                    </p>
                  )}
                  {!promo.isActive && (
                    <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700">
                      {t.inactive}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleActive(promo)}
                    title={t.active}
                    className={promo.isActive ? 'text-emerald-600' : 'text-ink-900/30 dark:text-cream/30'}
                  >
                    {promo.isActive ? <Check size={18} /> : <X size={18} />}
                  </button>
                  <button
                    onClick={() => startEdit(promo)}
                    className="text-ink-900/30 hover:text-ink-950 dark:text-cream/30 dark:hover:text-cream"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(promo.id)}
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
