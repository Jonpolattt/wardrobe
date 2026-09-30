'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { AlertCircle, Check, Search, X } from 'lucide-react';
import { GET_ALL_ORDERS } from '@/lib/graphql/queries';
import { UPDATE_ORDER_STATUS, SET_ORDER_PAYMENT_STATUS, REJECT_ORDER_PAYMENT } from '@/lib/graphql/mutations';
import { formatPrice, formatDate } from '@/lib/utils/format';
import { OrderStatusBadge } from '@/components/ui/OrderStatusBadge';
import { getFriendlyErrorMessage } from '@/lib/utils/graphql-error';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/get-dictionary';
import uzDict from '@/i18n/dictionaries/uz.json';
import ruDict from '@/i18n/dictionaries/ru.json';

const STATUSES = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'] as const;

// Maps each status to the same dictionary keys OrderStatusBadge already
// uses, so the dropdown options are translated instead of showing raw
// English enum values like "PROCESSING".
const STATUS_KEYS: Record<(typeof STATUSES)[number], keyof Dictionary['orders']> = {
  PENDING: 'statusPending',
  PROCESSING: 'statusProcessing',
  SHIPPED: 'statusShipped',
  DELIVERED: 'statusDelivered',
  CANCELLED: 'statusCancelled',
};

