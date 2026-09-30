'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';

type CarouselCategory = {
  id: string;
  name: string;
  nameRu?: string | null;
  slug: string;
  description?: string | null;
};

// Avtomatik almashinish oralig'i — reklama karuseli bilan bir xil maromda.
const AUTOPLAY_MS = 3500;

// Bosh sahifadagi kategoriyalar karuseli.
//
// AVVAL QANDAY EDI: bitta quti ichida kategoriyalar bir-biriga o'tib
// (crossfade) turardi — ya'ni ko'rinish o'zgarardi, lekin xaridor uni
// barmoq bilan surib ko'ra olmasdi.
//
// ENDI: reklama karuseli (components/home/BannerCarousel.tsx) bilan AYNAN
// bir xil mexanika — bitta gorizontal "lenta" va uni uchala yo'l bilan ham
// harakatlantirish mumkin:
//   1) avtomatik almashinish (AUTOPLAY_MS),
//   2) qo'lda surish — telefonda barmoq, kompyuterda trackpad
//      (native scroll-snap),
//   3) pastdagi nuqtalar.
// Qaysi yo'l bilan almashtirilmasin, faol nuqta ham, keyingi avtomatik
// qadam ham doim to'g'ri joydan davom etadi, chunki holat bitta manbadan —
// lentaning o'z scroll holatidan — o'qiladi.
export function CategoryCarousel({
  categories,
  locale,
}: {
  categories: CarouselCategory[];
  locale: string;
}) {
  const stripRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  // Xaridor lentani o'zi surayotganda avtomatik almashinish to'xtaydi —
  // aks holda taymer barmoq ostidan kartani tortib ketardi.
  const [paused, setPaused] = useState(false);

  const scrollToIndex = useCallback((index: number) => {
    const el = stripRef.current;
    if (!el) return;
    el.scrollTo({ left: index * el.clientWidth, behavior: 'smooth' });
  }, []);

  function handleScroll() {
    const el = stripRef.current;
    if (!el || el.clientWidth === 0) return;
    const index = Math.round(el.scrollLeft / el.clientWidth);
    setActiveIndex((prev) => (prev === index ? prev : index));
  }

  useEffect(() => {
    if (paused || categories.length <= 1) return;
    const timer = setInterval(() => {
      const el = stripRef.current;
      if (!el || el.clientWidth === 0) return;
      const next = (Math.round(el.scrollLeft / el.clientWidth) + 1) % categories.length;
      el.scrollTo({ left: next * el.clientWidth, behavior: 'smooth' });
    }, AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [paused, categories.length]);

  if (categories.length === 0) return null;

  return (
    <div
      className="relative overflow-hidden rounded-3xl"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      // Barmoq tekkanda pauza, qo'yib yuborilgandan keyin davom etadi.
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => setPaused(false)}
    >
      <div
        ref={stripRef}
        onScroll={handleScroll}
        // scroll-snap — surish aynan bitta kategoriyaga "yopishadi";
        // `no-scrollbar` esa ko'rinmas scrollbar (globals.css dagi mavjud
        // yordamchi klass).
        className="no-scrollbar flex w-full snap-x snap-mandatory overflow-x-auto"
      >
        {categories.map((cat) => (
          <Link
            key={cat.id}
            href={`/${locale}/shop?category=${cat.slug}`}
            prefetch={false}
            // `w-full flex-none` — har bir karta aynan lentaning kengligi,
            // ya'ni ekranda doim bittasi to'liq ko'rinadi.
            className="group relative flex h-64 w-full flex-none snap-center items-center justify-center overflow-hidden bg-ink-950 text-cream sm:h-80"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-ink-950 via-ink-900 to-ink-950 opacity-90 transition-opacity group-hover:opacity-100" />
            {/* Yumshoq aksent doiralari (blur'siz — og'ir CSS tozalangan). */}
            <div className="absolute -right-10 -top-10 h-56 w-56 rounded-full bg-gold-500/10 transition-transform duration-500 group-hover:scale-125" />
            <div className="absolute -left-10 -bottom-10 h-56 w-56 rounded-full bg-gold-600/8 transition-transform duration-500 group-hover:scale-125" />

            <div className="relative flex flex-col items-center justify-center px-8 text-center">
              <span className="font-display text-4xl font-medium sm:text-5xl">
                {locale === 'ru' && cat.nameRu ? cat.nameRu : cat.name}
              </span>
              {cat.description && (
                <p className="mt-3 max-w-md text-sm text-cream/60">{cat.description}</p>
              )}
            </div>
          </Link>
        ))}
      </div>

      {/* Nuqtalar — bosilsa o'sha kategoriyaga o'tadi. Lentaning ustida
          suzib turadi, shuning uchun `pointer-events-none` bilan
          o'ralgan: faqat nuqtalarning o'zi bosiladi, ular orasidagi
          bo'shliq esa kartaga tegishli bo'lib qolaveradi. */}
      {categories.length > 1 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-5 z-10 flex items-center justify-center gap-2">
          {categories.map((cat, i) => (
            <button
              key={cat.id}
              type="button"
              aria-label={locale === 'ru' && cat.nameRu ? cat.nameRu : cat.name}
              aria-current={i === activeIndex}
              onClick={() => scrollToIndex(i)}
              className={`pointer-events-auto h-1.5 rounded-full transition-all duration-300 ${
                i === activeIndex ? 'w-6 bg-gold-400' : 'w-1.5 bg-cream/30 hover:bg-cream/60'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
