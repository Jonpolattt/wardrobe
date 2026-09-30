// Next.js's App Router convention: this file is automatically used as the
// Suspense fallback for every route under `[locale]` that doesn't have its
// own more specific `loading.tsx` (Shop, Categories, Product detail, etc. —
// all of which fetch their data server-side before rendering). Without this
// file, clicking a nav link just sat there doing nothing for however long
// the next page's data fetch took (3-4s reported when navigating to Shop) —
// no visual feedback that the click registered at all. Header/Footer/
// MobileBottomNav stay mounted throughout (they live in layout.tsx, outside
// this boundary) — only the middle content area swaps to this spinner.
export default function LocaleLoading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-ink-900/10 border-t-ink-950 dark:border-cream/10 dark:border-t-cream" />
    </div>
  );
}
