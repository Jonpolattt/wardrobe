'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@apollo/client';
import { AlertCircle, Heart, Minus, Plus, ShoppingCart, X } from 'lucide-react';
import { TOGGLE_WISHLIST } from '@/lib/graphql/mutations';
import { GET_MY_WISHLIST } from '@/lib/graphql/queries';
import { useAuthStore } from '@/lib/store/auth-store';
import { getFriendlyErrorMessage } from '@/lib/utils/graphql-error';
import { translateColorName } from '@/lib/utils/colorNames';
import { swatchColor } from '@/lib/utils/colorSwatch';
import { formatPrice } from '@/lib/utils/format';
import { resolveUnitPrice } from '@/lib/utils/variantPrice';
import { useScrollLock } from '@/lib/hooks/use-scroll-lock';
import type { Dictionary } from '@/i18n/get-dictionary';
import type { Locale } from '@/i18n/config';

interface QuickBuyProduct {
  id: string;
  title: string;
  titleRu?: string;
  description?: string;
  descriptionRu?: string;
  price: number;
  images: string[];
  colorImages?: { color: string; images: string[] }[];
  category?: { name: string; nameRu?: string };
  sizes?: string[];
  colors?: string[];
  variants?: { size: string; color: string; stock: number }[];
  stock?: number;
}

interface QuickBuyModalProps {
  product: QuickBuyProduct;
  locale: Locale;
  dict: Dictionary;
  onClose: () => void;
}

// swatchColor (color name -> hex) now comes from lib/utils/colorSwatch.ts —
// this used to be its own local copy with slightly different hex values
// than the admin form/shop filter's swatches, so the "same" color visibly
// painted a different shade depending which part of the site you were on.
// See that file's header comment for the full story.

/**
 * The homepage's product cards don't have room for a full size/color
 * picker like the product detail page's ProductActions does, but "1-click
 * buy" still needs the shopper to pick a size/color before an order can
 * actually be created (the backend requires them whenever a product has
 * variants). This modal is the minimal version of that same picker,
 * reusing the exact same stock-lookup logic and add-to-cart-then-checkout
 * flow as ProductActions' "Buy now" button — just triggered from a card
 * instead of the product page.
 *
 * Redesigned per request to closely follow a reference screenshot: a single
 * two-column card (photo left, details right) instead of the previous
 * stacked single-column layout, with the site's green accent used for
 * price/selection states, real circular color swatches instead of text
 * pills, a category eyebrow + wishlist heart, and a smooth
 * fade/scale open+close transition (self-contained here via a local
 * `closing` state + timeout, since the parent unmounts this component
 * immediately on `onClose` and has no exit-animation awareness of its own).
 */
