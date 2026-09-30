'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Adaptive-contrast helper for the floating glass navbars.
 *
 * The problem: in LIGHT theme, most of the page is light (so dark
 * text/icons in the navbar read fine), but a handful of sections are
 * unconditionally dark regardless of theme — right now just the homepage
 * hero (`bg-ink-950`, no `dark:` pairing, by design for a premium look).
 * When the floating header or bottom nav happens to be sitting over one of
 * those, dark-on-dark makes the text/icons nearly invisible — exactly what
 * showed up in testing. In DARK theme this never comes up: virtually the
 * whole page is already dark there, so the existing `.dark` CSS override
 * in globals.css already forces navbar text to light everywhere, no JS
 * needed.
 *
 * The fix: any section that's unconditionally dark gets tagged
 * `data-navbar-contrast="dark"` in its JSX (currently just the homepage
 * hero in page.tsx). This hook watches the page and reports whether one of
 * those tagged sections currently overlaps a given horizontal probe line
 * (in viewport pixels from the top) — i.e. whether it's actually behind
 * the navbar right now, not just present somewhere on the page.
 *
 * @param getProbeY Returns the current probe line's y position in viewport
 *   pixels. A function (not a plain number) because the bottom nav's probe
 *   line depends on window.innerHeight, which can change (rotation,
 *   resize) independently of anything React would naturally re-render for.
 */
export function useNavbarContrast(getProbeY: () => number) {
  const pathname = usePathname();
  const [overDark, setOverDark] = useState(false);

  useEffect(() => {
    let frame: number | null = null;

    function check() {
      const probeY = getProbeY();
      const sections = document.querySelectorAll('[data-navbar-contrast="dark"]');
      let found = false;
      sections.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.top <= probeY && rect.bottom >= probeY) found = true;
      });
      setOverDark(found);
    }

    function onScrollOrResize() {
      if (frame !== null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        check();
      });
    }

    // Run once immediately, plus once more after layout settles — images/
    // fonts loading in can shift section heights right after first paint.
    check();
    const settleTimer = setTimeout(check, 300);

    window.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize);
      window.removeEventListener('resize', onScrollOrResize);
      if (frame !== null) cancelAnimationFrame(frame);
      clearTimeout(settleTimer);
    };
    // Re-checks on every route change: a client-side navigation swaps out
    // which (if any) data-navbar-contrast sections exist in the DOM
    // without necessarily firing a scroll/resize event on its own.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return overDark;
}
