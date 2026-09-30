'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@apollo/client';
import { AlertCircle, Heart, Minus, Plus, ShoppingCart } from 'lucide-react';
import { ADD_TO_CART, TOGGLE_WISHLIST } from '@/lib/graphql/mutations';
import { GET_MY_CART, GET_MY_WISHLIST } from '@/lib/graphql/queries';
import { useAuthStore } from '@/lib/store/auth-store';
import { getFriendlyErrorMessage } from '@/lib/utils/graphql-error';
import { translateColorName } from '@/lib/utils/colorNames';
import { swatchColor } from '@/lib/utils/colorSwatch';
import { useProductColor } from '@/lib/store/product-color-context';
import { formatPrice } from '@/lib/utils/format';
import { resolveUnitPrice, hasVariantPricing } from '@/lib/utils/variantPrice';
import type { Dictionary } from '@/i18n/get-dictionary';
import type { Locale } from '@/i18n/config';

interface ProductVariant {
  size: string;
  color: string;
  stock: number;
  // Duxi hajmlari uchun — variantning o'z narxi; bo'lmasa mahsulotning
  // umumiy narxi ishlatiladi.
  price?: number | null;
}

interface ProductActionsProps {
  productId: string;
  // Needed only for the "buy now" sessionStorage payload (see handleBuyNow
  // below) — the checkout order-summary line has to show a title/price
  // without querying the cart, since this purchase never goes through it.
  title: string;
  price: number;
  sizes: string[];
  colors: string[];
  stock: number;
  variants?: ProductVariant[];
  dict: Dictionary;
  locale: Locale;
}

