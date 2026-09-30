'use client';

import { useState } from 'react';
import { useApolloClient, useMutation, useQuery } from '@apollo/client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import {
  Users,
  Wifi,
  ShoppingBag,
  ClipboardList,
  Clock,
  Truck,
  XCircle,
  Wallet,
  RefreshCw,
  AlertTriangle,
  Trash2,
  Check,
} from 'lucide-react';
import { GET_ADMIN_STATS } from '@/lib/graphql/queries';
import { CLEAR_ALL_DATA, CLEAR_ORDERS_DATA } from '@/lib/graphql/mutations';
import { usePresence } from '@/lib/hooks/use-presence';
import { StatCard } from '@/components/admin/StatCard';
import { formatPrice, formatDate } from '@/lib/utils/format';
import { OrderStatusBadge } from '@/components/ui/OrderStatusBadge';
import { getFriendlyErrorMessage } from '@/lib/utils/graphql-error';
import type { Locale } from '@/i18n/config';
import uzDict from '@/i18n/dictionaries/uz.json';
import ruDict from '@/i18n/dictionaries/ru.json';

// Diagramma ranglari — bitta ko'k oiladan, to'yinganligi bo'yicha
// farqlanadi (avval besh xil tasodifiy rang edi).
const COLORS = ['#465FFF', '#6B82FF', '#8F9DFF', '#B3BDFF', '#61C4FF'];

