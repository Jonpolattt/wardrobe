// Home page's client-driven navigation skeleton — see
// lib/store/shop-loading-store.ts (useNavLoadingStore) for why this
// exists alongside Next.js's own (less reliable, on this deployment)
// Suspense-based loading. Mirrors Home's real section order (hero → why
// us → best sellers grid → category showcase) so nothing visibly jumps
// once the real page swaps in.
function ShimmerBlock({ className }: { className: string }) {
  return <div className={`skeleton-shimmer rounded-md ${className}`} />;
}

export function HomeSkeleton() {
  return (
    <div>
      {/* HERO — matches the real section's min-h-[640px] centered block so
          the page doesn't jump in height once the real hero text mounts. */}
      <section className="-mt-[68px] flex min-h-[640px] flex-col justify-center bg-white pt-[68px] dark:bg-ink-950 sm:-mt-[84px] sm:pt-[84px]">
        <div className="container-app space-y-6 py-24">
          <ShimmerBlock className="h-px w-full max-w-md !rounded-none" />
          <ShimmerBlock className="h-3 w-40" />
          <ShimmerBlock className="h-14 w-full max-w-2xl sm:h-16" />
          <ShimmerBlock className="h-4 w-full max-w-lg" />
          <div className="flex gap-4 pt-2">
            <ShimmerBlock className="h-11 w-36 !rounded-full" />
            <ShimmerBlock className="h-11 w-44 !rounded-full" />
          </div>
        </div>
      </section>

      {/* WHY US */}
      <section className="border-b border-ink-900/5 bg-white py-16 dark:border-cream/5 dark:bg-ink-950">
        <div className="container-app grid grid-cols-2 gap-5 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-4 rounded-2xl border border-ink-900/8 p-6 dark:border-cream/10">
              <ShimmerBlock className="h-12 w-12 !rounded-xl" />
              <ShimmerBlock className="h-3.5 w-2/3" />
              <ShimmerBlock className="h-3 w-full" />
            </div>
          ))}
        </div>
      </section>

      {/* BEST SELLERS */}
      <section className="bg-white py-20 dark:bg-ink-950">
        <div className="container-app">
          <div className="flex items-end justify-between">
            <ShimmerBlock className="h-8 w-48" />
            <ShimmerBlock className="hidden h-4 w-24 sm:block" />
          </div>
          <div className="mt-10 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="overflow-hidden rounded-xl border border-ink-900/8 dark:border-cream/10">
                <ShimmerBlock className="aspect-[3/4] w-full !rounded-none" />
                <div className="space-y-2 px-4 pb-4 pt-3">
                  <ShimmerBlock className="h-2.5 w-1/3" />
                  <ShimmerBlock className="h-3.5 w-2/3" />
                  <ShimmerBlock className="h-2.5 w-1/4" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BANNER / category showcase */}
      <section className="bg-white py-20 dark:bg-ink-950">
        <div className="container-app">
          <div className="flex items-end justify-between">
            <div className="space-y-3">
              <ShimmerBlock className="h-3 w-32" />
              <ShimmerBlock className="h-8 w-40" />
            </div>
            <ShimmerBlock className="hidden h-4 w-28 sm:block" />
          </div>
          <ShimmerBlock className="mt-10 h-64 w-full !rounded-2xl sm:h-80" />
        </div>
      </section>
    </div>
  );
}
