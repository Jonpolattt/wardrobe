'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Heart, ShoppingCart, Star } from 'lucide-react';
import { useMutation, useQuery } from '@apollo/client';
import { TOGGLE_WISHLIST } from '@/lib/graphql/mutations';
import { GET_MY_WISHLIST } from '@/lib/graphql/queries';
import { useAuthStore } from '@/lib/store/auth-store';
import { formatPrice } from '@/lib/utils/format';
import { useHoverScrubImages } from '@/lib/hooks/use-hover-scrub-images';
import { hasVariantPricing, resolveMinPrice } from '@/lib/utils/variantPrice';
import { QuickBuyModal } from '@/components/product/QuickBuyModal';
import type { Dictionary } from '@/i18n/get-dictionary';
import type { Locale } from '@/i18n/config';

export interface ProductCardData {
  id: string;
  title: string;
  titleRu?: string;
  slug: string;
  price: number;
  oldPrice?: number;
  images: string[];
  colorImages?: { color: string; images: string[] }[];
  category?: { name: string; nameRu?: string };
  rating: number;
  reviewsCount?: number;
  stock?: number;
  sizes?: string[];
  colors?: string[];
  variants?: { size: string; color: string; stock: number; price?: number | null }[];
}

export function ProductCard({
  product,
  locale,
  dict,
}: {
  product: ProductCardData;
  locale: Locale;
  dict: Dictionary;
}) {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const [isQuickBuyOpen, setIsQuickBuyOpen] = useState(false);
  // Reads from the same cache Header/WishlistPage already populate, so this
  // is normally an instant cache hit rather than a fresh network call.
  const { data: wishlistData } = useQuery(GET_MY_WISHLIST, { skip: !user, fetchPolicy: 'cache-first' });
  const serverWishlisted = wishlistData?.myWishlist?.some((item: any) => item.product?.id === product.id) ?? false;
  // The heart used to only flip once the mutation's refetchQueries came
  // back — a real network round-trip, which read as "the click is waiting
  // on a loader" even though there's no spinner. This local override makes
  // the heart flip the instant you click, before the network call even
  // resolves; the effect below drops the override again once the real
  // server data catches up to it (or on the next click).
  const [optimisticWishlisted, setOptimisticWishlisted] = useState<boolean | null>(null);
  const isWishlisted = optimisticWishlisted ?? serverWishlisted;
  useEffect(() => {
    setOptimisticWishlisted(null);
  }, [wishlistData]);

  const [toggleWishlist] = useMutation(TOGGLE_WISHLIST, {
    refetchQueries: [{ query: GET_MY_WISHLIST }],
  });

  const title = locale === 'ru' && product.titleRu ? product.titleRu : product.title;
  const categoryName =
    locale === 'ru' && product.category?.nameRu ? product.category.nameRu : product.category?.name;
  // Relative paths — resolve against whatever host the browser is on
  // (localhost or a tunnel URL); next.config.js rewrites /uploads/* through
  // to the backend either way, so this works without any .env switching.
  const images = product.images?.length ? product.images : ['/placeholder-product.svg'];
  const hasMultipleImages = images.length > 1;
  const hasDiscount = product.oldPrice && product.oldPrice > product.price;
  // Narxi hajmga qarab o'zgaradigan mahsulotlarda (duxi) kartochkada
  // eng arzon variant narxi "dan" izohi bilan ko'rsatiladi — aks holda
  // ro'yxatdagi narx xaridor ichkarida ko'radigan narxga mos kelmasdi.
  const variantPricing = hasVariantPricing(product);
  const displayPrice = variantPricing ? resolveMinPrice(product) : product.price;

  // Card image strip: right on the card, without opening the product —
  // scrolling the mouse wheel (or a laptop trackpad's two-finger swipe)
  // while hovering the photo moves through the product's other photos; on
  // touch devices the same strip is a real horizontal swipe (native
  // scroll-snap — see handleStripScroll, which just keeps the indicator
  // bars in sync with wherever the shopper swiped to). All three share one
  // underlying scrollable strip rather than being separate implementations.
  const stripRef = useRef<HTMLDivElement>(null);
  const imageAreaRef = useRef<HTMLDivElement>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  // ROOT-CAUSE FIX for "hard refresh qilsam rasimlar asta ochiladi, loader
  // buni qamramaydi": the product DATA (title/price/image URLs) can be
  // ready long before the actual photo FILES have finished downloading —
  // those are two separate things, and no page-level loading state (this
  // site's own shop/loading.tsx, or the client-driven navigation overlay
  // in providers/ShopLoadingOverlay.tsx) can cover the second one, since
  // both only ever track when the DATA arrives, not when every <img> on
  // the resulting page has actually painted real pixels. A hard refresh
  // (typed URL, F5, no prior click) is exactly where that gap shows up
  // worst — no in-app navigation loader runs at all, so a card would
  // otherwise render onto the page with a blank/empty area for however
  // long its photo takes to download over the network. Tracking each
  // slide's own `<img>` load event and shimmering it individually until
  // THAT fires closes the gap directly, for every card everywhere
  // (Home, Shop, Categories, Wishlist), regardless of how the surrounding
  // page got there.
  const [loadedImages, setLoadedImages] = useState<Record<number, boolean>>({});
  // Mirrors activeImageIndex for the native wheel listener below, which is
  // registered once (see that effect's dependency array) and would
  // otherwise keep reading a stale index from its very first render.
  const activeImageIndexRef = useRef(0);
  useEffect(() => {
    activeImageIndexRef.current = activeImageIndex;
  }, [activeImageIndex]);

  function scrollToImage(index: number) {
    setActiveImageIndex(index);
    activeImageIndexRef.current = index;
    stripRef.current?.scrollTo({ left: index * (stripRef.current?.clientWidth ?? 0), behavior: 'smooth' });
  }

  useEffect(() => {
    if (!hasMultipleImages) return;
    const el = imageAreaRef.current;
    if (!el) return;

    // A native (non-passive) listener — React registers its own JSX
    // onWheel as a passive listener for scroll performance, which means
    // calling e.preventDefault() inside one is silently ignored (with a
    // console warning); a plain addEventListener with passive:false is the
    // only way to actually stop the page from scrolling while we're
    // cycling this card's photos instead.
    function handleWheel(e: WheelEvent) {
      // A mostly-horizontal gesture (trackpad two-finger swipe) already
      // scrolls the strip natively via scroll-snap — handleStripScroll
      // below picks that up on its own, no need to also handle it here.
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;

      const direction = e.deltaY > 0 ? 1 : -1;
      const next = activeImageIndexRef.current + direction;
      // At the first/last photo, let the wheel event fall through to the
      // page's own scroll instead of trapping it — otherwise a shopper
      // couldn't scroll the page past a multi-photo card at all.
      if (next < 0 || next > images.length - 1) return;

      e.preventDefault();
      scrollToImage(next);
    }

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMultipleImages, images.length]);

  function handleImageMouseLeave() {
    if (!hasMultipleImages) return;
    scrollToImage(0);
  }

  // Uzum Market-style hover scrubbing: the whole image area is invisibly
  // split into `images.length` equal left-to-right zones (see the hook
  // itself — no extra DOM, just math against the container's rect on every
  // pointer move), and whichever zone the (real mouse) cursor is over
  // becomes the shown photo. `null` (pointer left the area, or wasn't a
  // mouse) falls back to the same "reset to the first photo" behavior
  // handleImageMouseLeave already does — one shared definition of
  // "default" instead of two. Returns `undefined` when there's only one
  // photo, so spreading it below attaches nothing and this never
  // interferes with a single-image card.
  const scrubHandlers = useHoverScrubImages(images.length, (index) => {
    scrollToImage(index ?? 0);
  });

  function handleStripScroll(e: React.UIEvent<HTMLDivElement>) {
    if (!hasMultipleImages) return;
    const el = e.currentTarget;
    if (el.clientWidth === 0) return;
    const index = Math.round(el.scrollLeft / el.clientWidth);
    if (index !== activeImageIndex) {
      setActiveImageIndex(index);
      activeImageIndexRef.current = index;
    }
  }

  return (
    <motion.div whileHover={{ y: -6 }} transition={{ duration: 0.3 }} className="group relative">
      {/* Sits OUTSIDE the <Link> below (as a sibling, not a nested
          descendant) — it used to be nested inside the Link, and even
          though its own onClick called preventDefault(), that ran too
          late: RouteProgressBar (globals.css's top loading bar) listens
          for clicks on the whole document in the CAPTURE phase, which
          fires before any handler further down the tree including this
          button's. It saw a click land inside an <a> pointing somewhere
          new and lit up the top progress bar, even though navigation was
          about to be cancelled a moment later — that's the "loader"
          showing up on every like click. Moving the button out from under
          the Link means clicks on it never touch an anchor at all, so
          RouteProgressBar has nothing to react to. Positioned absolutely
          to land in the same top-right spot over the image as before. */}
      <button
        onClick={(e) => {
          e.preventDefault();
          if (!user) {
            router.push(`/${locale}/login`);
            return;
          }
          const next = !isWishlisted;
          setOptimisticWishlisted(next);
          toggleWishlist({ variables: { productId: product.id } }).catch(() => setOptimisticWishlisted(!next));
        }}
        aria-label={isWishlisted ? 'Sevimlilardan olib tashlash' : 'Sevimlilarga qo\'shish'}
        className={`absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full shadow-soft transition-all duration-300 ${
          isWishlisted ? 'bg-white/40 text-red-500' : 'bg-white/40 text-ink-900'
        }`}
      >
        <Heart size={14} fill={isWishlisted ? 'currentColor' : 'none'} className="transition-colors" />
      </button>

      {/* Single rounded surface wrapping image + info + button — the card
          "box" itself, so the whole thing reads as one unit instead of a
          bare image with text floating below it. overflow-hidden clips the
          image's top corners to this box's own radius instead of the image
          carrying its own separate radius. Image aspect ratio (and
          therefore the card's overall width/height) is untouched — only the
          wrapper/padding/radius around it changed. rounded-xl = 0.75rem
          (12px), per request — also matched by the quick-buy button below. */}
      <div className="overflow-hidden rounded-xl border border-ink-900/8 bg-white transition-shadow duration-300 md:hover:shadow-soft dark:border-cream/10 dark:bg-ink-900">
        {/* prefetch={false}: a product grid can render 8-20+ of these cards
            at once, and Next.js's default Link behavior background-fetches
            each one's route data as it scrolls into view. On a fast/low-
            latency connection that's invisible; on a high-RTT connection
            (confirmed via screen recording: iPhone on LTE, ~250-300ms+ to
            a US-hosted server) those background prefetches compete for the
            same limited-throughput connection as the page's own critical
            JS chunks and images — directly delaying when React finishes
            hydrating and buttons/links start responding to taps. Turning
            prefetch off here doesn't change what clicking the card does
            (it still navigates instantly on tap, just fetches at click-time
            instead of pre-fetching in the background) — only removes the
            competing background requests. */}
        <Link href={`/${locale}/product/${product.slug}`} className="block" prefetch={false}>
          <div
            ref={imageAreaRef}
            className="relative aspect-[3/4] overflow-hidden bg-ink-900/5"
            onMouseLeave={handleImageMouseLeave}
            {...scrubHandlers}
          >
            {/* unoptimized (Next.js image optimization endpoint returns a
                broken/error response in production without `sharp`
                installed on the server — see the long-standing note this
                comment replaces). Each photo is now its own full-size slide
                in a horizontal strip (flex + scroll-snap) instead of a
                single swapped <Image>, so the same markup serves the
                desktop wheel-scroll, trackpad swipe, and mobile touch
                swipe. */}
            <div
              ref={stripRef}
              onScroll={handleStripScroll}
              // touch-pan-x (md and up only) explicitly tells the browser's
              // touch-gesture recognizer that a horizontal drag starting on
              // this element belongs to ITS OWN scrolling — helps
              // ambiguous diagonal swipes register reliably on touch
              // laptops/tablets. On phones we deliberately leave this at
              // the browser default (touch-auto) instead: pan-x was
              // blocking VERTICAL touch scrolling that started on top of a
              // product photo, so scrolling the page itself would get
              // stuck on any card with more than one photo — auto lets the
              // browser pick horizontal-vs-vertical per gesture instead,
              // same as any normal nested horizontal scroller.
              className={`no-scrollbar flex h-full w-full touch-auto md:touch-pan-x ${
                hasMultipleImages ? 'snap-x snap-mandatory overflow-x-auto' : 'overflow-hidden'
              }`}
            >
              {images.map((img, i) => (
                <div key={img + i} className="relative h-full w-full flex-none snap-center">
                  {/* Shimmer sits UNDER the <Image> (not conditionally
                      unmounted) and just fades out once that exact photo
                      has loaded — keeping it mounted the whole time avoids
                      a blank flash between "shimmer removed" and "image
                      painted" on a slow connection. Pointer-events-none so
                      it never blocks the swipe/click handlers above it
                      while visible. */}
                  {!loadedImages[i] && (
                    <div className="skeleton-shimmer pointer-events-none absolute inset-0" />
                  )}
                  <Image
                    src={img}
                    alt={`${title} ${i + 1}`}
                    fill
                    sizes="(max-width: 768px) 50vw, 25vw"
                    // object-position biased slightly below center: most
                    // clothing photos on a plain background have a bit more
                    // empty space above the garment than below (hanger/neck
                    // room), so this crops a little more off the top instead
                    // of splitting the crop evenly. It's a mild, generic
                    // bias, not a fix for a specific photo — a source photo
                    // with a LOT of built-in white space (like an over-wide
                    // product shot) will still show some of that white
                    // padding no matter what CSS does here, since object-fit
                    // can only crop pixels that exist, not invent ones. The
                    // real fix for those is a tighter-cropped source photo.
                    className={`object-cover object-[center_40%] transition-[opacity,transform] duration-700 md:group-hover:scale-105 ${
                      loadedImages[i] ? 'opacity-100' : 'opacity-0'
                    }`}
                    // Fires once THIS photo's bytes have actually finished
                    // downloading and decoded — `unoptimized` below means
                    // this is a plain <img> under the hood, so the native
                    // load event fires reliably (including from the
                    // browser's own disk/memory cache on a repeat visit,
                    // where it fires almost instantly, so a warm-cache
                    // photo never sits behind a needless shimmer).
                    onLoad={() => setLoadedImages((prev) => (prev[i] ? prev : { ...prev, [i]: true }))}
                    unoptimized
                  />
                </div>
              ))}
            </div>

            {hasDiscount && (
              <span className="absolute left-3 top-3 rounded-full bg-gold-500 px-2.5 py-1 text-[11px] font-bold text-ink-950">
                -{Math.round(100 - (product.price / product.oldPrice!) * 100)}%
              </span>
            )}

            {/* Round dot indicators along the bottom edge of the photo —
                only shown when there's more than one. Bottom (not top,
                where the discount badge and wishlist heart already sit) to
                avoid overlapping either.
                Mouse hover is deliberately NOT wired here anymore — the
                whole image area above now does Uzum-style hover scrubbing
                (see scrubHandlers/useHoverScrubImages: it invisibly splits
                the FULL container into images.length equal zones and
                previews whichever one the cursor is over), which already
                covers "hovering near a dot shows roughly that photo" as a
                side effect of covering the entire image. Wiring the dot's
                own onMouseEnter too would just fight that for the same
                state on every mouse move. Keyboard focus is kept as its
                OWN, separate path — Tab-ing to a dot still previews that
                exact photo — since the segment-scrub above is pointer-only
                and has no keyboard equivalent otherwise.
                Deliberately NO onClick: this sits inside the card's <Link>
                (see the wishlist heart's comment above for why a *click*
                target nested in the Link is risky) — RouteProgressBar's
                capture-phase document listener would flash the top loading
                bar the instant the click lands inside the <a>, even though
                a bubble-phase preventDefault/stopPropagation here would
                cancel the actual navigation a moment later. A plain click
                on a dot just falls through to the Link and opens the
                product, same as clicking anywhere else on the photo.
                md:hidden: on desktop the dots disappear entirely — the
                hover-scrub effect above is the ONLY thing that shows which
                photo is active there (matching the Uzum reference exactly,
                no visible indicator at all). They stay visible on mobile/
                tablet (below md), where there's no hover and the dots are
                the only cue of which photo a swipe landed on. */}
            {hasMultipleImages && (
              <div className="pointer-events-none absolute inset-x-2 bottom-2 flex items-center justify-center gap-1.5 md:hidden">
                {images.map((_, i) => {
                  const isActive = i === activeImageIndex;
                  return (
                    <span
                      key={i}
                      role="button"
                      tabIndex={0}
                      aria-label={`${title} — ${i + 1}/${images.length}`}
                      aria-current={isActive}
                      onFocus={() => scrollToImage(i)}
                      // pointer-events-auto: the row itself is
                      // pointer-events-none (so it never steals hover from
                      // the segment-scrub container above/behind it) but
                      // each dot re-enables its own pointer events just
                      // enough to stay a real Tab stop and to get its own
                      // focus-visible ring — NOT for hover (see comment
                      // above), which is why there's no onMouseEnter here.
                      // active: (real mouse-down) and focus-visible: (Tab)
                      // are their own distinct states on top of the
                      // isActive one above — a press-feedback shrink and a
                      // keyboard focus ring respectively — so all three
                      // (default, focus, active/selected) stay visually
                      // distinguishable instead of one silently overriding
                      // another.
                      className={`pointer-events-auto h-1.5 w-1.5 shrink-0 cursor-pointer rounded-full outline-none transition-all duration-300 focus-visible:ring-2 focus-visible:ring-gold-400 focus-visible:ring-offset-1 active:scale-90 ${
                        isActive ? 'scale-125 bg-gold-500' : 'bg-white/50 hover:scale-110 hover:bg-white/90'
                      }`}
                    />
                  );
                })}
              </div>
            )}

            {/* Desktop-only hover carousel indicator (Uzum Market
                reference) — short horizontal segments, one per photo,
                hidden by default and only faded in on `group-hover` at md+
                (same restricted-to-desktop pattern this file already uses
                for the photo zoom at line ~300: md:group-hover:scale-105).
                `group` lives on the outermost card wrapper, so hovering
                anywhere on the card (not just the photo) reveals it, same
                as that zoom effect. Completely separate block from the dot
                indicator above, which stays exactly as it was (md:hidden —
                mobile/tablet only) and is untouched by this addition; this
                new block is itself `hidden` below md, so it has zero effect
                on the mobile/tablet layout. Purely visual, no click/focus
                handling of its own — the existing hover-scrub over the
                whole image area (scrubHandlers) already drives
                activeImageIndex, exactly like it already does for the
                mobile dots above. */}
            {hasMultipleImages && (
              <div className="pointer-events-none absolute inset-x-0 bottom-2 hidden items-center justify-center gap-1 opacity-0 transition-opacity duration-200 md:flex md:group-hover:opacity-100">
                {images.map((_, i) => (
                  <span
                    key={i}
                    aria-hidden="true"
                    className={`h-[3px] w-3 rounded-full transition-colors duration-300 ${
                      i === activeImageIndex ? 'bg-gold-500' : 'bg-white/50'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1 px-4 pt-3">
            {/* Category now gets its OWN full-width row instead of sharing
                one with the price — sharing a row used to leave category
                only whatever leftover width the price (plus, when
                discounted, the stacked strikethrough old price above/below
                it) didn't need, which on a narrow 2-column mobile card was
                sometimes almost nothing: a category name would truncate
                down to 2-3 letters and an ellipsis sitting right up against
                the price, reading as garbled clutter rather than a label. */}
            {categoryName && (
              <p className="truncate text-[11px] uppercase tracking-wider text-ink-900/40 dark:text-cream/40">
                {categoryName}
              </p>
            )}

            {/* NARX — kartochkaning tepasida, mahsulot NOMIDAN OLDIN va
                o'z qatorida. Avval u nom bilan bitta qatorni bo'lishib,
                o'ng chekkada turardi. Endi ikkalasiga ham butun kenglik
                tegadi: narx qisqartirilmaydi, nom esa o'z qatorida
                bemalol joylashadi.

                Chegirma bo'lsa eski (chizilgan) narx shu yerda, joriy
                narxning yonida turadi; joy tor bo'lsa `flex-wrap` uni
                pastki qatorga tushiradi — kartadan tashqariga chiqib
                ketmaydi. */}
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 leading-tight">
              <span className="whitespace-nowrap text-[15px] font-bold text-gold-600 dark:text-gold-400 sm:text-[17px]">
                {formatPrice(displayPrice, locale)}
                {variantPricing && (
                  <span className="ml-1 text-[10px] font-medium text-ink-900/40 dark:text-cream/40">
                    {locale === 'ru' ? 'от' : 'dan'}
                  </span>
                )}
              </span>
              {hasDiscount && (
                <span className="whitespace-nowrap text-[10px] text-ink-900/40 line-through dark:text-cream/40 sm:text-xs">
                  {formatPrice(product.oldPrice!, locale)}
                </span>
              )}
            </div>

            <h3 className="truncate text-sm font-semibold text-ink-950 dark:text-cream">{title}</h3>
            {/* Total stock, visible right on the card — same "N dona qoldi"
                wording used on the product detail page, so a shopper can
                gauge availability before even opening the product. Out of
                stock (0) keeps its own distinct red "unavailable" state;
                1-5 left keeps the amber "almost gone" color, but per request
                without the extra "almostGone" text suffix — the color alone
                signals urgency now, and anything above 5 stays the plain
                neutral gray count. */}
            {typeof product.stock === 'number' && (
              <p
                className={`text-[11px] font-semibold ${
                  product.stock === 0
                    ? 'text-red-500'
                    : product.stock <= 5
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-ink-900/40 dark:text-cream/40'
                }`}
              >
                {product.stock === 0 ? dict.product.outOfStock : `${product.stock} ${dict.product.stockLeft}`}
              </p>
            )}
            {/* Rating, at the very bottom of the info block — one filled
                yellow star (deliberately a literal yellow, not the site's
                green accent, since a star rating reads by convention) plus
                the number and review count in parentheses. Always renders
                (reserving the same line height on every card) but goes
                `invisible` when the product has no rating yet — hiding the
                condition entirely used to make those cards a whole line
                shorter than their neighbors, breaking the grid row's
                height. `invisible` keeps the layout space without showing
                a misleading "0.0 (0 reviews)" to shoppers. */}
            <p
              className={`flex items-center gap-1 text-[11px] font-semibold text-ink-900/60 dark:text-cream/60 ${
                typeof product.rating === 'number' && product.rating > 0 ? '' : 'invisible'
              }`}
            >
              <Star size={12} className="fill-amber-400 text-amber-400" />
              {(product.rating ?? 0).toFixed(1)} ({product.reviewsCount ?? 0} {dict.product.reviews})
            </p>
          </div>
        </Link>

        {/* Sits outside the card's <Link> so tapping it doesn't navigate to
            the product page — opens the quick-buy modal instead. */}
        <div className="px-4 pb-4">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsQuickBuyOpen(true);
            }}
            disabled={product.stock === 0}
            // Root cause of every earlier "nothing changed" report: .btn-primary
            // (globals.css) was plain CSS placed after `@tailwind utilities`
            // instead of inside `@layer components`, so its own baked-in
            // gap-2/px-6/py-3/text-sm always won the cascade tie against a
            // plain (non-!important) override here — ONLY properties marked
            // `!important` (like !rounded-*) were ever actually applying.
            // The font-size was silently stuck at 14px (text-sm) this whole
            // time regardless of what text-[Npx] was written below, which is
            // why "Купить в 1 клик" was wrapping onto 2 lines. globals.css is
            // now fixed (both classes moved into @layer components), and
            // every utility here is additionally marked `!important` as a
            // belt-and-suspenders guarantee. whitespace-nowrap forces a
            // single line outright instead of relying on the text simply
            // fitting.
            // Burchak radiusi bu yerda yozilmaydi — u sayt bo'ylab yagona
            // qoidadan keladi (globals.css, "BARCHA TUGMALAR — 5px").
            className="btn-primary mt-1.5 flex w-full items-center justify-center whitespace-nowrap !gap-1 !px-2 !py-1 !text-[10px] disabled:cursor-not-allowed disabled:opacity-40 sm:mt-2 sm:!gap-1.5 sm:!px-4 sm:!py-1.5 sm:!text-xs"
          >
            {/* ShoppingCart instead of the lightning bolt, per request — same
                icon the navbar already uses for the cart, so "buy"/"cart"
                actions read as one consistent glyph across the site rather
                than two different icons for the same idea. Left as a plain
                outline (no fill) to match how the navbar renders it. */}
            <ShoppingCart className="h-2.5 w-2.5 shrink-0 sm:h-3.5 sm:w-3.5" />
            {dict.product.quickBuy}
          </button>
        </div>
      </div>

      {isQuickBuyOpen && (
        <QuickBuyModal
          product={product}
          locale={locale}
          dict={dict}
          onClose={() => setIsQuickBuyOpen(false)}
        />
      )}
    </motion.div>
  );
}