export default function AdminOrdersPage({ params }: { params: { locale: Locale } }) {
  const { locale } = params;
  const dict = locale === 'ru' ? ruDict : uzDict;
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [paymentFilter, setPaymentFilter] = useState<string>('');
  // Lets the admin type the order number (or buyer name/phone) from a
  // Telegram payment message and jump straight to that exact row — with
  // several buyers ordering the same product, the list alone doesn't tell
  // them apart.
  const [search, setSearch] = useState('');
  const [rowError, setRowError] = useState<{ orderId: string; message: string } | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const { data, loading } = useQuery(GET_ALL_ORDERS, {
    variables: {
      filter: {
        page: 1,
        limit: 100,
        status: statusFilter || undefined,
        paymentStatus: paymentFilter || undefined,
        search: search.trim() || undefined,
      },
    },
    // New orders wouldn't otherwise show up until the admin manually
    // reloads the page — polling keeps this list current automatically
    // while the tab is open. `notifyOnNetworkStatusChange: false` (the
    // default) keeps these background refetches from flipping `loading`
    // back to true and re-showing a blank table every few seconds.
    pollInterval: 5000,
  });
  // The mutation returns { id, status }, which Apollo automatically merges
  // into its normalized cache for that Order entity — so every component
  // reading this order's status (including the buyer's own orders page, if
  // it shares the same cache) updates reactively without a manual refetch.
  const [updateStatus] = useMutation(UPDATE_ORDER_STATUS);
  // Deliberately separate from status: whether the buyer paid is confirmed
  // manually (Telegram receipt check) and shouldn't be conflated with the
  // fulfillment stage dropdown below.
  const [setPaymentStatus] = useMutation(SET_ORDER_PAYMENT_STATUS);
  // Separate mutation (not just setPaymentStatus(false)) — rejecting a
  // receipt is a distinct, actively-reviewed state (PaymentStatus.FAILED),
  // not the same as "nobody has looked at this yet" (PENDING). This is
  // also what makes the buyer's own account/Telegram get a clear ❌
  // notification instead of nothing happening.
  const [rejectPayment] = useMutation(REJECT_ORDER_PAYMENT);

  const orders = data?.allOrders?.list ?? [];

  // Only the very first load (before any data has ever arrived) shows a
  // full spinner. Filter changes and the 5s poll flip `loading` true again
  // afterward, but the table should keep showing the last-known orders
  // instead of blanking out each time.
  if (!data && loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink-900/10 border-t-ink-950" />
      </div>
    );
  }

  // Neither handler calls refetch() anymore, and both pass optimisticResponse:
  // the mutation's real response ({ id, status } / { id, paymentStatus }) is
  // enough on its own for Apollo to update this exact Order in its
  // normalized cache — every place that reads it (this table, the buyer's
  // own orders page) re-renders automatically, no need to re-fetch the
  // entire 100-row list over the network again. The old version awaited a
  // full refetch() after every click, which meant two full network round
  // trips (through the Cloudflare tunnel, when testing remotely) before the
  // button visibly updated — that's what made "to'landi" feel like it took
  // ~5 seconds. optimisticResponse additionally flips the button instantly,
  // before the network call even returns, and Apollo quietly reconciles it
  // with the real response a moment later.
  async function handleStatusChange(orderId: string, status: string) {
    setRowError(null);
    setUpdatingId(orderId);
    try {
      await updateStatus({
        variables: { input: { orderId, status } },
        optimisticResponse: { updateOrderStatus: { __typename: 'Order', id: orderId, status } },
      });
    } catch (error) {
      setRowError({ orderId, message: getFriendlyErrorMessage(error) });
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleTogglePaid(orderId: string, currentlyPaid: boolean) {
    setRowError(null);
    setUpdatingId(orderId);
    try {
      await setPaymentStatus({
        variables: { orderId, paid: !currentlyPaid },
        optimisticResponse: {
          setOrderPaymentStatus: {
            __typename: 'Order',
            id: orderId,
            paymentStatus: currentlyPaid ? 'PENDING' : 'PAID',
          },
        },
      });
    } catch (error) {
      setRowError({ orderId, message: getFriendlyErrorMessage(error) });
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleRejectPayment(orderId: string) {
    setRowError(null);
    setUpdatingId(orderId);
    try {
      await rejectPayment({
        variables: { orderId },
        optimisticResponse: {
          rejectOrderPayment: { __typename: 'Order', id: orderId, paymentStatus: 'FAILED' },
        },
      });
    } catch (error) {
      setRowError({ orderId, message: getFriendlyErrorMessage(error) });
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="section-title">{dict.admin.orders}</h1>
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-900/40" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={dict.admin.searchOrderPlaceholder}
              className="rounded-full border border-ink-900/15 bg-white py-2 pl-8 pr-4 text-xs text-ink-950 outline-none dark:border-white/15 dark:bg-ink-800 dark:text-cream dark:placeholder:text-cream/40"
            />
          </div>
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="rounded-full border border-ink-900/15 bg-white px-4 py-2 text-xs font-semibold text-ink-950 outline-none dark:border-white/15 dark:bg-ink-800 dark:text-cream"
          >
            <option value="">{dict.admin.paymentStatus}: {dict.admin.allStatuses}</option>
            <option value="PAID">{dict.admin.paid}</option>
            <option value="PENDING">{dict.admin.unpaid}</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-full border border-ink-900/15 bg-white px-4 py-2 text-xs font-semibold text-ink-950 outline-none dark:border-white/15 dark:bg-ink-800 dark:text-cream"
          >
            <option value="">{dict.admin.allStatuses}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {dict.orders[STATUS_KEYS[s]]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {rowError && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <span>{rowError.message}</span>
        </div>
      )}

      <div className="card-surface overflow-x-auto p-0">
        <table className="w-full min-w-[1200px] text-sm">
          <thead>
            <tr className="border-b border-ink-900/10 text-left text-xs uppercase tracking-wider text-ink-900/40">
              <th className="px-5 py-4">{dict.orders.orderNumber}</th>
              <th className="px-5 py-4">{dict.admin.customer}</th>
              <th className="px-5 py-4">{dict.admin.phone}</th>
              <th className="px-5 py-4">{dict.admin.address}</th>
              <th className="px-5 py-4">{dict.admin.orderItems}</th>
              <th className="px-5 py-4">{dict.orders.date}</th>
              <th className="px-5 py-4">{dict.orders.total}</th>
              <th className="px-5 py-4">{dict.admin.paymentStatus}</th>
              <th className="px-5 py-4">{dict.orders.status}</th>
              <th className="px-5 py-4">{dict.admin.updateStatus}</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order: any) => (
                <tr key={order.id} className="border-b border-ink-900/5 last:border-0">
                  <td className="px-5 py-4 font-mono font-semibold">{order.orderNumber}</td>
                  <td className="px-5 py-4">
                    {order.user?.firstName} {order.user?.lastName}
                  </td>
                  <td className="px-5 py-4 text-ink-900/60">{order.phone}</td>
                  <td className="px-5 py-4 max-w-[220px] truncate text-ink-900/60" title={order.deliveryAddress}>
                    {order.deliveryAddress}
                  </td>
                  <td
                    className="px-5 py-4 max-w-[240px] text-ink-900/60"
                    title={(order.items ?? [])
                      .map((it: any) => `${it.title} (${[it.size, it.color].filter(Boolean).join(' / ')}) × ${it.quantity}`)
                      .join(', ')}
                  >
                    <div className="space-y-0.5">
                      {(order.items ?? []).map((it: any) => (
                        <div key={it.id} className="truncate text-xs">
                          {it.title}
                          {(it.size || it.color) && (
                            <span className="text-ink-900/40"> ({[it.size, it.color].filter(Boolean).join(' / ')})</span>
                          )}
                          <span className="text-ink-900/40"> × {it.quantity}</span>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-ink-900/60">{formatDate(order.createdAt, locale)}</td>
                  <td className="px-5 py-4 font-semibold">{formatPrice(order.totalAmount, locale)}</td>
                  <td className="px-5 py-4">
                    <div className="flex flex-col items-start gap-1.5">
                      <span
                        className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${
                          order.paymentStatus === 'PAID'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                            : order.paymentStatus === 'FAILED'
                              ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                        }`}
                      >
                        {order.paymentStatus === 'PAID' && <Check size={12} strokeWidth={3} />}
                        {order.paymentStatus === 'FAILED' && <X size={12} strokeWidth={3} />}
                        {order.paymentStatus === 'PAID'
                          ? dict.admin.paid
                          : order.paymentStatus === 'FAILED'
                            ? dict.admin.rejected
                            : dict.admin.unpaid}
                      </span>

                      {/* Context-sensitive actions: a PENDING (never-reviewed)
                          or FAILED (rejected, buyer may have resent a
                          corrected receipt) order can be confirmed or
                          rejected; a PAID order can only be walked back to
                          unpaid (e.g. a mistaken confirm) — rejecting an
                          already-paid order isn't a meaningful action (the
                          backend refuses it too, see rejectPayment). */}
                      {order.paymentStatus === 'PAID' ? (
                        <button
                          onClick={() => handleTogglePaid(order.id, true)}
                          disabled={updatingId === order.id}
                          className="text-[11px] font-semibold text-ink-900/40 underline decoration-dotted hover:text-ink-950 disabled:opacity-50 dark:text-cream/40 dark:hover:text-cream"
                        >
                          {dict.admin.unpaid}
                        </button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleTogglePaid(order.id, false)}
                            disabled={updatingId === order.id}
                            className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 hover:text-emerald-700 disabled:opacity-50 dark:text-emerald-400"
                          >
                            <Check size={12} strokeWidth={3} /> {dict.admin.markPaid}
                          </button>
                          <button
                            onClick={() => handleRejectPayment(order.id)}
                            disabled={updatingId === order.id || order.paymentStatus === 'FAILED'}
                            className="flex items-center gap-1 text-[11px] font-bold text-red-600 hover:text-red-700 disabled:opacity-30 dark:text-red-400"
                          >
                            <X size={12} strokeWidth={3} /> {dict.admin.rejectPayment}
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <OrderStatusBadge status={order.status} dict={dict} />
                  </td>
                  <td className="px-5 py-4">
                    <select
                      value={order.status}
                      disabled={updatingId === order.id}
                      onChange={(e) => handleStatusChange(order.id, e.target.value)}
                      className="rounded-lg border border-ink-900/15 px-3 py-1.5 text-xs text-ink-950 outline-none disabled:opacity-50 dark:border-white/15 dark:bg-ink-800 dark:text-cream"
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {dict.orders[STATUS_KEYS[s]]}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
        {!loading && orders.length === 0 && <p className="p-8 text-center text-sm text-ink-900/40">{dict.orders.empty}</p>}
      </div>
    </div>
  );
}
