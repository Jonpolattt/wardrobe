// Shared skeleton markup for the Shop grid — matches the real shop
// page's layout 1:1 (sidebar width, grid column counts, card proportions)
// with a moving shimmer (see globals.css's .skeleton-shimmer), so
// whichever mechanism shows it (the Suspense `loading.tsx` fallback, OR
// the client-driven `ShopLoadingOverlay` — see that file for why both
// exist) the shopper sees the exact same "this is about to be a product
// grid" placeholder, matching the Uzum Market-style reference. Pure
// presentational, no data/hooks — safe to render from either a server or
// client component.
const SKELETON_CARD_COUNT = 12;

function ShimmerBlock({ className }: { className: string }) {
  return <div className={`skeleton-shimmer rounded-md ${className}`} />;
}

export function ShopSkeleton() {
  return (
    <div className="container-app py-12">
      <ShimmerBlock className="h-8 w-40" />

      <div className="mt-8 flex flex-col gap-10 lg:flex-row">
        {/* Mirrors ShopFilters' own lg:w-64 column width so nothing shifts
            horizontally once the real (data-filled) sidebar mounts. Hidden
            below lg, same as the real sidebar's collapsed-by-default
            mobile behavior. */}
        <div className="hidden shrink-0 space-y-8 lg:block lg:w-64">
          <ShimmerBlock className="h-4 w-20" />
          <div className="space-y-2">
            <ShimmerBlock className="h-4 w-24" />
            {Array.from({ length: 5 }).map((_, i) => (
              <ShimmerBlock key={i} className="h-8 w-full !rounded-lg" />
            ))}
          </div>
          <div className="space-y-2">
            <ShimmerBlock className="h-4 w-16" />
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <ShimmerBlock key={i} className="h-9 w-9 !rounded-lg" />
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <ShimmerBlock className="h-4 w-16" />
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 9 }).map((_, i) => (
                <ShimmerBlock key={i} className="h-8 w-8 !rounded-full" />
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1">
          <div className="mb-6 flex items-center justify-between">
            <ShimmerBlock className="h-4 w-24" />
            <ShimmerBlock className="h-9 w-36 !rounded-lg" />
          </div>

          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: SKELETON_CARD_COUNT }).map((_, i) => (
              <div key={i} className="overflow-hidden rounded-xl border border-ink-900/8 dark:border-cream/10">
                <ShimmerBlock className="aspect-[3/4] w-full !rounded-none" />
                <div className="space-y-2 px-4 pb-4 pt-3">
                  <ShimmerBlock className="h-2.5 w-1/3" />
                  <div className="flex items-start justify-between gap-2">
                    <ShimmerBlock className="h-3.5 w-2/3" />
                    <ShimmerBlock className="h-3.5 w-10 shrink-0" />
                  </div>
                  <ShimmerBlock className="h-2.5 w-1/4" />
                  <ShimmerBlock className="mt-1.5 h-7 w-full !rounded-lg sm:h-8" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
