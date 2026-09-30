'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useQuery } from '@apollo/client';
import { Check, Clock, Package, X, ArrowRight } from 'lucide-react';
import { GET_MY_ORDERS } from '@/lib/graphql/queries';
import { useAuthStore } from '@/lib/store/auth-store';
import { formatPrice, formatDate } from '@/lib/utils/format';
import { translateColorName } from '@/lib/utils/colorNames';
import { resolveProductCoverImage } from '@/lib/utils/productImage';
import { OrderStatusBadge } from '@/components/ui/OrderStatusBadge';
import { Reveal } from '@/components/ui/Reveal';
import type { Locale } from '@/i18n/config';
import uzDict from '@/i18n/dictionaries/uz.json';
import ruDict from '@/i18n/dictionaries/ru.json';

export default function OrdersPage({ params }: { params: { locale: Locale } }) {
  const { locale } = params;
  const dict = locale === 'ru' ? ruDict : uzDict;
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  // network-only so a status the admin just changed always shows up here,
  // instead of a possibly-stale cached copy from an earlier visit. Polling
  // means the buyer sees "To'landi" the moment admin confirms payment,
  // without needing to manually reload the page.
  const { data, loading } = useQuery(GET_MY_ORDERS, {
    skip: !user,
    fetchPolicy: 'network-only',
    pollInterval: 5000,
  });
  const orders = data?.myOrders ?? [];

  if (!user) {
    return (
      <div className="container-app flex flex-col items-center py-32 text-center">
        <Package size={40} className="text-ink-900/20" />
        <Link href={`/${locale}/login`} className="btn-primary mt-6">
          {dict.nav.login}
        </Link>
      </div>
    );
  }

  // First load only — the 5s poll keeps flipping `loading` true afterward,
  // but the order list already has data by then so this won't re-fire.
  if (loading && !data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink-900/10 border-t-ink-950" />
      </div>
    );
  }

  return (
    <div className="container-app py-12">
      <Reveal>
        <h1 className="section-title">{dict.orders.title}</h1>
      </Reveal>

      {!loading && orders.length === 0 && (
        <div className="mt-16 flex flex-col items-center py-20 text-center">
          <Package size={40} className="text-ink-900/20" />
          <p className="mt-4 text-sm text-ink-900/50">{dict.orders.empty}</p>
          <Link href={`/${locale}/shop`} className="btn-primary mt-6">
            {dict.cart.continueShopping}
          </Link>
        </div>
      )}

      <div className="mt-10 space-y-4">
        {orders.map((order: any, i: number) => {
          // To'lanmagan (yoki rad etilgan — qayta urinish uchun) buyurtma
          // kartochkasi bosilsa, to'lov sahifasiga o'tadi (aynan shu
          // buyurtmaning mahsuloti/kartasi bilan). To'langan buyurtma uchun
          // avvalgidek — kartochkaning o'zi hech qayerga olib bormaydi,
          // faqat ichidagi mahsulot havolalari ishlaydi.
          const payable = order.paymentStatus !== 'PAID';
          return (
            <Reveal key={order.id} delay={i * 0.05}>
              <div
                onClick={payable ? () => router.push(`/${locale}/orders/${order.id}`) : undefined}
                className={`card-surface p-6 ${payable ? 'cursor-pointer transition-colors hover:border-gold-500/30' : ''}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-ink-900/40">{dict.orders.orderNumber}</p>
                  <p className="font-mono text-sm font-bold">{order.orderNumber}</p>
                </div>
                <div className="flex items-center gap-2">
                  {/* Explicit checkmark/X/clock icon, not just color — a
                      clear visual, not just a colored label, for whichever
                      of the three states admin last set (or a review still
                      pending) this order is in. */}
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
                    {order.paymentStatus === 'PENDING' && <Clock size={12} strokeWidth={3} />}
                    {order.paymentStatus === 'PAID'
                      ? dict.admin.paid
                      : order.paymentStatus === 'FAILED'
                        ? dict.admin.rejected
                        : dict.admin.unpaid}
                  </span>
                  <OrderStatusBadge status={order.status} dict={dict} />
                </div>
              </div>

              <div className="mt-4 space-y-3 border-t border-ink-900/10 pt-4">
                {order.items.map((item: any) => {
                  // Xaridor tanlagan RANGGA mos rasm (resolveProductCoverImage)
                  // — avval har doim bitta umumiy rasm ko'rsatilar edi.
                  const cover = resolveProductCoverImage(item.product, item.color);
                  const inner = (
                    <>
                      <div className="relative h-16 w-14 shrink-0 overflow-hidden rounded-lg bg-ink-900/5">
                        <Image src={cover} alt={item.title} fill className="object-cover" unoptimized />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold dark:text-cream">{item.title}</p>
                        {(item.size || item.color) && (
                          <p className="text-xs text-ink-900/50">
                            {[item.size, item.color ? translateColorName(item.color, locale) : null].filter(Boolean).join(' · ')}
                          </p>
                        )}
                        <p className="text-xs text-ink-900/50">{item.quantity} × {formatPrice(item.price, locale)}</p>
                      </div>
                    </>
                  );
                  return item.product?.slug ? (
                    <Link
                      key={item.id}
                      href={`/${locale}/product/${item.product.slug}`}
                      // Kartochkaning o'zi (payable bo'lsa) to'lov sahifasiga
                      // olib boradi — mahsulot havolasi bosilganda shu tashqi
                      // navigatsiya ishga tushmasligi uchun bubbling to'xtatiladi.
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-3 hover:opacity-80"
                    >
                      {inner}
                    </Link>
                  ) : (
                    <div key={item.id} className="flex items-center gap-3">
                      {inner}
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-ink-900/10 pt-4 text-sm">
                <span className="text-ink-900/50">
                  {formatDate(order.createdAt, locale)} · {order.items.length} {dict.orders.items}
                </span>
                <span className="text-base font-bold">{formatPrice(order.totalAmount, locale)}</span>
              </div>

              {payable && (
                <p className="mt-3 flex items-center justify-end gap-1 text-xs font-semibold text-gold-600 dark:text-gold-400">
                  {dict.orders.payNow}
                  <ArrowRight size={13} />
                </p>
              )}
              </div>
            </Reveal>
          );
        })}
      </div>
    </div>
  );
}