export default function AdminDashboardPage({ params }: { params: { locale: Locale } }) {
  const { locale } = params;
  const dict = locale === 'ru' ? ruDict : uzDict;

  const { data, loading, error, refetch } = useQuery(GET_ADMIN_STATS, { pollInterval: 20000 });
  const liveOnline = usePresence();
  const stats = data?.adminStats;
  const [refreshing, setRefreshing] = useState(false);
  const apolloClient = useApolloClient();
  const [clearAllData] = useMutation(CLEAR_ALL_DATA);
  const [clearOrdersData] = useMutation(CLEAR_ORDERS_DATA);

  const [confirmText, setConfirmText] = useState('');
  const [clearing, setClearing] = useState(false);
  const [clearError, setClearError] = useState<string | null>(null);
  const [clearedJustNow, setClearedJustNow] = useState(false);
  const requiredWord = dict.admin.clearAllDataTypeWord;

  // "Faqat buyurtmalarni tozalash" — mahsulotlarga tegmaydigan, kamroq
  // og'ir amal bo'lgani uchun so'z yozib tasdiqlash shart emas, lekin
  // baribir bitta aniq ogohlantirish (confirm) so'raladi.
  const [clearingOrders, setClearingOrders] = useState(false);
  const [clearOrdersError, setClearOrdersError] = useState<string | null>(null);
  const [ordersClearedJustNow, setOrdersClearedJustNow] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }

  async function handleClearAll() {
    if (confirmText !== requiredWord) return;
    // eslint-disable-next-line no-alert
    if (!confirm(dict.admin.clearAllDataConfirm)) return;

    setClearing(true);
    setClearError(null);
    try {
      // Backend's clearAllData() (src/modules/admin-tools/admin-tools.service.ts)
      // only ever deletes Product, Category, Brand, Order, OrderItem, Payment,
      // CartItem, WishlistItem, ProductVariant rows — the User table is never
      // touched by this mutation, by design, so accounts always survive a reset.
      await clearAllData();
      // resetStore wipes Apollo's normalized cache AND re-runs every query
      // currently mounted anywhere in the app (this dashboard's stats, plus
      // Products/Categories/Orders/Users if those tabs are open) — so every
      // number on screen drops to its real post-clear value in place,
      // without a manual page reload.
      await apolloClient.resetStore();
      setConfirmText('');
      setClearedJustNow(true);
      setTimeout(() => setClearedJustNow(false), 4000);
    } catch (e) {
      setClearError(getFriendlyErrorMessage(e));
    } finally {
      setClearing(false);
    }
  }

  async function handleClearOrders() {
    // eslint-disable-next-line no-alert
    if (!confirm(dict.admin.clearOrdersDataConfirm)) return;

    setClearingOrders(true);
    setClearOrdersError(null);
    try {
      await clearOrdersData();
      await apolloClient.resetStore();
      setOrdersClearedJustNow(true);
      setTimeout(() => setOrdersClearedJustNow(false), 4000);
    } catch (e) {
      setClearOrdersError(getFriendlyErrorMessage(e));
    } finally {
      setClearingOrders(false);
    }
  }

  const orderStatusData = stats
    ? [
        { name: dict.admin.pendingOrders, value: stats.pendingOrders },
        { name: dict.admin.processingOrders, value: stats.processingOrders },
        { name: dict.orders.statusShipped, value: stats.shippedOrders },
        { name: dict.admin.deliveredOrders, value: stats.deliveredOrders },
        { name: dict.admin.cancelledOrders, value: stats.cancelledOrders },
      ]
    : [];

  const revenueBarData = stats
    ? [
        { name: dict.admin.revenueToday, value: stats.revenueToday },
        { name: dict.admin.revenueThisMonth, value: stats.revenueThisMonth },
        { name: dict.admin.revenueTotal, value: stats.revenueTotal },
      ]
    : [];

  // `!stats` covers both the very first load AND any refetch that comes
  // back empty (query error, network drop, etc.) — without this, `stats`
  // being undefined but `loading` already false crashed the page below at
  // `stats.totalUsers` ("Cannot read properties of undefined"). Once stats
  // has loaded once, a later poll/manual refetch flips `loading` true again
  // but `stats` stays populated, so this branch is skipped and the old
  // numbers keep showing instead of the page blanking out.
  if (!stats) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3">
        {loading ? (
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink-900/10 border-t-ink-950" />
        ) : (
          <>
            <p className="text-sm text-ink-900/50">{error ? error.message : dict.orders.empty}</p>
            <button onClick={handleRefresh} className="btn-outline !px-4 !py-2 text-xs">
              {dict.admin.refresh}
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-3">
        <h1 className="section-title">{dict.admin.dashboard}</h1>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="btn-outline flex items-center gap-2 !px-4 !py-2 text-xs disabled:opacity-50"
        >
          <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
          {dict.admin.refresh}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={dict.admin.totalUsers} value={stats.totalUsers} icon={Users} accent="#111827" />
        <StatCard
          label={dict.admin.onlineUsers}
          value={liveOnline ?? stats.onlineUsers}
          icon={Wifi}
          accent="#465FFF"
          live
        />
        <StatCard label={dict.admin.totalProducts} value={stats.totalProducts} icon={ShoppingBag} accent="#465FFF" />
        <StatCard label={dict.admin.totalOrders} value={stats.totalOrders} icon={ClipboardList} accent="#6B82FF" />
        <StatCard label={dict.admin.pendingOrders} value={stats.pendingOrders} icon={Clock} accent="#A64B00" />
        <StatCard label={dict.admin.processingOrders} value={stats.processingOrders} icon={Truck} accent="#61C4FF" />
        <StatCard label={dict.admin.cancelledOrders} value={stats.cancelledOrders} icon={XCircle} accent="#BD243B" />
        <StatCard label={dict.admin.revenueToday} value={formatPrice(stats.revenueToday, locale)} icon={Wallet} accent="#465FFF" />
        <StatCard label={dict.admin.revenueThisMonth} value={formatPrice(stats.revenueThisMonth, locale)} icon={Wallet} accent="#147B4A" />
        <StatCard label={dict.admin.revenueTotal} value={formatPrice(stats.revenueTotal, locale)} icon={Wallet} accent="#354DE6" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card-surface p-6">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wider">{dict.admin.orders}</h2>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={orderStatusData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3}>
                {orderStatusData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="card-surface p-6">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wider">{dict.admin.revenueTotal}</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={revenueBarData}>
              <XAxis dataKey="name" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip formatter={(v: number) => formatPrice(v, locale)} />
              <Bar dataKey="value" fill="#465FFF" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card-surface p-6 lg:col-span-2">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wider">{dict.admin.recentOrders}</h2>
          <div className="space-y-3">
            {stats.recentOrders.map((order: any) => (
              <div key={order.id} className="flex items-center justify-between border-b border-ink-900/5 pb-3 text-sm last:border-0">
                <div>
                  <p className="font-mono font-semibold">{order.orderNumber}</p>
                  <p className="text-xs text-ink-900/40">{formatDate(order.createdAt, locale)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold">{formatPrice(order.totalAmount, locale)}</span>
                  <OrderStatusBadge status={order.status} dict={dict} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card-surface p-6">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wider">{dict.admin.lowStock}</h2>
          <div className="space-y-3">
            {stats.lowStockProducts.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <span className="max-w-[70%] truncate">{p.title}</span>
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-600">{p.stock}</span>
              </div>
            ))}
            {stats.lowStockProducts.length === 0 && <p className="text-xs text-ink-900/40">—</p>}
          </div>
        </div>
      </div>

      <div className="card-surface p-6">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wider">{dict.admin.bestSellers}</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {stats.bestSellers.map((p: any) => (
            <div key={p.id} className="rounded-xl border border-ink-900/5 p-3 text-sm">
              <p className="truncate font-semibold">{p.title}</p>
              <p className="text-xs text-ink-900/40">
                {p.soldCount} {dict.admin.unitsSold}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Mahsulotlarga tegmaydigan, kamroq og'ir tozalash — faqat
          buyurtma/to'lov/savat/sevimlilar. "Hammasini tozalash"dan farqi:
          tovarlarni qayta qo'shishga hojat qolmaydi. */}
      <div className="card-surface space-y-4 border-2 border-amber-200 p-6 dark:border-amber-900/40">
        <div className="flex items-start gap-3">
          <AlertTriangle size={20} className="mt-0.5 shrink-0 text-amber-500" />
          <div>
            <p className="mt-1 text-sm font-semibold">{dict.admin.clearOrdersDataTitle}</p>
            <p className="mt-1 text-xs text-ink-900/50">{dict.admin.clearOrdersDataHint}</p>
          </div>
        </div>

        {ordersClearedJustNow && (
          <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
            <Check size={14} /> {dict.admin.clearOrdersDataSuccess}
          </p>
        )}

        <button
          onClick={handleClearOrders}
          disabled={clearingOrders}
          className="flex items-center justify-center gap-2 rounded-full bg-amber-500 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Trash2 size={16} />
          {clearingOrders ? '…' : dict.admin.clearOrdersDataButton}
        </button>
        {clearOrdersError && <p className="text-xs font-semibold text-red-500">{clearOrdersError}</p>}
      </div>

      <div className="card-surface space-y-4 border-2 border-red-200 p-6 dark:border-red-900/40">
        <div className="flex items-start gap-3">
          <AlertTriangle size={20} className="mt-0.5 shrink-0 text-red-500" />
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-red-600 dark:text-red-400">
              {dict.admin.dangerZone}
            </h2>
            <p className="mt-1 text-sm font-semibold">{dict.admin.clearAllDataTitle}</p>
            <p className="mt-1 text-xs text-ink-900/50">{dict.admin.clearAllDataHint}</p>
          </div>
        </div>

        {clearedJustNow && (
          <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
            <Check size={14} /> {dict.admin.clearAllDataSuccess}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={requiredWord}
            className="w-full max-w-xs rounded-xl border border-red-200 px-4 py-3 text-sm text-ink-950 outline-none focus:border-red-500 dark:border-red-900/40 dark:bg-ink-800 dark:text-cream dark:placeholder:text-cream/40"
          />
          <button
            onClick={handleClearAll}
            disabled={confirmText !== requiredWord || clearing}
            className="flex items-center justify-center gap-2 rounded-full bg-red-600 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Trash2 size={16} />
            {clearing ? '…' : dict.admin.clearAllDataButton}
          </button>
        </div>
        <p className="text-xs text-ink-900/40">{dict.admin.clearAllDataTypeHint}</p>
        {clearError && <p className="text-xs font-semibold text-red-500">{clearError}</p>}
      </div>
    </div>
  );
}
