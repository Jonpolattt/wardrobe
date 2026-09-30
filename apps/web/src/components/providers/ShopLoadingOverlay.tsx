'use client';

import { useNavLoadingStore } from '@/lib/store/shop-loading-store';
import { ShopSkeleton } from '@/components/shop/ShopSkeleton';
import { HomeSkeleton } from '@/components/home/HomeSkeleton';

/**
 * Always mounted (Providers.tsx → every page), so it's already sitting in
 * the DOM BEFORE a shopper ever clicks into /shop or Home — unlike each
 * route's own `loading.tsx`, which only exists once Next.js has actually
 * started rendering that segment. That's exactly why this one can react
 * the instant `useNavLoadingStore`'s `target` is set (see that store for
 * the full why): it doesn't have to wait for any part of the new page to
 * arrive first.
 *
 * (Filename kept as ShopLoadingOverlay for now even though it covers more
 * than Shop — this component itself is exported as `NavLoadingOverlay`;
 * only the file it lives in still carries the original name.)
 *
 * `fixed inset-0` deliberately overlaps the Header (which is `fixed`,
 * z-50) — this sits at z-40, one layer below, so the header stays visible
 * and usable (and RouteProgressBar's own top line, z-200, still shows on
 * top of everything) while the skeleton covers whatever page is
 * underneath (the OLD page — until the real content is ready to swap
 * in).
 */
export function NavLoadingOverlay() {
  const target = useNavLoadingStore((s) => s.target);

  if (!target) return null;

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-cream dark:bg-ink-950">
      {target === 'shop' ? <ShopSkeleton /> : <HomeSkeleton />}
    </div>
  );
}
