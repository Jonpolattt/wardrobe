'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation } from '@apollo/client';
import {
  ArrowLeft,
  Pencil,
  Plus,
  ShoppingBag,
  Package,
  TrendingUp,
  Banknote,
  AlertTriangle,
  Store as StoreIcon,
  KeyRound,
  RefreshCw,
  UserX,
  Percent,
  Wallet,
} from 'lucide-react';
import { GET_STORE_OVERVIEW } from '@/lib/graphql/queries';
import { REGENERATE_STORE_CODE, REVOKE_STORE_SELLERS, UPDATE_STORE } from '@/lib/graphql/mutations';
import { StatCard } from '@/components/admin/StatCard';
import { formatPrice, formatDate } from '@/lib/utils/format';
import type { Locale } from '@/i18n/config';
import uzDict from '@/i18n/dictionaries/uz.json';
import ruDict from '@/i18n/dictionaries/ru.json';

const LOW_STOCK_THRESHOLD = 5;

// Bitta magazinning ichki sahifasi — shu magazindan qo'shilgan barcha
// tovarlar, ularning sotuv va ombor holati, yig'ma statistika. Xuddi kichik
// dashboard: yuqorida raqamlar, pastda filtrlanadigan tovarlar jadvali.
// Faqat admin ko'radi.
export default function AdminStoreDetailPage({ params }: { params: { locale: Locale; id: string } }) {
  const { locale, id } = params;
  const dict = locale === 'ru' ? ruDict : uzDict;

  // cache-and-network: tovar qo'shib/tahrirlab qaytganda sahifa o'zi
  // yangilanadi — F5 kerak emas.
  const { data, loading, refetch } = useQuery(GET_STORE_OVERVIEW, {
    variables: { id },
    fetchPolicy: 'cache-and-network',
  });
  const [tab, setTab] = useState<'all' | 'sold' | 'low'>('all');
  const [regenerateCode] = useMutation(REGENERATE_STORE_CODE);
  const [revokeSellers] = useMutation(REVOKE_STORE_SELLERS);
  const [updateStore, { loading: savingCommission }] = useMutation(UPDATE_STORE);

  // Komissiya foizi kiritish maydoni — serverdan kelgan qiymat bilan
  // boshlanadi, admin o'zgartirib "Saqlash" bosgach yuboriladi.
  const [commissionInput, setCommissionInput] = useState('');
  const [commissionSaved, setCommissionSaved] = useState(false);
  const serverCommission = data?.storeOverview?.stats?.commissionPercent;

  useEffect(() => {
    if (serverCommission != null) setCommissionInput(String(serverCommission));
  }, [serverCommission]);

  async function handleRegenerateCode() {
    if (!confirm(dict.admin.regenerateCodeConfirm)) return;
    await regenerateCode({ variables: { id } });
    refetch();
  }

  async function handleRevokeSellers() {
    if (!confirm(dict.admin.revokeSellersConfirm)) return;
    await revokeSellers({ variables: { id } });
    refetch();
  }

  async function handleSaveCommission() {
    const value = Number(commissionInput);
    if (!Number.isFinite(value) || value < 0 || value > 100) return;
    await updateStore({ variables: { id, input: { commissionPercent: value } } });
    setCommissionSaved(true);
    setTimeout(() => setCommissionSaved(false), 2000);
    refetch();
  }

  if (!data && loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink-900/10 border-t-ink-950" />
      </div>
    );
  }

  const stats = data?.storeOverview?.stats;
  const products = data?.storeOverview?.products ?? [];

  if (!stats) return <p className="text-sm text-ink-900/50">{dict.product.noResults}</p>;

  const filtered = products.filter((p: any) => {
    if (tab === 'sold') return p.soldCount > 0;
    if (tab === 'low') return p.stock <= LOW_STOCK_THRESHOLD;
    return true;
  });

  const tabs = [
    { key: 'all' as const, label: `${dict.admin.storeTabAll} (${products.length})` },
    {
      key: 'sold' as const,
      label: `${dict.admin.storeTabSold} (${products.filter((p: any) => p.soldCount > 0).length})`,
    },
    { key: 'low' as const, label: `${dict.admin.lowStock} (${stats.lowStockCount})` },
  ];

  return (
    <div className="space-y-6">
      <Link
        href={`/${locale}/admin/stores`}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-900/50 transition-colors hover:text-ink-950"
      >
        <ArrowLeft size={15} />
        {dict.admin.backToStores}
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-ink-950 text-cream">
            <StoreIcon size={20} />
          </span>
          <h1 className="section-title">{stats.name}</h1>
        </div>
        {/* Shu magazin uchun tovar qo'shish — forma magazin oldindan
            tanlangan holda ochiladi (istalgan turdagi tovar: kiyim,
            poyabzal, aksessuar — kategoriyani formada tanlaysiz) */}
        <Link href={`/${locale}/admin/products/new?store=${id}`} className="btn-primary">
          <Plus size={16} />
          {dict.admin.addProduct}
        </Link>
      </div>

      {/* Bot kirish kodi va ulangan sotuvchilar — bu kodni faqat shu
          magazinchiga bering; kod bilan u Telegram botda faqat shu
          magazinning tovarlarini ayira oladi */}
      <div className="card-surface flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold-500/15 text-gold-500">
            <KeyRound size={18} />
          </span>
          <div>
            <p className="text-xs font-medium text-ink-900/50">{dict.admin.botCodeLabel}</p>
            <p className="font-mono text-lg font-bold tracking-[0.2em]">{stats.accessCode ?? '—'}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {stats.sellers?.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {stats.sellers.map((seller: string) => (
                <span key={seller} className="rounded-full bg-ink-900/5 px-2.5 py-1 text-xs font-semibold text-ink-900/70">
                  👤 {seller.startsWith('ID:') ? seller : `@${seller}`}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-xs text-ink-900/40">{dict.admin.noSellersYet}</span>
          )}
          <button onClick={handleRegenerateCode} className="btn-outline !px-3 !py-2 text-xs" title={dict.admin.regenerateCode}>
            <RefreshCw size={13} />
            {dict.admin.regenerateCode}
          </button>
          {stats.sellers?.length > 0 && (
            <button
              onClick={handleRevokeSellers}
              className="btn-outline !border-red-300 !px-3 !py-2 text-xs !text-red-600"
              title={dict.admin.revokeSellers}
            >
              <UserX size={13} />
              {dict.admin.revokeSellers}
            </button>
          )}
        </div>
      </div>

      {/* Komissiya foizi — magazinchi bilan qancha foizga ishlashingizni
          shu yerda belgilaysiz; pastdagi "Mening ulushim" kartochkasi shu
          foiz asosida (tushum x foiz) avtomatik hisoblanadi. */}
      <div className="card-surface flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600">
            <Percent size={18} />
          </span>
          <div>
            <p className="text-xs font-medium text-ink-900/50">{dict.admin.commissionLabel}</p>
            <p className="text-xs text-ink-900/40">{dict.admin.commissionHint}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <input
              type="number"
              min={0}
              max={100}
              step="0.1"
              value={commissionInput}
              onChange={(e) => setCommissionInput(e.target.value)}
              className="w-24 rounded-xl border border-ink-900/15 px-3 py-2 pr-7 text-sm font-semibold outline-none focus:border-ink-950"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-900/40">%</span>
          </div>
          <button onClick={handleSaveCommission} disabled={savingCommission} className="btn-primary !px-4 !py-2 text-xs disabled:opacity-50">
            {dict.admin.save}
          </button>
          {commissionSaved && <span className="text-xs font-semibold text-emerald-600">✓</span>}
        </div>
      </div>

      {/* Yig'ma raqamlar */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <StatCard label={dict.admin.products} value={stats.totalProducts} icon={ShoppingBag} />
        <StatCard label={dict.admin.storeTotalStock} value={stats.totalStock} icon={Package} accent="#2b4a7a" />
        <StatCard label={dict.admin.unitsSold} value={stats.totalSold} icon={TrendingUp} accent="#3a6b45" />
        <StatCard label={dict.admin.revenueTotal} value={formatPrice(stats.revenue, locale)} icon={Banknote} accent="#059669" />
        <StatCard
          label={`${dict.admin.myShare} (${stats.commissionPercent}%)`}
          value={formatPrice(stats.myShare, locale)}
          icon={Wallet}
          accent="#1f7a4d"
        />
        <StatCard label={dict.admin.lowStock} value={stats.lowStockCount} icon={AlertTriangle} accent="#a83232" />
      </div>

      {/* Filtr tugmalari */}
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-full px-4 py-2 text-xs font-bold transition-colors ${
              tab === t.key ? 'bg-ink-950 text-cream' : 'bg-ink-900/5 text-ink-900/60 hover:bg-ink-900/10'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tovarlar jadvali */}
      <div className="card-surface overflow-x-auto p-0">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-ink-900/10 text-left text-xs uppercase tracking-wider text-ink-900/40">
              <th className="px-5 py-4">{dict.admin.productName}</th>
              <th className="px-5 py-4">{dict.product.category}</th>
              <th className="px-5 py-4">{dict.admin.price}</th>
              <th className="px-5 py-4">{dict.admin.stock}</th>
              <th className="px-5 py-4">{dict.admin.unitsSold}</th>
              <th className="px-5 py-4">{dict.admin.addedDate}</th>
              <th className="px-5 py-4" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((p: any) => (
              <tr key={p.id} className="border-b border-ink-900/5 last:border-0">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    {p.images?.[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.images[0]}
                        alt={p.title}
                        className="h-10 w-10 shrink-0 rounded-lg border border-ink-900/5 object-cover"
                      />
                    ) : (
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ink-900/5 text-ink-900/30">
                        <ShoppingBag size={15} />
                      </span>
                    )}
                    <span className="max-w-[220px] truncate font-medium">{p.title}</span>
                  </div>
                </td>
                <td className="px-5 py-3 text-ink-900/60">{p.category?.name}</td>
                <td className="px-5 py-3 font-semibold">{formatPrice(p.price, locale)}</td>
                <td className="px-5 py-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                      p.stock <= LOW_STOCK_THRESHOLD ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    {p.stock}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <span className={`text-sm font-bold ${p.soldCount > 0 ? 'text-emerald-700' : 'text-ink-900/30'}`}>
                    {p.soldCount}
                  </span>
                </td>
                <td className="px-5 py-3 text-xs text-ink-900/50">{formatDate(p.createdAt, locale)}</td>
                <td className="px-5 py-3">
                  <div className="flex justify-end">
                    <Link
                      href={`/${locale}/admin/products/${p.id}/edit`}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-ink-900/10 hover:border-ink-950"
                    >
                      <Pencil size={14} />
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="p-8 text-center text-sm text-ink-900/40">{dict.admin.noProductsInStore}</p>}
      </div>
    </div>
  );
}
