'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { Locale } from '@/i18n/config';

export interface BannerItem {
  id: string;
  image: string;
  title?: string | null;
  titleRu?: string | null;
  // "NONE" | "PRODUCT" | "CATEGORY"
  linkType: string;
  productSlug?: string | null;
  categorySlug?: string | null;
  // linkType = "PRODUCTS" — bannerga biriktirilgan bir nechta tovar.
  products?: { id: string }[] | null;
}

interface BannerCarouselProps {
  banners: BannerItem[];
  locale: Locale;
}

// Avtomatik almashinish oralig'i — 3 soniya.
const AUTOPLAY_MS = 3000;

// Bosh sahifadagi reklama karuseli.
//
// Bitta gorizontal "lenta" (strip) — uchala boshqaruv ham AYNAN shuni
// harakatlantiradi, ya'ni uchta alohida amalga oshiruv emas:
//   1) avtomatik almashinish (AUTOPLAY_MS),
//   2) qo'lda surish — telefonda barmoq bilan (native scroll-snap),
//      kompyuterda trackpad/sichqoncha bilan,
//   3) pastdagi nuqtalar (dots).
// Shu sababli qaysi yo'l bilan almashtirilmasin, faol nuqta ham,
// keyingi avtomatik qadam ham doim to'g'ri joydan davom etadi.
//
// Rasmlar admin panelning "Reklamalar" bo'limidan keladi (hardcode yo'q).
// Banner bosilganda — mahsulot yoki kategoriya sahifasiga o'tadi; hech
// qaysisi tanlanmagan bo'lsa bosilmaydigan oddiy rasm bo'lib turadi.
export function BannerCarousel({ banners, locale }: BannerCarouselProps) {
  const stripRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  // Xaridor lentani o'zi surayotganda avtomatik almashinish to'xtaydi —
  // aks holda taymer barmoq ostidan rasmni tortib ketardi.
  const [paused, setPaused] = useState(false);

  const scrollToIndex = useCallback((index: number) => {
    const el = stripRef.current;
    if (!el) return;
    el.scrollTo({ left: index * el.clientWidth, behavior: 'smooth' });
  }, []);

  // Qo'lda surilganda faol nuqtani yangilaydi. Lentaning scroll holatidan
  // hisoblanadi, ya'ni barmoq bilan surilgan bo'lsa ham, nuqta bosilgan
  // bo'lsa ham bitta manbadan.
  function handleScroll() {
    const el = stripRef.current;
    if (!el || el.clientWidth === 0) return;
    const index = Math.round(el.scrollLeft / el.clientWidth);
    setActiveIndex((prev) => (prev === index ? prev : index));
  }

  useEffect(() => {
    if (paused || banners.length <= 1) return;
    const timer = setInterval(() => {
      const el = stripRef.current;
      if (!el || el.clientWidth === 0) return;
      const next = (Math.round(el.scrollLeft / el.clientWidth) + 1) % banners.length;
      el.scrollTo({ left: next * el.clientWidth, behavior: 'smooth' });
    }, AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [paused, banners.length]);

  if (banners.length === 0) return null;

  return (
    <section className="bg-white pt-4 dark:bg-ink-950 sm:pt-6">
      {/* container-app — saytdagi boshqa bo'limlar bilan bir xil chetki
          bo'shliq. `overflow-hidden` + ichkaridagi `w-full` rasm 320px
          kenglikdagi telefonda ham gorizontal scroll chiqarmasligini
          kafolatlaydi. */}
      <div className="container-app">
        <div
          className="relative overflow-hidden rounded-2xl"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          // Barmoq tekkanda pauza, qo'yib yuborilgandan keyin davom etadi.
          onTouchStart={() => setPaused(true)}
          onTouchEnd={() => setPaused(false)}
        >
          <div
            ref={stripRef}
            onScroll={handleScroll}
            // scroll-snap — telefonda surish aynan bitta bannerga
            // "yopishadi"; `no-scrollbar` esa ko'rinmas scrollbar
            // (globals.css'dagi mavjud yordamchi klass, mahsulot
            // kartochkasidagi rasm lentasi ham shuni ishlatadi).
            className="no-scrollbar flex w-full snap-x snap-mandatory overflow-x-auto"
          >
            {banners.map((banner, i) => {
              const title = locale === 'ru' && banner.titleRu ? banner.titleRu : banner.title;
              // Bir nechta tovar biriktirilgan bo'lsa — do'kon sahifasi
              // FAQAT o'sha tovarlarni ko'rsatadi (`?products=id1,id2`).
              // Alohida sahifa yasalmadi: mavjud do'kon sahifasi
              // to'rlari, saralashi va sahifalashi shundoq ishlayveradi.
              const bannerProductIds = (banner.products ?? []).map((p) => p.id);
              const href =
                banner.linkType === 'PRODUCT' && banner.productSlug
                  ? `/${locale}/product/${banner.productSlug}`
                  : banner.linkType === 'PRODUCTS' && bannerProductIds.length > 0
                    ? `/${locale}/shop?products=${bannerProductIds.join(',')}`
                    : banner.linkType === 'CATEGORY' && banner.categorySlug
                      ? `/${locale}/shop?category=${encodeURIComponent(banner.categorySlug)}`
                      : null;

              const inner = (
                <div className="relative h-full w-full">
                  <Image
                    src={banner.image}
                    alt={title || 'Banner'}
                    fill
                    // Birinchi banner darhol ko'rinadi — u LCP (sahifadagi
                    // eng katta element) bo'lishi mumkin, qolganlari esa
                    // kerak bo'lganda yuklanadi.
                    priority={i === 0}
                    sizes="(max-width: 1024px) 100vw, 1200px"
                    className="object-cover"
                    unoptimized
                  />
                  {title && (
                    <>
                      {/* Matn ostidagi qoraytirish — oq harflar och rangli
                          rasmda ham o'qiladigan bo'lishi uchun. */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                      <p className="absolute inset-x-4 bottom-4 line-clamp-2 text-sm font-semibold text-white drop-shadow sm:inset-x-6 sm:bottom-6 sm:text-lg">
                        {title}
                      </p>
                    </>
                  )}
                </div>
              );

              // Balandlik nisbati: telefonda balandroq (16:9), kattaroq
              // ekranlarda yassiroq — shunda banner sahifaning yarmini
              // egallab ketmaydi.
              const slideClass =
                'relative aspect-[16/9] w-full flex-none snap-center overflow-hidden bg-ink-900/5 dark:bg-cream/5 sm:aspect-[21/9] lg:aspect-[3/1]';

              return href ? (
                <Link key={banner.id} href={href} prefetch={false} className={slideClass}>
                  {inner}
                </Link>
              ) : (
                <div key={banner.id} className={slideClass}>
                  {inner}
                </div>
              );
            })}
          </div>

          {banners.length > 1 && (
            <div className="pointer-events-none absolute inset-x-0 bottom-2.5 flex items-center justify-center gap-1.5">
              {banners.map((banner, i) => (
                <button
                  key={banner.id}
                  type="button"
                  aria-label={`${i + 1}/${banners.length}`}
                  aria-current={i === activeIndex}
                  onClick={() => scrollToIndex(i)}
                  className={`pointer-events-auto h-1.5 rounded-full transition-all duration-300 ${
                    i === activeIndex ? 'w-5 bg-gold-500' : 'w-1.5 bg-white/60 hover:bg-white/90'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