export function QuickBuyModal({ product, locale, dict, onClose }: QuickBuyModalProps) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const sizes = product.sizes ?? [];
  const colors = product.colors ?? [];
  const variants = product.variants ?? [];
  const hasSizeDim = sizes.length > 0;
  const hasColorDim = colors.length > 0;
  const hasVariants = variants.length > 0;

  // Locks background scroll for as long as this modal is mounted — the
  // parent only ever renders <QuickBuyModal /> while it's open, so this can
  // just be unconditional; it releases automatically when this component
  // unmounts (right after the exit animation below finishes).
  useScrollLock(true);

  // Mount-triggered enter transition + a local "closing" flag so every close
  // path (backdrop click, X button, Escape) can play a fade/scale-out
  // before actually telling the parent to unmount this component.
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);
  // No "already closing" guard here — calling this more than once (e.g.
  // mashing Escape) is harmless: setClosing(true) again is a no-op and an
  // extra queued setTimeout(onClose, 200) just calls the parent's already-
  // idempotent setIsQuickBuyOpen(false) a second time.
  function requestClose() {
    setClosing(true);
    setTimeout(onClose, 200);
  }
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') requestClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stockFor(size: string, color: string): number | null {
    if (!hasVariants) return null;
    const match = variants.find(
      (v) => v.size === (hasSizeDim ? size : '') && v.color === (hasColorDim ? color : ''),
    );
    return match ? match.stock : 0;
  }

  function isSizeAvailable(s: string): boolean {
    if (!hasVariants) return true;
    if (hasColorDim) return colors.some((c) => (stockFor(s, c) ?? 0) > 0);
    return (stockFor(s, '') ?? 0) > 0;
  }

  function isColorAvailable(c: string, currentSize: string): boolean {
    if (!hasVariants) return true;
    return (stockFor(currentSize, c) ?? 0) > 0;
  }

  const firstAvailableSize = sizes.find((s) => isSizeAvailable(s)) ?? '';
  const [size, setSize] = useState(firstAvailableSize);
  const firstAvailableColor = colors.find((c) => isColorAvailable(c, firstAvailableSize)) ?? '';
  const [color, setColor] = useState(firstAvailableColor);
  const [quantity, setQuantity] = useState(1);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Tanlangan hajm/o'lchamning narxi (duxi uchun muhim). Variantda o'z
  // narxi bo'lmasa mahsulotning umumiy narxi qaytadi.
  const selectedUnitPrice = resolveUnitPrice(product as any, size, color);

  const selectedVariantStock = stockFor(size, color);
  const outOfStock = (product.stock ?? 1) <= 0 || (hasVariants && selectedVariantStock !== null && selectedVariantStock <= 0);

  // Self-contained wishlist toggle (mirrors ProductActions.tsx/ProductCard.tsx)
  // rather than lifting state from the card that opened this modal — keeps
  // this component droppable anywhere without a wishlist-state prop, and
  // `cache-first` means it's not a real extra network round-trip in
  // practice (Apollo already has the list cached from the card/header).
  const { data: wishlistData } = useQuery(GET_MY_WISHLIST, { skip: !user, fetchPolicy: 'cache-first' });
  const serverWishlisted = wishlistData?.myWishlist?.some((item: any) => item.product?.id === product.id) ?? false;
  const [optimisticWishlisted, setOptimisticWishlisted] = useState<boolean | null>(null);
  const isWishlisted = optimisticWishlisted ?? serverWishlisted;
  const [toggleWishlist] = useMutation(TOGGLE_WISHLIST, {
    refetchQueries: [{ query: GET_MY_WISHLIST }],
  });
  function handleToggleWishlist() {
    if (!user) {
      router.push(`/${locale}/login`);
      return;
    }
    const next = !isWishlisted;
    setOptimisticWishlisted(next);
    toggleWishlist({ variables: { productId: product.id } }).catch(() => setOptimisticWishlisted(!next));
  }

  const title = locale === 'ru' && product.titleRu ? product.titleRu : product.title;
  const description = locale === 'ru' && product.descriptionRu ? product.descriptionRu : product.description;
  const categoryName = locale === 'ru' && product.category?.nameRu ? product.category.nameRu : product.category?.name;
  // Real per-color photo when the admin uploaded one for the selected color
  // (Product.colorImages — see ProductForm.tsx's "Rang bo'yicha rasmlar"
  // section). Previously this just cycled through the general `images` list
  // by the selected color's position, which only "worked" by coincidence —
  // now it shows the color's actual photo, falling back to the product's
  // first general photo when that color has none uploaded.
  const images = product.images?.length ? product.images : ['/placeholder-product.svg'];
  const colorImages = product.colorImages ?? [];
  const colorEntry = hasColorDim ? colorImages.find((ci) => ci.color === color) : undefined;
  const cover = colorEntry && colorEntry.images.length > 0 ? colorEntry.images[0] : images[0];

  async function handleConfirm() {
    if (!user) {
      router.push(`/${locale}/login`);
      return;
    }
    if (hasSizeDim && !size) {
      setErrorMessage(dict.product.quickBuySelectSize);
      return;
    }
    if (hasColorDim && !color) {
      setErrorMessage(dict.product.quickBuySelectColor);
      return;
    }
    setErrorMessage(null);
    setSubmitting(true);
    // Bypasses the cart entirely — an earlier fix routed this through
    // addToCart + `?items=<that row>`, but CartService.add() increments an
    // EXISTING matching cart row instead of creating a second one (same
    // product/size/color can only have one row per buyer), so "1-click buy"
    // of 1 unit silently became "3" whenever 2 of that exact same size/
    // color combo were already sitting in the cart for later — the quick
    // purchase and the cart's leftover stock quietly merged into one order.
    // Writing straight to sessionStorage and letting checkout read
    // CreateOrderInput.buyNowProductId (see order.service.ts) keeps this
    // purchase completely independent of whatever's already in the cart.
    try {
      sessionStorage.setItem(
        'checkout:buyNowItem',
        // Narx tanlangan hajmga qarab (duxi uchun). Faqat checkout
        // ko'rinishi uchun — haqiqiy summa serverda hisoblanadi.
        JSON.stringify({
          productId: product.id,
          title,
          price: selectedUnitPrice,
          size: size || undefined,
          color: color || undefined,
          quantity,
        }),
      );
    } catch {
      // sessionStorage can throw in some privacy modes — checkout's own
      // buyNowRequested guard shows a clear "nothing to order" error
      // instead of silently charging for the wrong thing in that case.
    }
    router.push(`/${locale}/checkout?buyNow=1`);
    setSubmitting(false);
  }

  const modal = (
    <div
      // backdrop-blur-sm removed (heavy-CSS cleanup, per request) — overlay
      // darkened a bit more (60% -> 70%) so the dimming still reads clearly
      // without the blur.
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 transition-opacity duration-200 ${
        visible && !closing ? 'opacity-100' : 'opacity-0'
      }`}
      onClick={requestClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        className={`relative grid w-full max-w-3xl grid-cols-1 overflow-hidden rounded-3xl bg-white shadow-2xl transition-all duration-200 ease-out dark:bg-ink-900 sm:grid-cols-2 ${
          visible && !closing ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        } max-h-[92vh] overflow-y-auto`}
      >
        {/* Photo panel — deliberately always a plain white surface (not
            theme-flipped) so the product photo reads the same way
            regardless of site theme, matching the reference design. Per
            follow-up request the close (X) button moved off the photo and
            up into the details panel's top row (swapped with the wishlist
            heart, which moved down next to the add-to-cart button). */}
        <div className="relative aspect-square bg-white sm:aspect-auto sm:min-h-[420px]">
          <Image src={cover} alt={title} fill className="object-cover" unoptimized />
        </div>

        {/* Details panel */}
        <div className="flex flex-col gap-5 p-6 sm:p-8">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {categoryName && (
                <p className="truncate text-xs font-semibold uppercase tracking-[0.2em] text-ink-900/40 dark:text-cream/40">
                  {categoryName}
                </p>
              )}
              <h3 className="mt-1 font-display text-2xl font-medium text-ink-950 dark:text-cream">{title}</h3>
            </div>
            <button
              type="button"
              onClick={requestClose}
              aria-label={dict.product.quickBuyClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-ink-900/15 text-ink-900/60 transition-colors hover:border-ink-950 hover:text-ink-950 dark:border-cream/20 dark:text-cream/60 dark:hover:border-cream dark:hover:text-cream"
            >
              <X size={18} />
            </button>
          </div>

          <div>
            {/* Tanlangan hajm/o'lchamning narxi. Variantda o'z narxi
                bo'lmasa (kiyim, poyabzal — hozirgi hamma mahsulot)
                mahsulotning umumiy narxi chiqadi, ya'ni avvalgidek. */}
            <p className="text-2xl font-bold text-gold-600 dark:text-gold-400">
              {formatPrice(selectedUnitPrice, locale)}
            </p>
            {/* Same low-stock amber treatment as ProductCard's stock line
                (<=5 left) — per request this color should be consistent
                everywhere the site shows remaining stock, not just the
                home/shop cards. */}
            {typeof product.stock === 'number' && (
              <p
                className={`mt-1 text-xs font-semibold ${
                  product.stock <= 5 ? 'text-amber-600 dark:text-amber-400' : 'text-ink-900/45 dark:text-cream/45'
                }`}
              >
                {product.stock} {dict.product.stockLeft}
              </p>
            )}
          </div>

          {description && <p className="text-sm leading-relaxed text-ink-900/60 dark:text-cream/60">{description}</p>}

          {hasSizeDim && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-900/50 dark:text-cream/50">
                {dict.product.size}
              </p>
              <div className="flex flex-wrap gap-2">
                {sizes.map((s) => {
                  const available = isSizeAvailable(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        if (!available) return;
                        setSize(s);
                        setErrorMessage(null);
                      }}
                      disabled={!available}
                      title={!available ? dict.product.outOfStock : undefined}
                      className={`h-10 min-w-10 rounded-xl border px-3 text-sm font-semibold transition-colors ${
                        !available
                          ? 'cursor-not-allowed border-ink-900/10 text-ink-900/30 line-through dark:border-cream/10 dark:text-cream/25'
                          : size === s
                            ? 'border-gold-500 bg-gold-500 text-white shadow-[0_4px_14px_rgba(70,95,255,0.3)]'
                            : 'border-ink-900/15 hover:border-gold-500 dark:border-cream/20 dark:text-cream dark:hover:border-gold-400'
                      }`}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {hasColorDim && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-900/50 dark:text-cream/50">
                {dict.product.color}
              </p>
              <div className="flex flex-wrap gap-3">
                {colors.map((c) => {
                  const available = isColorAvailable(c, size);
                  const selected = color === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => {
                        if (!available) return;
                        setColor(c);
                        setErrorMessage(null);
                      }}
                      disabled={!available}
                      title={translateColorName(c, locale) + (!available ? ` — ${dict.product.outOfStock}` : '')}
                      className={`relative flex h-8 w-8 items-center justify-center rounded-full transition-transform ${
                        !available ? 'cursor-not-allowed opacity-30' : 'hover:scale-110'
                      } ${selected ? 'ring-2 ring-gold-500 ring-offset-2 ring-offset-white dark:ring-offset-ink-900' : ''}`}
                    >
                      <span
                        className="h-full w-full rounded-full border border-ink-900/15 dark:border-cream/25"
                        style={{ backgroundColor: swatchColor(c) }}
                      />
                      {!available && (
                        <span className="absolute inset-0 rounded-full border-t border-red-500/70" style={{ transform: 'rotate(45deg)' }} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              aria-label="minus"
              className="flex h-8 w-8 items-center justify-center rounded-full text-ink-900 transition-colors hover:bg-ink-900/5 dark:text-cream dark:hover:bg-cream/10"
            >
              <Minus size={14} />
            </button>
            <span className="w-6 text-center text-sm font-semibold text-ink-950 dark:text-cream">{quantity}</span>
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.min(selectedVariantStock ?? product.stock ?? 99, q + 1))}
              aria-label="plus"
              className="flex h-8 w-8 items-center justify-center rounded-full text-ink-900 transition-colors hover:bg-ink-900/5 dark:text-cream dark:hover:bg-cream/10"
            >
              <Plus size={14} />
            </button>
          </div>

          {errorMessage && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Cart button first, heart now AFTER it (swapped again per
              follow-up request) — and the heart lost its circular
              border/background entirely: it's just the bare icon, gray by
              default, turning solid red only once actually liked. */}
          <div className="mt-1 flex items-center gap-3">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={outOfStock || submitting}
              className="btn-primary flex flex-1 items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {outOfStock ? (
                dict.product.outOfStock
              ) : (
                <>
                  <ShoppingCart size={16} />
                  {dict.product.addToCart}
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleToggleWishlist}
              aria-label={isWishlisted ? dict.product.removeFromWishlist : dict.product.addToWishlist}
              className={`flex h-12 w-12 shrink-0 items-center justify-center transition-colors ${
                isWishlisted ? 'text-red-500' : 'text-ink-900/40 hover:text-red-500 dark:text-cream/40'
              }`}
            >
              <Heart size={20} fill={isWishlisted ? 'currentColor' : 'none'} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // Rendered into document.body via a portal rather than in place. The card
  // this modal is opened from lives inside a framer-motion <motion.div>,
  // and Framer Motion sets an inline `transform` style on that wrapper —
  // which makes it a CSS "containing block" for any descendant with
  // `position: fixed`. Without the portal, this modal's fixed overlay was
  // being positioned/clipped relative to that small card instead of the
  // full viewport (the confined, off-center box some shoppers saw). A
  // portal renders straight into <body>, outside that transformed
  // ancestor, so `fixed inset-0` always covers the whole screen and stays
  // centered no matter which card triggered it.
  if (typeof document === 'undefined') return null;
  return createPortal(modal, document.body);
}
