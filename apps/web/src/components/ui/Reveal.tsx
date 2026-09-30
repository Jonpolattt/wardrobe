'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // null = server render / not yet measured on the client. true = already
  // inside the viewport the moment it mounted — never animate it. false =
  // confirmed below the fold at mount — play the normal scroll-triggered
  // fade-in via whileInView, exactly as before.
  const [alreadyInView, setAlreadyInView] = useState<boolean | null>(null);

  // useLayoutEffect: runs synchronously right after mount, before paint.
  useLayoutEffect(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    setAlreadyInView(rect.top < window.innerHeight && rect.bottom > 0);
  }, []);

  // ROOT-CAUSE FIX (see investigation notes): the previous version always
  // rendered a <motion.div initial={{opacity:0, y:28}}>, even for the
  // `null` (server-rendered / not-yet-measured) case — which means EVERY
  // Reveal instance's real content (hero heading, "why us" cards, best
  // sellers heading + all 8 product cards, banner heading — on the home
  // page that's nearly the entire visible page) shipped in the server
  // HTML itself already hidden at opacity:0. That's invisible by design
  // for a fraction of a second on a fast device, but on a slow/cold iOS
  // Safari load — first request of a fresh session, full JS bundle still
  // downloading before React can hydrate anything — that opacity:0 state
  // can sit on screen for 20-30+ seconds before hydration ever reaches
  // this component and lifts it. Confirmed frame-by-frame from a screen
  // recording of a cold first load: header and bottom nav (not wrapped in
  // Reveal) render and work immediately, while the entire middle of the
  // page between them stays a blank, contentless block for the rest of
  // the recording — exactly the set of elements Reveal wraps, and nothing
  // else. This reproduced with NO dependency on which locale (`/ru` vs
  // `/uz`) was requested — it's about how much of a given PAGE's content
  // is wrapped in Reveal, not the route/locale.
  //
  // Fix: render a plain, always-visible <div> — no framer-motion, no
  // inline opacity — for the server render and for the `true` (already
  // in view) case, so real content is on screen immediately regardless of
  // how long hydration takes. Only once we've confirmed, client-side,
  // that an element is genuinely below the fold do we swap in a fresh
  // <motion.div initial={{opacity:0}}>. That swap happens while the
  // element is still off-screen (by definition, since alreadyInView is
  // false), so the user never sees it — and because it's a brand-new
  // component instance, framer-motion's `initial` applies fresh, so the
  // below-fold slide-up-and-fade-in on scroll still plays exactly as
  // designed. (A conditional `initial` prop on the SAME motion.div
  // instance would not work here — framer-motion only reads `initial` at
  // that instance's first mount, so swapping component type is what
  // makes the fresh hidden-state apply.)
  //
  // Per follow-up request: the plain <div> branch below (server render +
  // "already in view at mount") now plays a first-load slide-up-and-fade
  // entrance too, via the `reveal-fade-up` CSS keyframe (globals.css) —
  // NOT framer-motion, specifically so this can't reintroduce the bug
  // above: a CSS `animation` starts playing the instant the browser paints
  // the element, regardless of whether/when React ever hydrates, so
  // content can never get stuck invisible on a slow load the way the old
  // always-on <motion.div> could. `animationDelay` reuses the same
  // stagger value the below-fold branch already gets via `delay`.
  if (alreadyInView === false) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
        className={className}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <div
      ref={ref}
      className={className ? `${className} reveal-fade-up` : 'reveal-fade-up'}
      style={delay ? { animationDelay: `${delay}s` } : undefined}
    >
      {children}
    </div>
  );
}
