'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useNavLoadingStore } from '@/lib/store/shop-loading-store';

// Root-only path ("/uz", "/ru", with or without a trailing slash) — the
// Home page, and nothing nested under it (so "/uz/shop" etc. don't match).
const HOME_PATH_RE = /^\/(uz|ru)\/?$/i;

/**
 * Yengil, tashqi kutubxonasiz global "sahifa yuklanmoqda" progress-chizig'i.
 *
 * Muammo: Next.js'ning `loading.tsx` fayllari FAQAT server komponentlarning
 * ma'lumot olish bosqichini qamrab oladi. Admin panel va boshqa 'use client'
 * sahifalar ma'lumotni Apollo `useQuery` orqali CLIENT tomonda oladi — bu
 * `loading.tsx`ga umuman ko'rinmaydi. Natijada: foydalanuvchi bir bo'limdan
 * ikkinchisiga (yoki magazin ro'yxatidan uning ichki sahifasiga) o'tish
 * uchun bosadi-yu, yangi sahifa mount bo'lib o'z ichidagi so'rovini
 * boshlagunga qadar ekranda HECH NARSA o'zgarmaydi — "bosdim, lekin hech
 * narsa bo'lmadi" tuyg'usi shundan kelib chiqadi.
 *
 * Yechim: har qanday ichki <Link>/<a> bosilishi bilan DARHOL (hali hech
 * qanday ma'lumot so'ralmasdan turib) yuqorida yupqa chiziq paydo bo'ladi va
 * asta-sekin to'ladi; manzil (yoki query-parametr — filtr/sahifalash)
 * haqiqatan almashgach chiziq 100% ga to'lib, yo'qoladi. Har bir sahifaning
 * o'zidagi `if (loading) return <spinner/>` bilan bir xil maqsadga xizmat
 * qiladi, faqat "bosilgan zahoti"ni ham qamrab oladi.
 */
function RouteProgressBarInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(false);
  const [width, setWidth] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const isFirstRun = useRef(true);

  useEffect(() => {
    function clearTimers() {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    }

    function handleClick(e: MouseEvent) {
      // O'ng/o'rta tugma, modifikator tugmalar bilan bosish (yangi tabda
      // ochish niyati) yoki allaqachon bekor qilingan hodisani e'tiborsiz
      // qoldiramiz.
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const anchor = (e.target as HTMLElement)?.closest('a');
      if (!anchor) return;
      if (anchor.target && anchor.target !== '_self') return;
      if (anchor.hasAttribute('download')) return;

      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;

      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      // Faqat shu saytning ICHKI sahifalariga o'tishda ishga tushadi —
      // tashqi havolalar yoki xuddi shu sahifaga bosilganda chiziq
      // ko'rsatilmaydi.
      if (url.origin !== window.location.origin) return;
      if (url.pathname + url.search === window.location.pathname + window.location.search) return;

      // Entering /shop or Home from anywhere else (this click is on a real
      // <a>, e.g. the navbar's "Магазин"/"Главная" link) — hand off to
      // NavLoadingOverlay's full-page skeleton instead of just this thin
      // top line. Filter/sort/pagination clicks on the shop page itself
      // go through router.push() directly (no <a> to catch here), so
      // ShopFilters/SortDropdown/Pagination call the store's start()
      // themselves — see those files.
      if (url.pathname.endsWith('/shop')) {
        useNavLoadingStore.getState().start('shop');
      } else if (HOME_PATH_RE.test(url.pathname)) {
        useNavLoadingStore.getState().start('home');
      }

      clearTimers();
      setVisible(true);
      setWidth(15);
      // Asta-sekin to'ldirib boradi — agar ma'lumot tez kelsa (masalan
      // keshdan) chiziq hali 100%ga yetmasdanoq keyingi effekt uni tugatadi;
      // sekin bo'lsa, chiziq "sekinlashib" foydalanuvchini ishonchli kutadi.
      timers.current.push(setTimeout(() => setWidth(45), 150));
      timers.current.push(setTimeout(() => setWidth(70), 500));
      timers.current.push(setTimeout(() => setWidth(85), 1400));
    }

    // MUHIM: CAPTURE bosqichida ("true") tinglaymiz, BUBBLE bosqichida
    // emas. Sabab: Next.js <Link/> o'zining klik handlerini React orqali
    // ildiz konteynerga ulaydi, u DOM bo'ylab documentdan OLDIN (bubble
    // paytida) ishga tushadi va navigatsiyani (shu jumladan URL'ni)
    // SINXRON boshlab yuboradi. Agar biz ham bubble bosqichida tinglasak,
    // bizning handler ULGURMAY QOLADI — Link handleri allaqachon ishlagan,
    // window.location YANGI manzilga o'zgargan bo'ladi, va pastdagi
    // "hozirgi manzilga teng" tekshiruvi noto'g'ri true qaytarib chiziqni
    // umuman ko'rsatmay qo'yardi (aynan shu sabab chiziq "bosgandan keyin
    // emas, sahifa allaqachon o'tib bo'lgandan keyin" chiqayotgandek
    // tuyulardi — aslida chiziq umuman chiqmagan, faqat yangi sahifaning
    // o'zidagi eski ichki spinner ko'rinar edi). CAPTURE bosqichida esa biz
    // Link'ning o'z handleridan OLDIN ishga tushamiz — shu payt window.
    // location hali ESKI manzilda, taqqoslash to'g'ri ishlaydi va chiziq
    // bosilgan zahoti (navigatsiya boshlanishidan oldin) paydo bo'ladi.
    document.addEventListener('click', handleClick, true);
    return () => {
      document.removeEventListener('click', handleClick, true);
      clearTimers();
    };
  }, []);

  // Manzil yoki query-parametrlar (filtr, sahifalash, sort) haqiqatan
  // almashgach — bu yangi sahifa/ma'lumot ekranga chiqqanini bildiradi —
  // chiziqni to'ldirib, so'ng yashiramiz.
  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    setWidth((w) => (w > 0 ? 100 : w));
    // Real content for wherever we just landed is ready the moment
    // pathname/searchParams themselves have updated — that's this exact
    // effect firing. Clearing the store here, not on a timer, is what
    // makes NavLoadingOverlay disappear in the same instant the fresh
    // page is actually there to reveal, however long the fetch itself
    // took.
    useNavLoadingStore.getState().finish();
    const hide = setTimeout(() => {
      setVisible(false);
      setWidth(0);
    }, 200);
    return () => clearTimeout(hide);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed left-0 top-0 z-[200] h-[3px] w-full">
      <div
        className="h-full bg-gold-500 shadow-[0_0_8px_rgba(70,95,255,0.55)] transition-all duration-300 ease-out"
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

export function RouteProgressBar() {
  // useSearchParams Next.js App Router'da Suspense chegarasini talab
  // qiladi — bo'lmasa build vaqtida ogohlantirish/xato beradi.
  return (
    <Suspense fallback={null}>
      <RouteProgressBarInner />
    </Suspense>
  );
}
