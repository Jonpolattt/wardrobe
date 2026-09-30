'use client';

import { create } from 'zustand';

/**
 * ROOT-CAUSE FIX for "Magazinga o'tganda/filtr bosganda loader (skelet)
 * hech qachon ko'rinmaydi, darhol tayyor kartalar chiqadi":
 *
 * Next.js's `app/[locale]/shop/loading.tsx` (the Suspense fallback) only
 * ever gets a chance to paint if the BYTES actually reach the browser
 * progressively while the server is still awaiting the products query. On
 * this deployment the full response arrives in one piece instead (most
 * likely an in-between reverse proxy buffering the whole response before
 * forwarding it — a very common nginx default) — so by the time the
 * browser sees anything at all, the real, fully-loaded page is already
 * in hand. loading.tsx never gets a moment on screen, no matter how the
 * data fetch itself is written.
 *
 * This store sidesteps that entirely: it doesn't wait on any server
 * signal. `start()` is called the INSTANT a qualifying click happens
 * (mirroring RouteProgressBar's own proven click-capture technique — see
 * that file), synchronously swapping the target page's content area over
 * to a skeleton BEFORE the browser has sent a single byte of the new
 * request. `finish()` fires once Next.js's router reports the URL has
 * actually changed (pathname or query — covers both entering a fresh
 * page and changing filters/sort/page while already on it), which is
 * exactly the moment the freshly-fetched real content is ready to paint.
 * Purely client-side cause and effect — completely unaffected by however
 * the server/proxy chooses to deliver its response.
 *
 * Originally shop-only (hence the filename); generalized to carry WHICH
 * page's skeleton to show (`target`) so the same mechanism now also
 * covers Home — see NavLoadingOverlay.tsx, which picks the matching
 * skeleton component for whatever `target` is currently set.
 *
 * NOTE: this only ever fires from a CLIENT-SIDE navigation (a click this
 * session's own JS saw happen). A hard refresh / typed URL / bookmark
 * has no click for anything here to react to, so neither this store nor
 * NavLoadingOverlay can help there — that's what ProductCard's own
 * per-image shimmer (loads-until-the-actual-photo-file-has-downloaded)
 * is for instead, since that's driven by the browser's native image
 * `load` event, not by navigation at all.
 */
export type NavLoadingTarget = 'shop' | 'home';

interface NavLoadingState {
  target: NavLoadingTarget | null;
  start: (target: NavLoadingTarget) => void;
  finish: () => void;
}

export const useNavLoadingStore = create<NavLoadingState>((set) => ({
  target: null,
  start: (target) => set({ target }),
  finish: () => set({ target: null }),
}));
