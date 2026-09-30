'use client';

import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery } from '@apollo/client';
import { UploadCloud } from 'lucide-react';
import { GET_CATEGORIES, GET_BRANDS, GET_STORES, GET_GENDERS } from '@/lib/graphql/queries';
import { uploadProductImage } from '@/lib/utils/uploadProductImage';
import { PRESET_COLORS as COLOR_PRESETS } from '@/lib/utils/colorSwatch';
import { Checkbox } from '@/components/ui/Checkbox';
// Toifaga qarab o'lcham ro'yxati — do'kon filtri (ShopFilters.tsx) bilan
// BITTA umumiy manbadan o'qiladi (lib/utils/categorySizes.ts). Avval shu
// faylning o'zida alohida nusxasi bor edi va ikkalasi bir-biridan
// farqlanib ketgan edi.
import { getSizeOptions, getCategorySizeKind } from '@/lib/utils/categorySizes';
import type { Dictionary } from '@/i18n/get-dictionary';

export interface VariantValue {
  size: string;
  color: string;
  stock: number;
  // Duxi hajmlari uchun — shu variantning o'z narxi. Bo'sh (null/undefined)
  // bo'lsa mahsulotning umumiy narxi ishlatiladi.
  price?: number | null;
}

export interface ColorImagesValue {
  color: string;
  images: string[];
}

export interface ProductFormValues {
  title: string;
  titleRu?: string;
  description?: string;
  descriptionRu?: string;
  sku: string;
  price: number;
  oldPrice?: number;
  discountPercent?: number;
  stock: number;
  sizes: string[];
  colors: string[];
  images: string[];
  colorImages: ColorImagesValue[];
  variants: VariantValue[];
  categoryId: string;
  brandId?: string;
  storeId?: string;
  isFeatured?: boolean;
  // Erkaklar/Ayollar va h.k. — Brend bilan bir xil ixtiyoriy tanlov, admin
  // o'zi admin/categories sahifasida yaratgan ro'yxatdan.
  genderId?: string;
}

// COLOR_PRESETS (the common ready-made swatches so the admin can add a
// color in one click instead of typing it every time — a custom text field
// below still covers anything not in this list) is now imported as
// PRESET_COLORS from lib/utils/colorSwatch.ts, aliased above, so this list
// can never drift out of sync with what the shop filter sidebar / quick-buy
// modal / product page color picker show for the same color name.

function Required() {
  return <span className="text-red-500"> *</span>;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs font-medium text-red-500">{message}</p>;
}

