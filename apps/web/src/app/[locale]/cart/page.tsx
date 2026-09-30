'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@apollo/client';
import { AlertCircle, Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react';
import { GET_MY_CART } from '@/lib/graphql/queries';
import { UPDATE_CART_ITEM, REMOVE_CART_ITEM } from '@/lib/graphql/mutations';
import { useAuthStore } from '@/lib/store/auth-store';
import { formatPrice } from '@/lib/utils/format';
import { resolveUnitPrice } from '@/lib/utils/variantPrice';
import { getFriendlyErrorMessage } from '@/lib/utils/graphql-error';
import { translateColorName } from '@/lib/utils/colorNames';
import { Reveal } from '@/components/ui/Reveal';
import type { Locale } from '@/i18n/config';
import uzDict from '@/i18n/dictionaries/uz.json';
import ruDict from '@/i18n/dictionaries/ru.json';

// A product with size/color variants can have a different stock number per
// exact combination — the overall `product.stock` is just the sum across
// all of them, so it's the wrong number to cap a specific cart line's
// quantity against (it can let you over-order a nearly sold-out combo, or
// under-cap one that still has plenty left).
function stockLimitFor(item: any): number {
  const variants = item.product?.variants ?? [];
  if (!variants.length) return item.product.stock;
  const match = variants.find((v: any) => v.size === (item.size ?? '') && v.color === (item.color ?? ''));
  return match ? match.stock : item.product.stock;
}

export default function CartPage({ params }: { params: { locale: Locale } }) {
  const { locale } = params;
  const dict = locale === 'ru' ? ruDict : uzDict;
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { data, loading } = useQuery(GET_MY_CART, { skip: !user });
  const [updateItem] = useMutation(UPDATE_CART_ITEM, { refetchQueries: [{ query: GET_MY_CART }] });
  const [removeItem] = useMutation(REMOVE_CART_ITEM, { refetchQueries: [{ query: GET_MY_CART }] });

  const items = data?.myCart ?? [];

  // Which rows are checked — drives both "which items count toward the
  // total" and "which items does Buyurtma berish actually order" (see the
  // ?items= passed to /checkout below). Every item is selected the first
  // time it's ever seen (a fresh cart load, or a new item added later) —
  // `knownIdsRef` tracks which ids we've already defaulted once, so a
  // deliberate manual deselect is never silently re-checked by a later
  // refetch (e.g. after changing a quantity).
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const knownIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const freshIds = items.filter((i: any) => !knownIdsRef.current.has(i.id)).map((i: any) => i.id);
    if (freshIds.length === 0) return;
    freshIds.forEach((id: string) => knownIdsRef.current.add(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      freshIds.forEach((id: string) => next.add(id));
      return next;
    });
  }, [items]);

  // Ids that no longer match any real cart row (removed items) simply never
  // match here — no extra cleanup of `selectedIds` needed, it's harmless
  // for it to keep a stale id around.
  const selectedItems = items.filter((i: any) => selectedIds.has(i.id));
  const selectedCount = selectedItems.length;
  const allSelected = items.length > 0 && selectedCount === items.length;
  // Har bir qator o'zining tanlangan variant narxidan hisoblanadi (duxi
  // hajmlari uchun). Variantda o'z narxi bo'lmasa mahsulotning umumiy
  // narxi olinadi, ya'ni oddiy mahsulotlar uchun hech narsa o'zgarmaydi.
  const subtotal = selectedItems.reduce(
    (sum: number, i: any) => sum + resolveUnitPrice(i.product, i.size, i.color) * i.quantity,
    0,
  );

  function toggleItem(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds(allSelected ? new Set() : new Set(items.map((i: any) => i.id)));
  }

  // Previously these mutations had no .catch/try-catch at all — a rejected
  // promise (e.g. quantity capped to 0, or a network hiccup) just vanished
  // and the button visibly "did nothing" with no clue why.
  async function handleQuantityChange(itemId: string, quantity: number) {
    if (quantity < 1) return;
    setErrorMessage(null);
    try {
      await updateItem({ variables: { input: { id: itemId, quantity } } });
    } catch (error) {
      setErrorMessage(getFriendlyErrorMessage(error));
    }
  }

  async function handleRemove(itemId: string) {
    setErrorMessage(null);
    try {
      await removeItem({ variables: { id: itemId } });
    } catch (error) {
      setErrorMessage(getFriendlyErrorMessage(error));
    }
  }

  async function handleRemoveSelected() {
    if (selectedIds.size === 0) return;
    setErrorMessage(null);
    try {
      await Promise.all(Array.from(selectedIds).map((id) => removeItem({ variables: { id } })));
    } catch (error) {
      setErrorMessage(getFriendlyErrorMessage(error));
    }
  }

  // First load only (query is skipped entirely while logged out, so `loading`
  // stays false and this never fires for guests) — show a spinner instead of
  // a half-rendered/empty cart while the request is still in flight.
  if (user && loading && !data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink-900/10 border-t-ink-950" />
      </div>
    );
  }

  if (!user || (!loading && items.length === 0)) {
    return (
      <div className="container-app flex flex-col items-center py-32 text-center">
        <ShoppingCart size={40} className="text-ink-900/20" />
        <p className="mt-4 text-sm text-ink-900/50">{dict.cart.empty}</p>
        <p className="text-xs text-ink-900/40">{dict.cart.emptySubtitle}</p>
        <Link href={`/${locale}/shop`} className="btn-primary mt-6">
          {dict.cart.continueShopping}
        </Link>
      </div>
    );
  }

  // Only tacked on when it actually narrows anything — an empty/omitted
  // ?items= just means "the whole cart" on the checkout page, same as
  // today, so there's no reason to add the param when everything's checked.
  const checkoutHref =
    selectedCount > 0
      ? `/${locale}/checkout?items=${encodeURIComponent(selectedItems.map((i: any) => i.id).join(','))}`
      : `/${locale}/checkout`;

  return (
    <div className="container-app py-12">
      <Reveal>
        <h1 className="section-title">{dict.cart.title}</h1>
      </Reveal>

      {errorMessage && (
        <div className="mt-6 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="mt-10 grid gap-10 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Reveal>
            {/* One unified rounded box holding everything — the select-all
                row, then each item as a plain divided row inside it, rather
                than a stack of separately-boxed cards — matching the
                reference screenshot's layout. */}
            <div className="overflow-hidden rounded-2xl border border-ink-900/8 bg-white shadow-soft dark:border-cream/10 dark:bg-ink-800">
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
                <label className="flex cursor-pointer items-center gap-3 text-sm font-medium dark:text-cream">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    className="h-[18px] w-[18px] cursor-pointer rounded border-ink-900/25 text-gold-500 accent-gold-500 focus:ring-gold-500 focus:ring-offset-0 dark:border-cream/25"
                  />
                  {dict.cart.selectAll}
                </label>
                <button
                  type="button"
                  onClick={handleRemoveSelected}
                  disabled={selectedIds.size === 0}
                  className="text-sm font-medium text-ink-900/30 transition-colors enabled:text-ink-900/60 enabled:hover:text-red-500 disabled:cursor-not-allowed dark:text-cream/30 dark:enabled:text-cream/60 dark:enabled:hover:text-red-400"
                >
                  {dict.cart.removeSelected}
                </button>
              </div>

              <div className="divide-y divide-ink-900/8 dark:divide-cream/10">
                {items.map((item: any) => {
                  const cover = item.product.images?.[0] || '/placeholder-product.svg';
                  const title = locale === 'ru' && item.product.titleRu ? item.product.titleRu : item.product.title;
                  const checked = selectedIds.has(item.id);
                  return (
                    <div
                      key={item.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => router.push(`/${locale}/product/${item.product.slug}`)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          router.push(`/${locale}/product/${item.product.slug}`);
                        }
                      }}
                      // The row itself navigates to the product page on
                      // click — every interactive control inside it
                      // (checkbox, quantity stepper, remove button) stops
                      // the click from bubbling here, per request #3.
                      className="flex cursor-pointer gap-3 px-4 py-4 transition-colors hover:bg-ink-900/[0.02] sm:gap-4 sm:px-6 dark:hover:bg-cream/[0.03]"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onClick={(e) => e.stopPropagation()}
                        onChange={() => toggleItem(item.id)}
                        aria-label={title}
                        className="mt-1 h-[18px] w-[18px] shrink-0 cursor-pointer self-start rounded border-ink-900/25 text-gold-500 accent-gold-500 focus:ring-gold-500 focus:ring-offset-0 dark:border-cream/25"
                      />

                      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-ink-900/5 sm:h-24 sm:w-20">
                        <Image src={cover} alt={title} fill className="object-cover" unoptimized />
                      </div>

                      <div className="flex min-w-0 flex-1 flex-col justify-between">
                        <div className="min-w-0">
                          <h3 className="line-clamp-2 text-sm font-semibold dark:text-cream">{title}</h3>
                          {(item.size || item.color) && (
                            <p className="mt-0.5 truncate text-xs text-ink-900/50 dark:text-cream/50">
                              {[item.size, item.color ? translateColorName(item.color, locale) : null].filter(Boolean).join(' · ')}
                            </p>
                          )}
                        </div>
                        <div
                          className="mt-2 flex w-fit items-center gap-3 rounded-full border border-ink-900/15 px-3 py-1.5 dark:border-cream/20"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => handleQuantityChange(item.id, Math.max(1, item.quantity - 1))}
                            aria-label="minus"
                            className="dark:text-cream"
                          >
                            <Minus size={12} />
                          </button>
                          <span className="w-5 text-center text-xs font-semibold dark:text-cream">{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => handleQuantityChange(item.id, Math.min(stockLimitFor(item), item.quantity + 1))}
                            aria-label="plus"
                            className="dark:text-cream"
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                      </div>

                      <div
                        className="flex shrink-0 flex-col items-end justify-between gap-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="text-sm font-bold dark:text-cream">
                          {formatPrice(resolveUnitPrice(item.product, item.size, item.color) * item.quantity, locale)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemove(item.id)}
                          className="text-ink-900/30 hover:text-red-500 dark:text-cream/30 dark:hover:text-red-400"
                          aria-label={dict.cart.remove}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </Reveal>
        </div>

        <Reveal delay={0.1}>
          <div className="card-surface sticky top-28 space-y-4 p-6">
            <h2 className="text-sm font-bold uppercase tracking-wider">{dict.checkout.orderSummary}</h2>
            <div className="flex items-center justify-between text-sm text-ink-900/60 dark:text-cream/60">
              <span>{dict.cart.selectedCount}</span>
              <span className="font-semibold text-ink-950 dark:text-cream">
                {selectedCount} / {items.length}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm text-ink-900/60 dark:text-cream/60">
              <span>{dict.cart.subtotal}</span>
              <span>{formatPrice(subtotal, locale)}</span>
            </div>
            <div className="flex items-center justify-between border-t border-ink-900/10 pt-4 text-base font-bold dark:border-cream/10">
              <span>{dict.cart.total}</span>
              <span>{formatPrice(subtotal, locale)}</span>
            </div>
            <Link
              href={checkoutHref}
              aria-disabled={selectedCount === 0}
              onClick={(e) => selectedCount === 0 && e.preventDefault()}
              className={`btn-primary flex w-full items-center justify-center ${
                selectedCount === 0 ? 'pointer-events-none opacity-40' : ''
              }`}
            >
              {dict.cart.checkout}
            </Link>
            {selectedCount === 0 && (
              <p className="text-center text-xs text-ink-900/40 dark:text-cream/40">{dict.cart.selectItemsToCheckout}</p>
            )}
          </div>
        </Reveal>
      </div>
    </div>
  );
}
