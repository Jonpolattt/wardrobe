import { ShopSkeleton } from '@/components/shop/ShopSkeleton';

// Next.js's built-in Suspense fallback for /shop — kept as a second line
// of defense (it DOES work whenever the response streams progressively to
// the browser), but the primary, always-reliable mechanism is now
// `ShopLoadingOverlay` (mounted globally in Providers.tsx) — see
// `lib/store/shop-loading-store.ts` for why this file alone wasn't enough
// on this deployment.
export default function ShopLoading() {
  return <ShopSkeleton />;
}