export function ProductForm({
  dict,
  defaultValues,
  onSubmit,
  submitting,
}: {
  dict: Dictionary;
  defaultValues?: Partial<ProductFormValues>;
  onSubmit: (values: ProductFormValues) => void;
  submitting?: boolean;
}) {
  const { data: categoriesData } = useQuery(GET_CATEGORIES);
  const { data: brandsData } = useQuery(GET_BRANDS);
  const { data: storesData } = useQuery(GET_STORES);
  const { data: gendersData } = useQuery(GET_GENDERS);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<ProductFormValues>({
    mode: 'onBlur',
    defaultValues: {
      sizes: [],
      colors: [],
      images: [],
      colorImages: [],
      variants: [],
      stock: 0,
      price: 0,
      ...defaultValues,
    },
  });

  const [imageInput, setImageInput] = useState('');
  const [colorInput, setColorInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadingColorFor, setUploadingColorFor] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sizes = watch('sizes') ?? [];
  const colors = watch('colors') ?? [];
  const images = watch('images') ?? [];
  const colorImages = watch('colorImages') ?? [];
  const variants = watch('variants') ?? [];
  const hasVariantGrid = sizes.length > 0 || colors.length > 0;

  // Keep the variants array (per size+color stock) in sync whenever the
  // admin adds/removes a size or color — existing combos keep whatever the
  // admin already typed, and combos for a size/color that was just removed
  // are dropped.
  //
  // Brand-new combos (the very first time sizes/colors are turned on for a
  // product that had none before) default to the product's existing plain
  // `stock` number split across every combo, NOT 0 — defaulting to 0 would
  // silently zero out a product's entire inventory the moment an admin
  // enables sizes/colors without realizing they now also need to fill in
  // the grid, instantly making it unbuyable with no visible warning.
  // Combos added later (after the grid already exists) still start at 0,
  // since at that point there's no other stock number to infer from.
  useEffect(() => {
    if (!hasVariantGrid) return;
    const rows = sizes.length ? sizes : [''];
    const cols = colors.length ? colors : [''];
    // Judge "first population" by whether any real stock has been captured
    // yet, not by array length — a stale placeholder row (e.g. a leftover
    // { size: '', color: '', stock: 0 } from before sizes/colors were set)
    // has length 1 but carries no real data, and must still trigger the
    // fallback below instead of silently defaulting every combo to 0.
    const isFirstPopulation = variants.every((v) => !v.stock);
    const fallbackStock = isFirstPopulation ? Math.max(0, Number(getValues('stock')) || 0) : 0;
    const comboCount = rows.length * cols.length;
    const perComboFallback = isFirstPopulation && comboCount > 0 ? Math.ceil(fallbackStock / comboCount) : 0;

    const next: VariantValue[] = [];
    for (const s of rows) {
      for (const c of cols) {
        const existing = variants.find((v) => v.size === s && v.color === c);
        // Narx ham saqlanadi — o'lcham/rang ro'yxati o'zgarganda
        // (masalan yangi hajm qo'shilganda) allaqachon kiritilgan
        // narxlar yo'qolib ketmasligi uchun.
        next.push({ size: s, color: c, stock: existing?.stock ?? perComboFallback, price: existing?.price ?? null });
      }
    }
    const changed =
      next.length !== variants.length ||
      next.some((v, i) => v.size !== variants[i]?.size || v.color !== variants[i]?.color);
    if (changed) setValue('variants', next, { shouldDirty: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sizes.join(','), colors.join(',')]);

  function getVariantStock(size: string, color: string): number {
    return variants.find((v) => v.size === size && v.color === color)?.stock ?? 0;
  }

  function setVariantStock(size: string, color: string, stock: number) {
    const next = variants.map((v) => (v.size === size && v.color === color ? { ...v, stock } : v));
    setValue('variants', next, { shouldDirty: true });
  }

  // ── Hajm bo'yicha narx (duxi) ────────────────────────────────────────
  // Narx O'LCHAMGA (hajmga) biriktiriladi, o'lcham+rang juftiga emas:
  // "50ml — 250 000" degan gap rangdan qat'i nazar o'rinli. Shuning
  // uchun o'qishda shu o'lchamdagi birinchi variant olinadi, yozishda esa
  // o'sha o'lchamdagi HAMMA variantga bir xil narx qo'yiladi.
  function getVariantPrice(size: string): number | null {
    const found = variants.find((v) => v.size === size && v.price != null);
    return found?.price ?? null;
  }

  function setVariantPrice(size: string, price: number | null) {
    const next = variants.map((v) => (v.size === size ? { ...v, price } : v));
    setValue('variants', next, { shouldDirty: true });
  }

  // "ml" yozuvidagi hajmni songa aylantiradi: "50ml" → 50. Raqam
  // topilmasa null — bunday o'lcham avtomatik hisoblashga qo'shilmaydi.
  function parseMl(size: string): number | null {
    const match = /^(\d+)\s*ml$/i.exec(size.trim());
    return match ? Number(match[1]) : null;
  }

  const totalVariantStock = variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);

  const categories = categoriesData?.categories ?? [];
  const noCategories = categories.length === 0;
  const selectedCategoryId = watch('categoryId');
  const selectedCategory = categories.find((c: any) => c.id === selectedCategoryId);
  // Toifasiga qarab: poyabzal → 36-45, aksessuar/kosmetika → bo'sh (ya'ni
  // o'lcham bo'limi umuman ko'rsatilmaydi), qolganlari → XS-XXXL. Toifa
  // hali tanlanmagan bo'lsa kiyim o'lchamlari (avvalgi xulq-atvor).
  const SIZE_OPTIONS = getSizeOptions(selectedCategory);
  const showSizes = SIZE_OPTIONS.length > 0;
  // Duxi toifasida o'lchamlar aslida HAJM (10ml, 50ml...) va har birining
  // o'z narxi bo'ladi — shu sababli pastda alohida "hajm bo'yicha narx"
  // jadvali ko'rsatiladi. Boshqa toifalarda u umuman chizilmaydi.
  const isPerfume = getCategorySizeKind(selectedCategory) === 'perfume';
  // Duxi/atirda rang tushunchasi yo'q — rang bo'limi va u bilan bog'liq
  // "rang bo'yicha rasmlar" bloki umuman ko'rsatilmaydi, rasmlar oddiy
  // "Rasmlar" bo'limidan qo'shiladi.
  const showColors = !isPerfume;

  // ── Duxi: hajmni (ml) admin o'zi yozib qo'shadi ──────────────────────
  // Tayyor ro'yxat (10ml, 20ml ... 500ml) hamma flakonni qamramaydi —
  // 3ml, 75ml, 125ml kabi hajmlar ham uchraydi. Shu maydonga son yoziladi:
  // "75", "75ml", "75 ml" — uchalasi ham bir xil tushuniladi va "75ml"
  // bo'lib qo'shiladi. Qo'shilgan hajm avtomatik ravishda quyidagi
  // "Hajm bo'yicha narx" jadvaliga ham tushadi (100ml gacha — narxi o'zi
  // hisoblanadi, yuqorisi — qo'lda).
  const [customVolume, setCustomVolume] = useState('');

  function addCustomVolume() {
    const raw = customVolume.trim().toLowerCase().replace(/\s*ml$/, '').trim();
    const ml = Number(raw);
    if (!raw || !Number.isFinite(ml) || ml <= 0) return;
    const label = `${Math.round(ml)}ml`;
    if (!sizes.includes(label)) {
      setValue('sizes', [...sizes, label], { shouldDirty: true });
    }
    setCustomVolume('');
  }

  // Ko'rsatiladigan o'lchamlar: tayyor ro'yxat + mahsulotda allaqachon bor,
  // lekin ro'yxatda yo'q o'lchamlar (ya'ni admin o'zi qo'shgan hajmlar).
  // Ilgari bunday o'lcham chiplar orasida umuman ko'rinmasdi — saqlangan,
  // lekin ekranda yo'q, o'chirib ham bo'lmaydigan holatda qolardi.
  const extraSizes = sizes.filter((s2) => !SIZE_OPTIONS.includes(s2));
  const sizeChoices = isPerfume
    ? [...SIZE_OPTIONS, ...extraSizes].sort((a, b) => (parseMl(a) ?? 0) - (parseMl(b) ?? 0))
    : [...SIZE_OPTIONS, ...extraSizes];

  // ── 100ml GACHA bo'lgan hajmlar narxi AVTOMATIK hisoblanadi ─────────
  // Asos — yuqoridagi "Narx" maydoni va u qaysi hajmga tegishli ekani
  // (`priceBaseSize`, sukut bo'yicha eng kichik tanlangan hajm). Shundan
  // 1 ml narxi chiqariladi va har bir hajmga o'z hajmiga proporsional
  // yoziladi.
  //
  // Masalan: Narx = 275 000 va u 50ml uchun bo'lsa → 1 ml = 5 500, demak
  // 10ml = 55 000, 20ml = 110 000, 30ml = 165 000, 100ml = 550 000.
  //
  // 100ml dan YUQORISI ataylab tegilmaydi — u yerda ko'proq hajm arzonroq
  // bo'lgani uchun narxni admin o'zi qo'yadi.
  const mlSizes = sizes
    .map((s2) => ({ size: s2, ml: parseMl(s2) }))
    .filter((x): x is { size: string; ml: number } => x.ml != null)
    .sort((a, b) => a.ml - b.ml);

  // Narx qaysi hajm uchun kiritilgani. Admin tanlamagan bo'lsa — eng
  // kichik hajm.
  const [priceBaseSize, setPriceBaseSize] = useState<string>('');
  const effectiveBaseSize = mlSizes.some((x) => x.size === priceBaseSize)
    ? priceBaseSize
    : (mlSizes[0]?.size ?? '');
  const basePrice = Number(watch('price')) || 0;
  const baseMl = mlSizes.find((x) => x.size === effectiveBaseSize)?.ml ?? 0;

  // Narx, asos hajm yoki hajmlar ro'yxati o'zgarganda — 100ml gachasini
  // qayta hisoblab qo'yadi. Faqat parfum toifasida ishlaydi.
  useEffect(() => {
    if (!isPerfume || baseMl <= 0 || basePrice <= 0) return;
    const pricePerMl = basePrice / baseMl;
    const current = getValues('variants') ?? [];
    const next = current.map((v) => {
      const ml = parseMl(v.size);
      if (ml == null || ml > 100) return v;
      return { ...v, price: Math.round(pricePerMl * ml) };
    });
    const changed = next.some((v, idx) => v.price !== current[idx]?.price);
    if (changed) setValue('variants', next, { shouldDirty: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPerfume, basePrice, baseMl, sizes.join(','), variants.length]);


  // Switching TO a sizeless category (or starting a new product already
  // pointed at one) clears out any sizes picked earlier — otherwise a
  // hidden, forgotten-about `sizes` value could still ride along on
  // submit even though the picker that set it is no longer on screen.
  useEffect(() => {
    if (!showSizes && sizes.length > 0) {
      setValue('sizes', [], { shouldDirty: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSizes]);

  // Xuddi shunday: parfum toifasiga o'tilganda avval tanlab qo'yilgan
  // ranglar tozalanadi. Aks holda ko'rinmay qolgan rang variantlar
  // jadvalini ikki barobar qilib yuborardi (har hajm uchun har rang) va
  // hajm narxi qaysi qatorga tegishli ekani chalkashardi.
  useEffect(() => {
    if (!showColors && colors.length > 0) {
      setValue('colors', [], { shouldDirty: true });
      setValue('colorImages', [], { shouldDirty: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showColors]);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const url = await uploadProductImage(file);
      setValue('images', [...images, url]);
    } catch {
      // eslint-disable-next-line no-alert
      alert(dict.admin.uploadError);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function toggleSize(size: string) {
    setValue('sizes', sizes.includes(size) ? sizes.filter((s) => s !== size) : [...sizes, size], {
      shouldDirty: true,
    });
  }

  // Dropping a color also drops any dedicated photos saved for it — an
  // orphaned colorImages entry for a color no longer offered would just be
  // dead data the admin can never see or manage again.
  function removeColorEntirely(name: string) {
    setValue('colors', colors.filter((c) => c !== name), { shouldDirty: true });
    setValue(
      'colorImages',
      (getValues('colorImages') ?? []).filter((ci) => ci.color !== name),
      { shouldDirty: true },
    );
  }

  function toggleColorPreset(name: string) {
    if (colors.includes(name)) {
      removeColorEntirely(name);
    } else {
      setValue('colors', [...colors, name], { shouldDirty: true });
    }
  }

  function addCustomColor() {
    const value = colorInput.trim();
    if (value && !colors.includes(value)) {
      setValue('colors', [...colors, value], { shouldDirty: true });
      setColorInput('');
    }
  }

  function addImage() {
    if (imageInput.trim()) {
      setValue('images', [...images, imageInput.trim()], { shouldDirty: true });
      setImageInput('');
    }
  }

  function getColorImages(color: string): string[] {
    return colorImages.find((ci) => ci.color === color)?.images ?? [];
  }

  // Reads/writes via getValues/setValue (not the `colorImages` watched
  // closure) so a sequence of awaited uploads for the same color — see
  // handleColorFileUpload's loop below — each see the previous one's result
  // instead of racing and dropping all but the last.
  function addColorImage(color: string, url: string) {
    const current = getValues('colorImages') ?? [];
    const idx = current.findIndex((ci) => ci.color === color);
    const next =
      idx >= 0
        ? current.map((ci, i) => (i === idx ? { ...ci, images: [...ci.images, url] } : ci))
        : [...current, { color, images: [url] }];
    setValue('colorImages', next, { shouldDirty: true });
  }

  function removeColorImage(color: string, index: number) {
    const current = getValues('colorImages') ?? [];
    const next = current.map((ci) =>
      ci.color === color ? { ...ci, images: ci.images.filter((_, i) => i !== index) } : ci,
    );
    setValue('colorImages', next, { shouldDirty: true });
  }

  // Accepts multiple files at once (input has `multiple`) and uploads them
  // one at a time to the same single-file endpoint the general images
  // uploader uses — lets the admin add 2, 3, 4, 5+ photos for a color in one
  // file-picker interaction instead of repeating the flow per photo.
  async function handleColorFileUpload(color: string, e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingColorFor(color);
    try {
      for (const file of Array.from(files)) {
        const url = await uploadProductImage(file);
        addColorImage(color, url);
      }
    } catch {
      // eslint-disable-next-line no-alert
      alert(dict.admin.uploadError);
    } finally {
      setUploadingColorFor(null);
      e.target.value = '';
    }
  }

  // Duxi: 100ml GACHA bo'lgan hajmlarning narxi yuborishdan OLDIN yana bir
  // marta hisoblab qo'yiladi.
  //
  // NEGA: yuqoridagi useEffect faqat narx/hajm o'zgarganda ishlaydi va
  // ba'zi holatlarda (masalan mahsulot tahrirga ochilib, forma qiymatlari
  // asinxron to'lganda) u ishlab ulgurmay qolishi mumkin edi — natijada
  // bazaga 10ml, 20ml ... uchun narx `null` bo'lib yozilib ketardi
  // (haqiqatda shunday bo'lgan: 150ml dan yuqorisi saqlangan, 100ml
  // gachasi bo'sh qolgan). Saqlash paytida qayta hisoblash buni butunlay
  // yo'q qiladi: yuborilayotgan ma'lumot doim to'liq bo'ladi.
  function withPerfumePrices(values: ProductFormValues): VariantValue[] {
    const list = values.variants ?? [];
    if (!isPerfume) return list;
    const base = Number(values.price) || 0;
    const volumes = (values.sizes ?? [])
      .map((s2) => parseMl(s2))
      .filter((ml): ml is number => ml != null);
    // Narx qaysi hajm uchun kiritilgan: admin tanlagani, tanlamagan bo'lsa
    // eng kichik hajm.
    const baseSizeMl = parseMl(effectiveBaseSize) ?? (volumes.length ? Math.min(...volumes) : 0);
    if (base <= 0 || baseSizeMl <= 0) return list;
    const pricePerMl = base / baseSizeMl;
    return list.map((v) => {
      const ml = parseMl(v.size);
      // 100ml dan yuqorisiga tegilmaydi — u yerda narxni admin o'zi qo'yadi
      // (ko'proq hajm arzonroq).
      if (ml == null || ml > 100) return v;
      return { ...v, price: Math.round(pricePerMl * ml) };
    });
  }

  function submitHandler(values: ProductFormValues) {
    // Convert the "no brand selected" option (empty string) to undefined —
    // an empty string is not a valid UUID and would be rejected by the
    // backend even though the field is optional.
    onSubmit({
      ...values,
      brandId: values.brandId || undefined,
      storeId: values.storeId || undefined,
      oldPrice: values.oldPrice || undefined,
      discountPercent: values.discountPercent || undefined,
      // Drop colors that ended up with no photos actually uploaded (e.g. the
      // admin opened the file picker and cancelled) instead of saving empty
      // entries.
      colorImages: (values.colorImages ?? []).filter((ci) => ci.images.length > 0),
      // Only send per-variant stock when the product actually has size/color
      // options — otherwise keep the plain "stock" number the admin typed.
      // (An empty array, not undefined: ProductFormValues.variants isn't
      // optional, and the backend already treats an empty/missing variants
      // list the same way — falls back to the plain `stock` number.)
      variants: hasVariantGrid ? withPerfumePrices(values) : [],
      stock: hasVariantGrid ? totalVariantStock : values.stock,
    });
  }

  return (
    <form onSubmit={handleSubmit(submitHandler)} className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        {/* ── Basic info ── */}
        <div className="card-surface space-y-4 p-6">
          <h3 className="text-xs font-bold uppercase tracking-wider text-ink-900/50">{dict.admin.basicInfo}</h3>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-ink-900/60">
                {dict.admin.titleUzLabel}
                <Required />
              </label>
              <input
                {...register('title', {
                  required: dict.admin.titleRequired,
                  minLength: { value: 2, message: dict.admin.titleMinLength },
                })}
                className="w-full rounded-xl border border-ink-900/15 px-4 py-3 text-sm outline-none focus:border-ink-950"
              />
              <FieldError message={errors.title?.message} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-ink-900/60">{dict.admin.titleRuLabel}</label>
              <input
                {...register('titleRu')}
                className="w-full rounded-xl border border-ink-900/15 px-4 py-3 text-sm outline-none focus:border-ink-950"
              />
              <p className="mt-1 text-xs text-ink-900/40">{dict.admin.titleRuHint}</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-ink-900/60">{dict.admin.descriptionUzLabel}</label>
              <textarea
                {...register('description')}
                rows={4}
                placeholder={dict.admin.descriptionUzPlaceholder}
                className="w-full rounded-xl border border-ink-900/15 px-4 py-3 text-sm outline-none focus:border-ink-950"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-ink-900/60">{dict.admin.descriptionRuLabel}</label>
              <textarea
                {...register('descriptionRu')}
                rows={4}
                className="w-full rounded-xl border border-ink-900/15 px-4 py-3 text-sm outline-none focus:border-ink-950"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-ink-900/60">
              {dict.admin.skuLabel}
              <Required />
            </label>
            <input
              {...register('sku', { required: dict.admin.skuRequired })}
              placeholder="TSH-001"
              className="w-full rounded-xl border border-ink-900/15 px-4 py-3 text-sm outline-none focus:border-ink-950"
            />
            <p className="mt-1 text-xs text-ink-900/40">{dict.admin.skuHint}</p>
            <FieldError message={errors.sku?.message} />
          </div>
        </div>

        {/* ── Rasmlar ── */}
        <div className="card-surface space-y-4 p-6">
          <h3 className="text-xs font-bold uppercase tracking-wider text-ink-900/50">{dict.admin.images}</h3>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
            id="product-image-upload"
          />
          <label
            htmlFor="product-image-upload"
            className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-ink-900/15 py-6 text-sm font-semibold text-ink-900/60 transition-colors hover:border-ink-950 hover:text-ink-950"
          >
            <UploadCloud size={18} />
            {uploading ? dict.admin.uploading : dict.admin.uploadFromComputer}
          </label>

          <div className="flex gap-2">
            <input
              value={imageInput}
              onChange={(e) => setImageInput(e.target.value)}
              placeholder={dict.admin.imageUrlPlaceholder}
              className="flex-1 rounded-xl border border-ink-900/15 px-4 py-3 text-sm outline-none focus:border-ink-950"
            />
            <button type="button" onClick={addImage} className="btn-outline !px-4">
              {dict.admin.addButton}
            </button>
          </div>

          {images.length === 0 ? (
            <p className="text-xs text-ink-900/40">{dict.admin.noImagesYet}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {images.map((img, i) => (
                <span key={img + i} className="flex items-center gap-2 rounded-full bg-ink-900/5 px-3 py-1.5 text-xs">
                  <span className="max-w-[160px] truncate">{img}</span>
                  <button
                    type="button"
                    onClick={() => setValue('images', images.filter((_, idx) => idx !== i))}
                    className="text-ink-900/40 hover:text-red-500"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ── O'lcham va rang ── */}
        <div className="card-surface space-y-5 p-6">
          {showSizes ? (
            <div>
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-ink-900/50">
                {dict.product.size} — {dict.admin.sizesHint}
              </h3>
              <div className="flex flex-wrap gap-2">
                {sizeChoices.map((size) => (
                  <button
                    type="button"
                    key={size}
                    onClick={() => toggleSize(size)}
                    className={`h-10 min-w-10 rounded-lg border px-3 text-sm font-semibold transition-colors ${
                      sizes.includes(size) ? 'border-ink-950 bg-ink-950 text-cream' : 'border-ink-900/15 hover:border-ink-950'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>

              {/* Ro'yxatda yo'q hajmni qo'shish (faqat duxi toifasida).
                  Enter bosilganda formani YUBORMAYDI — type="button" va
                  onKeyDown ichidagi preventDefault shuning uchun: aks holda
                  hajm qo'shmoqchi bo'lgan admin tasodifan mahsulotni
                  saqlab yuborardi. */}
              {isPerfume && (
                <div className="mt-3">
                  <label className="mb-1.5 block text-xs font-semibold text-ink-900/60">
                    Ro'yxatda yo'q hajmni qo'shish
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={customVolume}
                      placeholder="masalan: 75"
                      onChange={(e) => setCustomVolume(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addCustomVolume();
                        }
                      }}
                      className="w-40 rounded-lg border border-ink-900/15 px-3 py-2 text-sm outline-none focus:border-ink-950"
                    />
                    <button
                      type="button"
                      onClick={addCustomVolume}
                      className="rounded-lg border border-ink-950 bg-ink-950 px-4 text-sm font-semibold text-cream transition-opacity hover:opacity-90"
                    >
                      Qo'shish
                    </button>
                  </div>
                  <p className="mt-1.5 text-xs text-ink-900/50">
                    Faqat sonni yozing — "ml" o'zi qo'shiladi. Qo'shilgan hajm pastdagi
                    "Hajm bo'yicha narx" jadvaliga ham tushadi.
                  </p>
                </div>
              )}
            </div>
          ) : (
            // Aksessuar/kosmetika kabi toifalarda kiyim/poyabzal o'lchami
            // umuman mavjud emas — shu sababli bu yerda tanlov ko'rsatmay,
            // faqat qisqa izoh beriladi.
            <p className="text-xs text-ink-900/40">{dict.admin.noSizeForCategory}</p>
          )}

          {/* Duxi/atirda rang tushunchasi yo'q — flakon rangi mahsulotni
              ajratmaydi. Avval bu bo'lim har doim ko'rinardi va rasm
              qo'shish uchun avval rang tanlash kerakdek tuyulardi ("Rang
              bo'yicha rasmlar" bloki faqat rang tanlangandan keyin
              ochilgani uchun). Endi parfum toifasida rang bo'limi umuman
              chizilmaydi va rasmlar oddiygina "Rasmlar" bo'limidan
              qo'shiladi. */}
          {showColors && (
          <div>
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-ink-900/50">
              {dict.product.color} — {dict.admin.colorsHint}
            </h3>
            <div className="flex flex-wrap gap-3">
              {COLOR_PRESETS.map((color) => (
                <button
                  type="button"
                  key={color.name}
                  onClick={() => toggleColorPreset(color.name)}
                  title={color.name}
                  className="flex flex-col items-center gap-1.5"
                >
                  <span
                    style={{ backgroundColor: color.hex }}
                    className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition-transform hover:scale-110 ${
                      colors.includes(color.name) ? 'border-gold-500 ring-2 ring-gold-500/40' : 'border-ink-900/10'
                    }`}
                  >
                    {colors.includes(color.name) && (
                      <span className="text-xs font-bold" style={{ color: color.hex === '#f7f5f2' ? '#111114' : '#f7f5f2' }}>
                        ✓
                      </span>
                    )}
                  </span>
                  <span className="text-[10px] text-ink-900/50">{color.name}</span>
                </button>
              ))}
            </div>

            <div className="mt-4 flex gap-2">
              <input
                value={colorInput}
                onChange={(e) => setColorInput(e.target.value)}
                placeholder={dict.admin.customColorPlaceholder}
                className="flex-1 rounded-xl border border-ink-900/15 px-4 py-3 text-sm outline-none focus:border-ink-950"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addCustomColor();
                  }
                }}
              />
              <button type="button" onClick={addCustomColor} className="btn-outline !px-4">
                {dict.admin.addButton}
              </button>
            </div>

            {colors.filter((c) => !COLOR_PRESETS.some((p) => p.name === c)).length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {colors
                  .filter((c) => !COLOR_PRESETS.some((p) => p.name === c))
                  .map((c, i) => (
                    <span key={c + i} className="flex items-center gap-2 rounded-full bg-ink-900/5 px-3 py-1.5 text-xs">
                      {c}
                      <button
                        type="button"
                        onClick={() => removeColorEntirely(c)}
                        className="text-ink-900/40 hover:text-red-500"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
              </div>
            )}

            {/* ── Rang bo'yicha rasmlar ── */}
            {colors.length > 0 && (
              <div className="mt-6 space-y-4 border-t border-ink-900/10 pt-5">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-ink-900/50">
                    {dict.admin.colorImagesTitle}
                  </h3>
                  <p className="mt-1 text-xs text-ink-900/40">{dict.admin.colorImagesHint}</p>
                </div>

                {colors.map((c) => {
                  const preset = COLOR_PRESETS.find((p) => p.name === c);
                  const imgs = getColorImages(c);
                  return (
                    <div key={c} className="rounded-xl border border-ink-900/10 p-4">
                      <div className="mb-3 flex items-center gap-2">
                        {preset && (
                          <span
                            className="h-4 w-4 shrink-0 rounded-full border border-ink-900/10"
                            style={{ backgroundColor: preset.hex }}
                          />
                        )}
                        <span className="text-sm font-semibold">{c}</span>
                      </div>

                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(e) => handleColorFileUpload(c, e)}
                        className="hidden"
                        id={`color-image-upload-${c}`}
                      />
                      <label
                        htmlFor={`color-image-upload-${c}`}
                        className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-ink-900/15 py-4 text-xs font-semibold text-ink-900/60 transition-colors hover:border-ink-950 hover:text-ink-950"
                      >
                        <UploadCloud size={16} />
                        {uploadingColorFor === c ? dict.admin.uploading : dict.admin.uploadFromComputer}
                      </label>

                      {imgs.length === 0 ? (
                        <p className="mt-2 text-xs text-ink-900/40">{dict.admin.noColorImagesYet}</p>
                      ) : (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {imgs.map((img, i) => (
                            <div
                              key={img + i}
                              className="relative h-16 w-16 overflow-hidden rounded-lg border border-ink-900/10"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element -- admin
                                  thumbnail grid, arbitrary count/URLs, no need for next/image here */}
                              <img src={img} alt={`${c} ${i + 1}`} className="h-full w-full object-cover" />
                              <button
                                type="button"
                                onClick={() => removeColorImage(c, i)}
                                className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-ink-950/70 text-[10px] text-white hover:bg-red-500"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          )}
        </div>

        {/* ── Zaxira: o'lcham/rangga ko'ra ── */}
        {hasVariantGrid && (
          <div className="card-surface space-y-3 p-6">
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink-900/50">{dict.admin.variantStockTitle}</h3>
            <p className="text-xs text-ink-900/50">{dict.admin.variantStockHint}</p>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-sm">
                <thead>
                  <tr>
                    <th className="px-2 py-2 text-left text-xs font-semibold text-ink-900/40">
                      {sizes.length > 0 && colors.length > 0 ? `${dict.product.size} / ${dict.product.color}` : ''}
                    </th>
                    {(colors.length ? colors : [dict.admin.stock]).map((c) => (
                      <th key={c} className="px-2 py-2 text-center text-xs font-semibold text-ink-900/60">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(sizes.length ? sizes : [dict.admin.stock]).map((s) => (
                    <tr key={s}>
                      <td className="px-2 py-1.5 text-xs font-semibold text-ink-900/60">{sizes.length ? s : ''}</td>
                      {(colors.length ? colors : ['']).map((c) => {
                        const rowKey = sizes.length ? s : '';
                        const colKey = colors.length ? c : '';
                        return (
                          <td key={c} className="px-2 py-1.5">
                            <input
                              type="number"
                              min={0}
                              value={getVariantStock(rowKey, colKey)}
                              onChange={(e) => setVariantStock(rowKey, colKey, Math.max(0, Number(e.target.value) || 0))}
                              className="w-20 rounded-lg border border-ink-900/15 px-2 py-1.5 text-center text-sm outline-none focus:border-ink-950"
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-ink-900/50">
              {dict.admin.stock}: <span className="font-semibold text-ink-900">{totalVariantStock}</span>
            </p>

            {/* ── Hajm bo'yicha narx — faqat duxi toifasida ──────────────
                100ml GACHA bo'lgan hajmlar yuqoridagi "Narx" maydonidan
                AVTOMATIK hisoblanadi, shuning uchun ular faqat ko'rsatish
                uchun (tahrirlab bo'lmaydi) — narxni o'zgartirish uchun
                "Narx"ni yoki uning qaysi hajmga tegishli ekanini
                o'zgartirasiz. 100ml dan yuqorisi qo'lda kiritiladi,
                chunki ko'proq hajmni arzonroqqa berasiz. */}
            {isPerfume && mlSizes.length > 0 && (
              <div className="space-y-3 border-t border-ink-900/10 pt-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-ink-900/50">
                  Hajm bo'yicha narx
                </h4>

                <label className="flex flex-wrap items-center gap-2 text-xs text-ink-900/60">
                  Yuqoridagi narx qaysi hajm uchun?
                  <select
                    value={effectiveBaseSize}
                    onChange={(e) => setPriceBaseSize(e.target.value)}
                    className="rounded-lg border border-ink-900/15 px-2 py-1.5 text-sm outline-none focus:border-ink-950"
                  >
                    {mlSizes.map((x) => (
                      <option key={x.size} value={x.size}>
                        {x.size}
                      </option>
                    ))}
                  </select>
                </label>

                <p className="text-xs text-ink-900/50">
                  100ml gacha bo'lgan hajmlar shu narxdan o'zi hisoblanadi (masalan
                  10ml = 275 000 bo'lsa, 20ml = 550 000, 30ml = 825 000). 100ml dan
                  yuqorisini o'zingiz kiritasiz — bo'sh qoldirsangiz, u ham shu
                  nisbatda hisoblanadi.
                </p>

                <div className="grid gap-2 sm:grid-cols-2">
                  {mlSizes.map(({ size: s2, ml }) => {
                    const auto = ml <= 100;
                    // Hisoblangan qiymat maydonda DARHOL ko'rinib tursin —
                    // forma holatiga yozilishini kutib turmasdan. Admin
                    // saqlashdan oldin qaysi hajm qanchaga tushishini
                    // ko'rib tura oladi.
                    const computed =
                      baseMl > 0 && basePrice > 0 ? Math.round((basePrice / baseMl) * ml) : null;
                    const shown = auto ? (getVariantPrice(s2) ?? computed) : getVariantPrice(s2);
                    return (
                      <label key={s2} className="flex items-center gap-2 text-sm">
                        <span className="w-16 shrink-0 text-xs font-semibold text-ink-900/60">{s2}</span>
                        <input
                          type="number"
                          min={0}
                          step="1000"
                          readOnly={auto}
                          placeholder={auto ? '' : (computed != null ? String(computed) : 'umumiy narx')}
                          value={shown ?? ''}
                          onChange={(e) => {
                            if (auto) return;
                            const raw = e.target.value.trim();
                            setVariantPrice(s2, raw === '' ? null : Math.max(0, Number(raw) || 0));
                          }}
                          className={`w-full rounded-lg border px-2 py-1.5 text-sm outline-none ${
                            auto
                              ? 'cursor-not-allowed border-ink-900/10 bg-ink-900/5 text-ink-900/60'
                              : 'border-ink-900/15 focus:border-ink-950'
                          }`}
                        />
                        {auto && <span className="shrink-0 text-[10px] text-ink-900/40">avto</span>}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {totalVariantStock === 0 && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
                {dict.admin.variantStockZeroWarning}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="space-y-5">
        {/* ── Pricing & stock ── */}
        <div className="card-surface space-y-4 p-6">
          <h3 className="text-xs font-bold uppercase tracking-wider text-ink-900/50">{dict.admin.pricingSection}</h3>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-ink-900/60">
              {dict.admin.price}
              <Required />
            </label>
            <input
              type="number"
              step="0.01"
              min={0}
              {...register('price', {
                required: dict.admin.priceRequired,
                valueAsNumber: true,
                min: { value: 0, message: dict.admin.priceMin },
              })}
              className="w-full rounded-xl border border-ink-900/15 px-4 py-3 text-sm outline-none focus:border-ink-950"
            />
            <FieldError message={errors.price?.message} />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-ink-900/60">{dict.admin.oldPrice}</label>
            <input
              type="number"
              step="0.01"
              min={0}
              {...register('oldPrice', { valueAsNumber: true })}
              className="w-full rounded-xl border border-ink-900/15 px-4 py-3 text-sm outline-none focus:border-ink-950"
            />
            <p className="mt-1 text-xs text-ink-900/40">{dict.admin.discountHint}</p>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-ink-900/60">{dict.admin.discount}</label>
            <input
              type="number"
              min={0}
              max={100}
              {...register('discountPercent', { valueAsNumber: true })}
              className="w-full rounded-xl border border-ink-900/15 px-4 py-3 text-sm outline-none focus:border-ink-950"
            />
            <p className="mt-1 text-xs text-ink-900/40">{dict.admin.optionalField}</p>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-ink-900/60">
              {dict.admin.stock}
              {!hasVariantGrid && <Required />}
            </label>
            {hasVariantGrid ? (
              <div className="w-full rounded-xl border border-ink-900/10 bg-ink-900/5 px-4 py-3 text-sm text-ink-900/60">
                {totalVariantStock} — {dict.admin.variantStockAutoHint}
              </div>
            ) : (
              <>
                <input
                  type="number"
                  min={0}
                  {...register('stock', {
                    required: dict.admin.stockRequired,
                    valueAsNumber: true,
                    min: { value: 0, message: dict.admin.stockMin },
                  })}
                  className="w-full rounded-xl border border-ink-900/15 px-4 py-3 text-sm outline-none focus:border-ink-950"
                />
                <FieldError message={errors.stock?.message} />
              </>
            )}
          </div>
        </div>

        {/* ── Category & brand ── */}
        <div className="card-surface space-y-4 p-6">
          <h3 className="text-xs font-bold uppercase tracking-wider text-ink-900/50">{dict.admin.categoryBrandSection}</h3>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-ink-900/60">
              {dict.product.category}
              <Required />
            </label>
            <select
              {...register('categoryId', { required: dict.admin.categoryRequired })}
              className="w-full rounded-xl border border-ink-900/15 px-4 py-3 text-sm outline-none focus:border-ink-950"
            >
              <option value="">{dict.admin.selectPlaceholder}</option>
              {categories.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {noCategories && <p className="mt-1 text-xs font-medium text-amber-600">{dict.admin.noCategoriesYet}</p>}
            <FieldError message={errors.categoryId?.message} />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-ink-900/60">{dict.product.brand}</label>
            <select
              {...register('brandId')}
              className="w-full rounded-xl border border-ink-900/15 px-4 py-3 text-sm outline-none focus:border-ink-950"
            >
              <option value="">{dict.admin.noneOption}</option>
              {brandsData?.brands?.map((b: any) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-ink-900/40">{dict.admin.optionalField}</p>
          </div>

          {/* Magazin (tashqi do'kon) — faqat admin ko'radi, saytda chiqmaydi */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-ink-900/60">{dict.admin.storeLabel}</label>
            <select
              {...register('storeId')}
              className="w-full rounded-xl border border-ink-900/15 px-4 py-3 text-sm outline-none focus:border-ink-950"
            >
              <option value="">{dict.admin.noneOption}</option>
              {storesData?.stores?.map((s: any) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-ink-900/40">{dict.admin.storeHint}</p>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-ink-900/60">{dict.product.gender}</label>
            {/* Brend select'i bilan bir xil naqsh: ro'yxat admin/categories
                sahifasida admin o'zi yaratgan yozuvlardan keladi — qattiq
                belgilangan qiymatlar yo'q. */}
            <select
              {...register('genderId')}
              className="w-full rounded-xl border border-ink-900/15 px-4 py-3 text-sm outline-none focus:border-ink-950"
            >
              <option value="">{dict.admin.noneOption}</option>
              {gendersData?.genders?.map((g: any) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          {/* Avval bu oddiy `<input type="checkbox">` edi va unga
              `accent-ink-950` (qora rang) berilgan edi — admin panelning
              foni ham qora bo'lgani uchun quti fonga qo'shilib, ko'zga
              umuman ko'rinmay ketgan. Endi Checkbox komponenti orqali
              chiziladi: belgilanmaganda aniq chegarali quti,
              belgilanganda yashil fon + oq ✓. */}
          <label className="flex cursor-pointer items-center gap-2.5 text-sm">
            <Checkbox {...register('isFeatured')} />
            {dict.admin.featuredLabel}
          </label>
        </div>

        <button type="submit" disabled={submitting} className="btn-primary w-full disabled:opacity-50">
          {submitting ? dict.admin.saving : dict.admin.save}
        </button>
      </div>
    </form>
  );
}
