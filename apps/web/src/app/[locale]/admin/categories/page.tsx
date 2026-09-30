'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { Plus, Trash2, Pencil, Check, X } from 'lucide-react';
import { GET_CATEGORIES, GET_BRANDS, GET_GENDERS } from '@/lib/graphql/queries';
import { CREATE_CATEGORY, CREATE_BRAND, CREATE_GENDER, UPDATE_CATEGORY } from '@/lib/graphql/mutations';
import { gql } from '@apollo/client';
import type { Locale } from '@/i18n/config';
import uzDict from '@/i18n/dictionaries/uz.json';
import ruDict from '@/i18n/dictionaries/ru.json';

const REMOVE_CATEGORY = gql`
  mutation RemoveCategory($id: ID!) {
    removeCategory(id: $id)
  }
`;
const REMOVE_BRAND = gql`
  mutation RemoveBrand($id: ID!) {
    removeBrand(id: $id)
  }
`;
const REMOVE_GENDER = gql`
  mutation RemoveGender($id: ID!) {
    removeGender(id: $id)
  }
`;

export default function AdminCategoriesPage({ params }: { params: { locale: Locale } }) {
  const { locale } = params;
  const dict = locale === 'ru' ? ruDict : uzDict;

  const {
    data: categoriesData,
    loading: categoriesLoading,
    refetch: refetchCategories,
  } = useQuery(GET_CATEGORIES);
  const { data: brandsData, loading: brandsLoading, refetch: refetchBrands } = useQuery(GET_BRANDS);
  const { data: gendersData, loading: gendersLoading, refetch: refetchGenders } = useQuery(GET_GENDERS);

  const [createCategory] = useMutation(CREATE_CATEGORY);
  const [updateCategory] = useMutation(UPDATE_CATEGORY);
  const [createBrand] = useMutation(CREATE_BRAND);
  const [createGender] = useMutation(CREATE_GENDER);
  const [removeCategory] = useMutation(REMOVE_CATEGORY);
  const [removeBrand] = useMutation(REMOVE_BRAND);
  const [removeGender] = useMutation(REMOVE_GENDER);

  const [categoryName, setCategoryName] = useState('');
  const [categoryNameRu, setCategoryNameRu] = useState('');
  const [brandName, setBrandName] = useState('');
  const [genderName, setGenderName] = useState('');
  const [genderNameRu, setGenderNameRu] = useState('');

  // Inline editing for an existing category's name/nameRu — added because
  // categories previously could only be typed once at creation with no way
  // to fix a typo or a name entered in the wrong language (e.g. Russian
  // text typed into the Uzbek `name` field, which then showed up as
  // Russian everywhere even on the Uzbek locale).
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editNameRu, setEditNameRu] = useState('');

  async function handleAddCategory() {
    if (!categoryName.trim()) return;
    await createCategory({
      variables: { input: { name: categoryName.trim(), nameRu: categoryNameRu.trim() || undefined } },
    });
    setCategoryName('');
    setCategoryNameRu('');
    refetchCategories();
  }

  function startEditCategory(cat: { id: string; name: string; nameRu?: string | null }) {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditNameRu(cat.nameRu ?? '');
  }

  async function handleSaveCategory(id: string) {
    if (!editName.trim()) return;
    await updateCategory({
      variables: { id, input: { name: editName.trim(), nameRu: editNameRu.trim() || undefined } },
    });
    setEditingId(null);
    refetchCategories();
  }

  async function handleAddBrand() {
    if (!brandName.trim()) return;
    await createBrand({ variables: { input: { name: brandName.trim() } } });
    setBrandName('');
    refetchBrands();
  }

  async function handleAddGender() {
    if (!genderName.trim()) return;
    await createGender({
      variables: { input: { name: genderName.trim(), nameRu: genderNameRu.trim() || undefined } },
    });
    setGenderName('');
    setGenderNameRu('');
    refetchGenders();
  }

  // Gate on the very first load of either query only — once both have
  // loaded once, a create/delete's refetch keeps showing the existing lists
  // instead of the page blanking out.
  if ((!categoriesData && categoriesLoading) || (!brandsData && brandsLoading) || (!gendersData && gendersLoading)) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink-900/10 border-t-ink-950" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="section-title">
        {dict.admin.categories} & {dict.admin.brands} & {dict.admin.genders}
      </h1>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card-surface space-y-4 p-6">
          <h2 className="text-sm font-bold uppercase tracking-wider">{dict.admin.categories}</h2>
          <div className="flex flex-wrap gap-2">
            <input
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              placeholder={dict.admin.categoryNamePlaceholder}
              className="flex-1 rounded-xl border border-ink-900/15 px-4 py-3 text-sm text-ink-950 outline-none focus:border-ink-950 dark:border-cream/15 dark:bg-ink-900 dark:text-cream dark:placeholder:text-cream/40 dark:focus:border-cream"
            />
            <input
              value={categoryNameRu}
              onChange={(e) => setCategoryNameRu(e.target.value)}
              placeholder={dict.admin.categoryNameRuPlaceholder}
              className="flex-1 rounded-xl border border-ink-900/15 px-4 py-3 text-sm text-ink-950 outline-none focus:border-ink-950 dark:border-cream/15 dark:bg-ink-900 dark:text-cream dark:placeholder:text-cream/40 dark:focus:border-cream"
            />
            <button onClick={handleAddCategory} className="btn-primary !px-4">
              <Plus size={16} />
            </button>
          </div>
          <div className="space-y-2">
            {categoriesData?.categories?.map((cat: any) =>
              editingId === cat.id ? (
                <div
                  key={cat.id}
                  className="flex flex-wrap items-center gap-2 rounded-xl border border-ink-900/10 px-4 py-3 text-sm dark:border-cream/10"
                >
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder={dict.admin.categoryNamePlaceholder}
                    className="min-w-0 flex-1 rounded-lg border border-ink-900/15 px-3 py-2 text-sm text-ink-950 outline-none focus:border-ink-950 dark:border-cream/15 dark:bg-ink-900 dark:text-cream dark:placeholder:text-cream/40 dark:focus:border-cream"
                  />
                  <input
                    value={editNameRu}
                    onChange={(e) => setEditNameRu(e.target.value)}
                    placeholder={dict.admin.categoryNameRuPlaceholder}
                    className="min-w-0 flex-1 rounded-lg border border-ink-900/15 px-3 py-2 text-sm text-ink-950 outline-none focus:border-ink-950 dark:border-cream/15 dark:bg-ink-900 dark:text-cream dark:placeholder:text-cream/40 dark:focus:border-cream"
                  />
                  <button onClick={() => handleSaveCategory(cat.id)} className="text-emerald-600 hover:text-emerald-700">
                    <Check size={16} />
                  </button>
                  <button onClick={() => setEditingId(null)} className="text-ink-900/40 hover:text-ink-950 dark:text-cream/40 dark:hover:text-cream">
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <div
                  key={cat.id}
                  className="flex items-center justify-between rounded-xl border border-ink-900/5 px-4 py-3 text-sm dark:border-cream/10"
                >
                  <div>
                    <span>{cat.name}</span>
                    {cat.nameRu && <span className="ml-2 text-xs text-ink-900/40 dark:text-cream/40">({cat.nameRu})</span>}
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => startEditCategory(cat)}
                      className="text-ink-900/30 hover:text-ink-950 dark:text-cream/30 dark:hover:text-cream"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={async () => {
                        await removeCategory({ variables: { id: cat.id } });
                        refetchCategories();
                      }}
                      className="text-ink-900/30 hover:text-red-500 dark:text-cream/30"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ),
            )}
          </div>
        </div>

        <div className="card-surface space-y-4 p-6">
          <h2 className="text-sm font-bold uppercase tracking-wider">{dict.admin.brands}</h2>
          <div className="flex gap-2">
            <input
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              placeholder={dict.admin.brandNamePlaceholder}
              className="flex-1 rounded-xl border border-ink-900/15 px-4 py-3 text-sm text-ink-950 outline-none focus:border-ink-950 dark:border-cream/15 dark:bg-ink-900 dark:text-cream dark:placeholder:text-cream/40 dark:focus:border-cream"
            />
            <button onClick={handleAddBrand} className="btn-primary !px-4">
              <Plus size={16} />
            </button>
          </div>
          <div className="space-y-2">
            {brandsData?.brands?.map((brand: any) => (
              <div key={brand.id} className="flex items-center justify-between rounded-xl border border-ink-900/5 px-4 py-3 text-sm">
                <span>{brand.name}</span>
                <button
                  onClick={async () => {
                    await removeBrand({ variables: { id: brand.id } });
                    refetchBrands();
                  }}
                  className="text-ink-900/30 hover:text-red-500"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Brend bilan bir xil naqsh: admin shu yerda nom kiritib o'zi
            yaratadi (masalan "Erkaklar", "Ayollar"), keyin tovar
            qo'shish/tahrirlash formasida shu ro'yxatdan tanlanadi. */}
        <div className="card-surface space-y-4 p-6">
          <h2 className="text-sm font-bold uppercase tracking-wider">{dict.admin.genders}</h2>
          {/* Category kartasidagi bilan bir xil: o'zbekcha nom (majburiy) +
              ruscha nom (ixtiyoriy) — shunda ruscha sahifada "Erkaklar"
              o'rniga "Мужчинам" ko'rinadi. */}
          <div className="flex flex-wrap gap-2">
            <input
              value={genderName}
              onChange={(e) => setGenderName(e.target.value)}
              placeholder={dict.admin.genderNamePlaceholder}
              className="flex-1 rounded-xl border border-ink-900/15 px-4 py-3 text-sm text-ink-950 outline-none focus:border-ink-950 dark:border-cream/15 dark:bg-ink-900 dark:text-cream dark:placeholder:text-cream/40 dark:focus:border-cream"
            />
            <input
              value={genderNameRu}
              onChange={(e) => setGenderNameRu(e.target.value)}
              placeholder={dict.admin.genderNameRuPlaceholder}
              className="flex-1 rounded-xl border border-ink-900/15 px-4 py-3 text-sm text-ink-950 outline-none focus:border-ink-950 dark:border-cream/15 dark:bg-ink-900 dark:text-cream dark:placeholder:text-cream/40 dark:focus:border-cream"
            />
            <button onClick={handleAddGender} className="btn-primary !px-4">
              <Plus size={16} />
            </button>
          </div>
          <div className="space-y-2">
            {gendersData?.genders?.map((gender: any) => (
              <div key={gender.id} className="flex items-center justify-between rounded-xl border border-ink-900/5 px-4 py-3 text-sm dark:border-cream/10">
                <div>
                  <span>{gender.name}</span>
                  {gender.nameRu && <span className="ml-2 text-xs text-ink-900/40 dark:text-cream/40">({gender.nameRu})</span>}
                </div>
                <button
                  onClick={async () => {
                    await removeGender({ variables: { id: gender.id } });
                    refetchGenders();
                  }}
                  className="text-ink-900/30 hover:text-red-500 dark:text-cream/30"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
