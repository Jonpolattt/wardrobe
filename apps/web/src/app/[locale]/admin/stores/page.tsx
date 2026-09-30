'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation } from '@apollo/client';
import { Plus, Trash2, Store as StoreIcon, ShoppingBag, TrendingUp, AlertTriangle, ChevronRight, Search } from 'lucide-react';
import { GET_STORES_STATS } from '@/lib/graphql/queries';
import { CREATE_STORE, REMOVE_STORE } from '@/lib/graphql/mutations';
import { formatPrice } from '@/lib/utils/format';
import type { Locale } from '@/i18n/config';
import uzDict from '@/i18n/dictionaries/uz.json';
import ruDict from '@/i18n/dictionaries/ru.json';

// "Magazinlar" — tashqi do'konlar (masalan, Ko'k Saroy bozoridagi
// magazinlar). Har bir magazin kartochkasida uning raqamlari ko'rinadi
// (tovar soni, sotilgani, kam qolgani, tushumi) va kartochkani bosib
// magazinning ichki sahifasiga o'tiladi. Bularning barchasi FAQAT admin
// panelda ko'rinadi.
export default function AdminStoresPage({ params }: { params: { locale: Locale } }) {
  const { locale } = params;
  const dict = locale === 'ru' ? ruDict : uzDict;

  // cache-and-network: sahifaga har qaytib kelganda keshdan darhol
  // ko'rsatadi-yu, orqa fonda serverdan yangi raqamlarni ham olib keladi —
  // tovar qo'shib qaytganda F5 bosish shart emas.
  const { data, loading, refetch } = useQuery(GET_STORES_STATS, { fetchPolicy: 'cache-and-network' });

  const [createStore] = useMutation(CREATE_STORE);
  const [removeStore] = useMutation(REMOVE_STORE);

  const [storeName, setStoreName] = useState('');
  // Ro'yxat client tomonda filtrlanadi — magazinlar soni odatda kam
  // bo'lgani uchun alohida server so'rovi shart emas.
  const [search, setSearch] = useState('');

  async function handleAddStore() {
    if (!storeName.trim()) return;
    await createStore({ variables: { input: { name: storeName.trim() } } });
    setStoreName('');
    refetch();
  }

  async function handleRemove(e: React.MouseEvent, id: string) {
    // Kartochkaning o'zi Link — o'chirish tugmasi sahifaga o'tib
    // ketmasligi uchun bosishni shu yerda to'xtatamiz.
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(dict.admin.delete + '?')) return;
    await removeStore({ variables: { id } });
    refetch();
  }

  if (!data && loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink-900/10 border-t-ink-950" />
      </div>
    );
  }

  const stores = data?.storesStats ?? [];
  const filteredStores = stores.filter((s: any) =>
    s.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="section-title">{dict.admin.stores}</h1>
        <div className="relative">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-900/40" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={dict.admin.storeSearchPlaceholder}
            className="rounded-full border border-ink-900/15 bg-white py-2 pl-8 pr-4 text-xs text-ink-950 outline-none dark:border-white/15 dark:bg-ink-800 dark:text-cream dark:placeholder:text-cream/40"
          />
        </div>
      </div>
      <p className="max-w-3xl text-sm text-ink-900/50">{dict.admin.storesHint}</p>

      {/* Yangi magazin qo'shish */}
      <div className="card-surface max-w-2xl space-y-3 p-6">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider">
          <StoreIcon size={16} />
          {dict.admin.addStore}
        </h2>
        <div className="flex gap-2">
          <input
            value={storeName}
            onChange={(e) => setStoreName(e.target.value)}
            placeholder={dict.admin.storeNamePlaceholder}
            className="flex-1 rounded-xl border border-ink-900/15 px-4 py-3 text-sm outline-none focus:border-ink-950"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddStore();
              }
            }}
          />
          <button onClick={handleAddStore} className="btn-primary !px-4">
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* Magazin kartochkalari */}
      {stores.length === 0 ? (
        <p className="text-sm text-ink-900/40">{dict.admin.noStoresYet}</p>
      ) : filteredStores.length === 0 ? (
        <p className="text-sm text-ink-900/40">{dict.product.noResults}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredStores.map((s: any) => (
            <Link
              key={s.id}
              href={`/${locale}/admin/stores/${s.id}`}
              className="card-surface group relative block space-y-4 p-6 transition-shadow hover:shadow-lg"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-ink-950 text-cream">
                    <StoreIcon size={18} />
                  </span>
                  <div>
                    <p className="font-semibold">{s.name}</p>
                    <p className="text-xs text-ink-900/40">
                      {dict.admin.revenueTotal}: <span className="font-semibold text-ink-900/70">{formatPrice(s.revenue, locale)}</span>
                    </p>
                    <p className="text-xs text-emerald-600/70">
                      {dict.admin.myShare} ({s.commissionPercent}%):{' '}
                      <span className="font-semibold text-emerald-700">{formatPrice(s.myShare, locale)}</span>
                    </p>
                  </div>
                </div>
                <button
                  onClick={(e) => handleRemove(e, s.id)}
                  className="text-ink-900/25 transition-colors hover:text-red-500"
                  title={dict.admin.delete}
                >
                  <Trash2 size={15} />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-ink-900/5 px-2 py-2.5">
                  <p className="flex items-center justify-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-ink-900/40">
                    <ShoppingBag size={11} />
                    {dict.admin.products}
                  </p>
                  <p className="text-lg font-bold">{s.totalProducts}</p>
                </div>
                <div className="rounded-xl bg-emerald-50 px-2 py-2.5">
                  <p className="flex items-center justify-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700/70">
                    <TrendingUp size={11} />
                    {dict.admin.unitsSold}
                  </p>
                  <p className="text-lg font-bold text-emerald-700">{s.totalSold}</p>
                </div>
                <div className={`rounded-xl px-2 py-2.5 ${s.lowStockCount > 0 ? 'bg-red-50' : 'bg-ink-900/5'}`}>
                  <p
                    className={`flex items-center justify-center gap-1 text-[10px] font-semibold uppercase tracking-wide ${
                      s.lowStockCount > 0 ? 'text-red-600/70' : 'text-ink-900/40'
                    }`}
                  >
                    <AlertTriangle size={11} />
                    {dict.admin.lowStock}
                  </p>
                  <p className={`text-lg font-bold ${s.lowStockCount > 0 ? 'text-red-600' : ''}`}>{s.lowStockCount}</p>
                </div>
              </div>

              <p className="flex items-center justify-end gap-1 text-xs font-semibold text-ink-900/40 transition-colors group-hover:text-ink-950">
                {dict.admin.openStore}
                <ChevronRight size={14} />
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
