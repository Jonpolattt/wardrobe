'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useNavLoadingStore } from '@/lib/store/shop-loading-store';

export function Pagination({ page, totalPages }: { page: number; totalPages: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (totalPages <= 1) return null;

  function goTo(p: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(p));
    // Same reasoning as ShopFilters: a plain <button onClick> triggers
    // this, not an <a>, so RouteProgressBar never sees it — signal the
    // skeleton overlay ourselves.
    useNavLoadingStore.getState().start('shop');
    router.push(`${pathname}?${params.toString()}`, { scroll: true });
  }

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1).slice(
    Math.max(0, page - 3),
    Math.max(0, page - 3) + 5,
  );

  return (
    <div className="mt-14 flex items-center justify-center gap-2">
      <button
        disabled={page <= 1}
        onClick={() => goTo(page - 1)}
        className="h-9 w-9 rounded-full border border-ink-900/15 text-sm disabled:opacity-30"
      >
        ‹
      </button>
      {pages.map((p) => (
        <button
          key={p}
          onClick={() => goTo(p)}
          className={`h-9 w-9 rounded-full text-sm font-semibold transition-colors ${
            p === page ? 'bg-ink-950 text-cream' : 'border border-ink-900/15 hover:border-ink-950'
          }`}
        >
          {p}
        </button>
      ))}
      <button
        disabled={page >= totalPages}
        onClick={() => goTo(page + 1)}
        className="h-9 w-9 rounded-full border border-ink-900/15 text-sm disabled:opacity-30"
      >
        ›
      </button>
    </div>
  );
}