export function ProductActions({ productId, title, price, sizes, colors, stock, variants = [], dict, locale }: ProductActionsProps) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const hasSizeDim = sizes.length > 0;
  const hasColorDim = colors.length > 0;
  const hasVariants = variants.length > 0;

  // Per-size/color stock lookup. When the product has no variant data at
  // all (older products, or ones with no size/color options), everything
  // is treated as available and only the overall `stock` matters, exactly
  // like before this feature existed.
  function stockFor(size: string, color: string): number | null {
    if (!hasVariants) return null;
    const match = variants.find(
      (v) => v.size === (hasSizeDim ? size : '') && v.color === (hasColorDim ? color : ''),
    );
    return match ? match.stock : 0;
  }

  // A size is pickable if at least one color (or the single implicit
  // combination, when the product has no color dimension) still has stock.
  function isSizeAvailable(s: string): boolean {
    if (!hasVariants) return true;
    if (hasColorDim) return colors.some((c) => (stockFor(s, c) ?? 0) > 0);
    return (stockFor(s, '') ?? 0) > 0;
  }

  // A color is pickable for the currently selected size.
  function isColorAvailable(c: string, currentSize: string): boolean {
    if (!hasVariants) return true;
    return (stockFor(currentSize, c) ?? 0) > 0;
  }

  const firstAvailableSize = sizes.find((s) => isSizeAvailable(s)) ?? sizes[0] ?? '';
  const [size, setSize] = useState(firstAvailableSize);
  const firstAvailableColor = colors.find((c) => isColorAvailable(c, firstAvailableSize)) ?? colors[0] ?? '';
  const [color, setColor] = useState(firstAvailableColor);
  const [quantity, setQuantity] = useState(1);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedVariantStock = stockFor(size, color);
  const selectedComboOutOfStock = hasVariants && selectedVariantStock !== null && selectedVariantStock <= 0;

  // Duxi kabi mahsulotlarda narx tanlangan hajmga qarab o'zgaradi.
  // `variantPricing` false bo'lsa (kiyim, poyabzal — ya'ni hozirgi hamma
  // mahsulot) hech narsa o'zgarmaydi va narx eski joyida ko'rinadi.
  const variantPricing = hasVariantPricing({ price, variants });
  const selectedUnitPrice = resolveUnitPrice({ price, variants }, size, color);

  // "M razmer, ko'k rang — 5 dona mavjud" / "... — faqat 2 dona qoldi" for
  // the currently selected size+color combo, built from real variant stock
  // (never a hardcoded number) and reactive to size/color changes since it
  // reads `size`/`color`/`selectedVariantStock` directly on every render.
  function variantStockMessage(): string | null {
    if (!hasVariants || selectedVariantStock === null || selectedVariantStock <= 0) return null;
    const descriptorParts: string[] = [];
    if (hasSizeDim && size) descriptorParts.push(`${size} ${dict.product.variantSizeWord}`);
    if (hasColorDim && color) descriptorParts.push(`${translateColorName(color, locale).toLowerCase()} ${dict.product.variantColorWord}`);
    const descriptor = descriptorParts.join(', ');
    const isLow = selectedVariantStock <= 5;
    const status = isLow
      ? `${dict.product.variantOnlyLeft} ${selectedVariantStock} ${dict.product.stockLeft}`
      : `${selectedVariantStock} ${dict.product.variantAvailable}`;
    return descriptor ? `${descriptor} — ${status}` : status;
  }

  // If the shopper picks a size that makes the currently-selected color
  // unavailable (e.g. "M / Qora" is sold out), jump to a color that still
  // has stock for that size instead of silently leaving an out-of-stock
  // combo selected.
  useEffect(() => {
    if (!hasColorDim || !hasVariants) return;
    if (isColorAvailable(color, size)) return;
    const nextColor = colors.find((c) => isColorAvailable(c, size));
    if (nextColor) setColor(nextColor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size]);

  // Publishes the currently-selected color to ProductColorContext so the
  // gallery (ProductGalleryForColor, a sibling client component elsewhere on
  // this page) can swap in that color's dedicated photos — see
  // product-color-context.tsx for why this goes through context instead of
  // lifting all this component's stock-aware color logic up a level.
  const { setColor: setSharedColor } = useProductColor();
  useEffect(() => {
    setSharedColor(color);
  }, [color, setSharedColor]);

  const [addToCart, { loading: addingToCart }] = useMutation(ADD_TO_CART, {
    refetchQueries: [{ query: GET_MY_CART }],
  });
  const { data: wishlistData } = useQuery(GET_MY_WISHLIST, { skip: !user, fetchPolicy: 'cache-first' });
  const isWishlisted = wishlistData?.myWishlist?.some((item: any) => item.product?.id === productId) ?? false;
  const [toggleWishlist, { loading: togglingWishlist }] = useMutation(TOGGLE_WISHLIST, {
    refetchQueries: [{ query: GET_MY_WISHLIST }],
  });

  async function handleAddToCart() {
    if (!user) {
      router.push(`/${locale}/login`);
      return;
    }
    setErrorMessage(null);
    try {
      await addToCart({ variables: { input: { productId, size, color, quantity } } });
      setFeedback(dict.product.addToCart + ' ✓');
      setTimeout(() => setFeedback(null), 2000);
    } catch (error) {
      // Previously an error here (e.g. that exact size/color combo being
      // sold out) just vanished as an unhandled rejection — the button
      // looked like it did nothing. Now it shows why.
      setErrorMessage(getFriendlyErrorMessage(error));
    }
  }

  function handleBuyNow() {
    if (!user) {
      router.push(`/${locale}/login`);
      return;
    }
    setErrorMessage(null);
    // Bypasses the cart entirely — same fix as QuickBuyModal's "1-click
    // buy" (see its handleConfirm for the full explanation): routing
    // through addToCart + `?items=<that row>` silently merged quantities
    // with whatever identical size/color combo was already sitting in the
    // cart, since CartService.add() increments an existing matching row
    // instead of creating a second one. Writing straight to sessionStorage
    // and letting checkout read CreateOrderInput.buyNowProductId keeps this
    // purchase independent of the cart's contents.
    try {
      sessionStorage.setItem(
        'checkout:buyNowItem',
        // Narx tanlangan hajm/o'lchamga qarab olinadi (duxi uchun muhim).
        // Bu faqat checkout sahifasidagi ko'rinish uchun — buyurtmaning
        // haqiqiy summasi baribir serverda qaytadan hisoblanadi.
        JSON.stringify({
          productId,
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
  }

  const outOfStock = stock <= 0 || selectedComboOutOfStock;

  return (
    <div className="space-y-6">
      {sizes.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-900/50 dark:text-cream/50">{dict.product.size}</p>
          <div className="flex flex-wrap gap-2">
            {sizes.map((s) => {
              const available = isSizeAvailable(s);
              return (
                <button
                  key={s}
                  onClick={() => available && setSize(s)}
                  disabled={!available}
                  title={!available ? dict.product.outOfStock : undefined}
                  className={`h-10 min-w-10 rounded-lg border px-3 text-sm font-semibold transition-colors ${
                    !available
                      ? 'cursor-not-allowed border-ink-900/15 text-ink-900/30 line-through dark:border-cream/15 dark:text-cream/35'
                      : size === s
                        // Selected state is inverted per theme (dark pill on
                        // light bg, light pill on dark bg) so it always
                        // stands out — previously this stayed
                        // border-ink-950/bg-ink-950 even in dark mode, which
                        // is nearly the same color as the page background
                        // there, making the selection invisible.
                        ? 'border-ink-950 bg-ink-950 text-cream dark:border-cream dark:bg-cream dark:text-ink-950'
                        : 'border-ink-900/15 hover:border-ink-950 dark:border-cream/20 dark:text-cream dark:hover:border-cream'
                  }`}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {colors.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-900/50 dark:text-cream/50">{dict.product.color}</p>
          <div className="flex flex-wrap gap-2">
            {colors.map((c) => {
              const available = isColorAvailable(c, size);
              return (
                <button
                  key={c}
                  onClick={() => available && setColor(c)}
                  disabled={!available}
                  title={!available ? dict.product.outOfStock : undefined}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-semibold transition-colors ${
                    !available
                      ? 'cursor-not-allowed border-ink-900/15 text-ink-900/30 line-through dark:border-cream/15 dark:text-cream/35'
                      : color === c
                        ? 'border-ink-950 bg-ink-950 text-cream dark:border-cream dark:bg-cream dark:text-ink-950'
                        : 'border-ink-900/15 hover:border-ink-950 dark:border-cream/20 dark:text-cream dark:hover:border-cream'
                  }`}
                >
                  <span
                    className="h-3 w-3 shrink-0 rounded-full border border-black/10"
                    style={{ backgroundColor: swatchColor(c) }}
                  />
                  {translateColorName(c, locale)}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Tanlangan variantning narxi — faqat narxi tanlovga bog'liq
          mahsulotlarda (duxi hajmlari) ko'rsatiladi. Oddiy mahsulotlarda
          bu blok umuman chizilmaydi, shuning uchun ularning ko'rinishi
          zarracha ham o'zgarmaydi: narx yuqoridagi odatdagi joyida
          qolaveradi. */}
      {variantPricing && (
        <div className="rounded-xl border border-gold-500/30 bg-gold-500/5 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-900/50 dark:text-cream/50">
            {size || dict.product.size}
          </p>
          <p className="mt-0.5 text-2xl font-bold text-gold-600 dark:text-gold-400">
            {formatPrice(selectedUnitPrice, locale)}
          </p>
        </div>
      )}

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-900/50 dark:text-cream/50">{dict.product.quantity}</p>
        <div className="flex w-fit items-center gap-4 rounded-full border border-ink-900/15 px-4 py-2 dark:border-cream/20">
          <button onClick={() => setQuantity((q) => Math.max(1, q - 1))} aria-label="minus" className="dark:text-cream">
            <Minus size={14} />
          </button>
          <span className="w-6 text-center text-sm font-semibold dark:text-cream">{quantity}</span>
          <button
            onClick={() => setQuantity((q) => Math.min(selectedVariantStock ?? stock, q + 1))}
            aria-label="plus"
            className="dark:text-cream"
          >
            <Plus size={14} />
          </button>
        </div>

        {/* Exact remaining stock for the currently selected size+color combo,
            spelled out with the size/color themselves — "M razmer, ko'k
            rang — 5 dona mavjud" — so it reads as a real answer to "is
            THIS variant in stock", not just a bare number. Amber for <=5
            left, consistent with the low-stock color used everywhere else
            (ProductCard, quick-buy modal). Only shown once the product
            actually has variant data; recalculates on every size/color
            change since it's derived straight from `size`/`color`/
            `selectedVariantStock`, never a hardcoded number. */}
        {variantStockMessage() && (
          <p
            className={`mt-2 text-xs font-semibold ${
              selectedVariantStock !== null && selectedVariantStock <= 5
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-ink-900/50 dark:text-cream/50'
            }`}
          >
            {variantStockMessage()}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          onClick={handleAddToCart}
          disabled={outOfStock || addingToCart}
          className="btn-outline flex-1 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {/* Same ShoppingCart icon as the quick-buy button/modal now use,
              per request — every "add to cart" button site-wide gets it
              before the label instead of text alone. */}
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
          onClick={handleBuyNow}
          disabled={outOfStock || addingToCart}
          className="btn-primary flex-1 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {dict.product.buyNow}
        </button>
        {user && (
          <button
            onClick={() => {
              if (togglingWishlist) return;
              toggleWishlist({ variables: { productId } });
            }}
            // Neutral black/white surrounding at rest — no more green accent
            // here — and red (filled) once liked, per request.
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border transition-colors ${
              isWishlisted
                ? 'border-red-500 bg-red-500 text-white'
                : 'border-ink-900/15 text-ink-900 hover:border-ink-950 dark:border-cream/20 dark:text-cream dark:hover:border-cream'
            }`}
            aria-label={isWishlisted ? dict.product.removeFromWishlist : dict.product.addToWishlist}
          >
            <Heart size={18} fill={isWishlisted ? 'currentColor' : 'none'} />
          </button>
        )}
      </div>

      {feedback && <p className="text-xs font-semibold text-gold-600">{feedback}</p>}

      {errorMessage && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
}
