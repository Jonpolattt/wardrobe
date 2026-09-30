'use client';

import { useCallback, useRef } from 'react';

interface HoverScrubHandlers {
  onPointerMove: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerLeave: (e: React.PointerEvent<HTMLElement>) => void;
}

/**
 * Uzum Market-style product-photo hover scrubbing.
 *
 * Splits whatever element these handlers end up attached to into `count`
 * equal, entirely invisible vertical strips laid left-to-right — no extra
 * DOM nodes, the "segments" are just math against the element's own
 * bounding rect on every pointer move — and reports which strip the
 * cursor currently sits over via `onIndexChange(index)` (0-based), or
 * `onIndexChange(null)` once the pointer leaves. The number of strips
 * always equals `count`, so a product with 2 photos gets 2 equal zones, one
 * with 6 gets 6 — nothing is hard-coded.
 *
 * Real mouse only: every handler checks `PointerEvent.pointerType` and
 * bails out for anything else ('touch', 'pen'), so this never engages on a
 * touch/tablet interaction — those keep whatever native swipe/scroll
 * gesture the caller already has instead.
 *
 * Disabled outright when `count <= 1` (nothing to scrub between) — both
 * handlers come back as a no-op `undefined`, so spreading the result onto
 * an element's props (`{...scrubHandlers}`) safely attaches nothing.
 *
 * Deliberately generic (no product/Card-specific naming or state) so any
 * component with a multi-image container can reuse it — pass it the image
 * count and however you want to react to the hovered index.
 */
export function useHoverScrubImages(
  count: number,
  onIndexChange: (index: number | null) => void,
): HoverScrubHandlers | undefined {
  // Tracks the last index/null actually reported, so a mouse jittering by
  // a pixel or two WITHIN the same zone (pointermove fires on practically
  // every pixel of movement) doesn't re-trigger the caller's callback —
  // e.g. ProductCard's smooth scrollTo() would otherwise restart on every
  // one of those redundant calls, turning "silliq transition" into a
  // stutter instead of one clean animation per actual zone change.
  const lastReported = useRef<number | null>(null);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (e.pointerType !== 'mouse') return;
      const rect = e.currentTarget.getBoundingClientRect();
      if (rect.width === 0) return;
      const relativeX = e.clientX - rect.left;
      const segmentWidth = rect.width / count;
      // Clamped so a fractional rounding blip right at the container's
      // exact left/right edge (relativeX === 0 or === rect.width) can
      // never compute an out-of-range index.
      const index = Math.min(count - 1, Math.max(0, Math.floor(relativeX / segmentWidth)));
      if (index === lastReported.current) return;
      lastReported.current = index;
      onIndexChange(index);
    },
    [count, onIndexChange],
  );

  const handlePointerLeave = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (e.pointerType !== 'mouse') return;
      if (lastReported.current === null) return;
      lastReported.current = null;
      onIndexChange(null);
    },
    [onIndexChange],
  );

  if (count <= 1) return undefined;
  return { onPointerMove: handlePointerMove, onPointerLeave: handlePointerLeave };
}
