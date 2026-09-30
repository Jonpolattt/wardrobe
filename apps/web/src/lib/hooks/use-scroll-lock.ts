'use client';

import { useEffect } from 'react';

// Module-level (not per-hook-instance) lock count + saved body state, shared
// by every component that calls useScrollLock. This matters because more
// than one overlay can be mounted at once — e.g. the review lightbox opened
// from inside the "all reviews" modal — and a naive "save on mount, restore
// on unmount" per instance would have the second lock overwrite the first
// one's saved state, then the first unmount restore the WRONG (already
// locked) styles, leaving the page stuck unscrollable after both close.
// Counting instead: only the very first lock call captures real state, and
// only the very last unlock call restores it.
let lockCount = 0;
let savedScrollY = 0;
let savedBodyStyle: {
  position: string;
  top: string;
  left: string;
  right: string;
  width: string;
  overflow: string;
} | null = null;

function lockBodyScroll() {
  if (lockCount === 0) {
    savedScrollY = window.scrollY;
    const body = document.body;
    savedBodyStyle = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
    };
    // `overflow: hidden` alone stops desktop browsers from scrolling the
    // page behind a modal, but iOS Safari ignores it and still lets touch
    // scrolling move the body underneath a fixed-position overlay. Pinning
    // the body itself with `position: fixed` (offset by the current scroll
    // position, so nothing visibly jumps) is what actually blocks it there
    // too — this is the standard cross-browser body-scroll-lock technique.
    body.style.position = 'fixed';
    body.style.top = `-${savedScrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    body.style.overflow = 'hidden';
  }
  lockCount++;
}

function unlockBodyScroll() {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0 && savedBodyStyle) {
    const body = document.body;
    body.style.position = savedBodyStyle.position;
    body.style.top = savedBodyStyle.top;
    body.style.left = savedBodyStyle.left;
    body.style.right = savedBodyStyle.right;
    body.style.width = savedBodyStyle.width;
    body.style.overflow = savedBodyStyle.overflow;
    // Restores the exact scroll position the page was at before the lock —
    // required because pinning the body with `position: fixed` above would
    // otherwise silently reset the visible scroll to the top on unlock.
    //
    // `behavior: 'instant'` is required here, not optional — this site's
    // globals.css sets `html { scroll-behavior: smooth }` globally, and a
    // plain `window.scrollTo(0, y)` inherits that. Without overriding it,
    // the page would render at the top for a frame (position: fixed is
    // already gone) and then visibly *animate* down to savedScrollY instead
    // of just being there — exactly the "flashes to the top, then quickly
    // slides back down" glitch this was written to fix. Passing an explicit
    // behavior bypasses the CSS setting entirely, per the scrollTo spec.
    window.scrollTo({ top: savedScrollY, left: 0, behavior: 'instant' });
    savedBodyStyle = null;
  }
}

/**
 * Locks page scroll (background content, on both desktop and mobile/iOS)
 * while `active` is true, and restores the exact previous scroll position
 * once it becomes false or the calling component unmounts.
 *
 * Shared by every modal/overlay in the app instead of each one reimplementing
 * this itself, so they all behave identically — and safe to call from
 * several mounted overlays at once, since the underlying lock is reference-
 * counted rather than each instance fighting over one shared style object.
 *
 * Usage: call unconditionally with `true` from a modal that's only ever
 * mounted while open (e.g. `{isOpen && <Modal />}` in the parent), or pass
 * the open/visible boolean directly for a component that stays mounted and
 * toggles visibility itself (e.g. a lightbox's `!!activeImage`).
 */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    lockBodyScroll();
    return () => unlockBodyScroll();
  }, [active]);
}
