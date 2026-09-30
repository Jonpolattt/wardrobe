'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, Heart, LayoutGrid, LogIn, ShoppingCart, Store, User2 } from 'lucide-react';
import { useQuery } from '@apollo/client';
import { GET_MY_CART, GET_MY_WISHLIST } from '@/lib/graphql/queries';
import { useAuthStore } from '@/lib/store/auth-store';
import { LanguageSwitcher } from './LanguageSwitcher';
import { LanguageMenu } from './LanguageMenu';
import { ThemeToggle } from './ThemeToggle';
import { CatalogPanel } from './CatalogPanel';
import { HeaderSearch } from './HeaderSearch';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/get-dictionary';

interface HeaderProps {
  locale: Locale;
  dict: Dictionary;
}

// Asosiy header shu nuqtaga yetganda `fixed` bo'ladi...
const SCROLL_ENTER = 60;
// ...va faqat shundan PASTGA tushgandagina qaytib oddiy holatga o'tadi.
// 50–59px oralig'ida joriy holat saqlanadi. Ikkita ALOHIDA chegara
// (gisterezis) ataylab: bitta chegara bo'lganda, aynan o'sha nuqtadagi
// bir piksellik tebranish ham holatni ketma-ket almashtirib, header
// titrab turardi.
const SCROLL_LEAVE = 50;
// Ekran tepasidan masofa (fixed holatda).
const FIXED_TOP = 12;
// Yumshoqroq egri chiziq: avvalgi `0.22,1,0.36,1` (quint) juda tez
// boshlanib, keskin to'xtardi. `0.33,1,0.68,1` (cubic) — bir xil
// yo'nalish, lekin yumshoqroq kirish va sekinroq to'xtash.
const EASING = 'cubic-bezier(0.33, 1, 0.68, 1)';

export function Header({ locale, dict }: HeaderProps) {
  const user = useAuthStore((s) => s.user);
  const pathname = usePathname();

  const { data: cartData } = useQuery(GET_MY_CART, { skip: !user, fetchPolicy: 'cache-first' });
  const { data: wishlistData } = useQuery(GET_MY_WISHLIST, { skip: !user, fetchPolicy: 'cache-first' });

  const cartCount = cartData?.myCart?.reduce((sum: number, i: any) => sum + i.quantity, 0) ?? 0;
  const wishlistCount = wishlistData?.myWishlist?.length ?? 0;

  // ── Scroll holati va SILLIQ O'TISH (FLIP) ───────────────────────────
  //
  // MUAMMO: `position: static` va `position: fixed` o'rtasidagi o'tishni
  // CSS animatsiya qila olmaydi — element bir kadrda o'z joyidan
  // ekranning tepasiga "sakraydi". Avvalgi versiyada aynan shu sakrash
  // ko'rinib turardi.
  //
  // YECHIM (FLIP usuli):
  //   1. Holat almashishidan OLDIN panelning ekrandagi joriy koordinatasi
  //      o'lchanadi (`fromTopRef`).
  //   2. React `fixed` ni qo'llagach (useLayoutEffect — brauzer hali
  //      chizmasdan turib), panel `translateY` bilan AVVALGI ko'rinadigan
  //      joyida ushlab turiladi. Ya'ni ko'z uchun hech narsa siljimaydi.
  //   3. Keyingi kadrda `translateY(0)` ga 420ms davomida o'tadi.
  // Masofa har safar HAQIQIY farqdan hisoblanadi (joriy koordinata bilan
  // yangi `top: 12px` orasidagi), sun'iy bir xil qiymatdan emas.
  //
  // `position` ning o'zi umuman animatsiya qilinmaydi — butun silliq
  // harakat faqat `transform` orqali.
  const [fixed, setFixed] = useState(false);
  // ── Qotib qolish (fixed) FAQAT DESKTOPDA ────────────────────────────
  // Telefonda talab boshqacha: yuqori qator (logotip va h.k.) sahifa
  // bilan birga tepaga chiqib KETADI, qidiruv qatori esa ekran tepasida
  // yopishib qoladi (u endi HeaderGate ichida, `sticky` holatda —
  // MobileSearchBar.tsx izohiga qarang).
  //
  // Breakpoint bu yerda JS orqali o'qiladi, chunki qaror inline
  // `style` (spacer balandligi) va `position` klassiga ta'sir qiladi —
  // ularni `lg:` bilan yozib bo'lmaydi. `change` hodisasi tinglanadi,
  // shuning uchun oyna kengligi o'zgarganda holat darhol to'g'rilanadi.
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const apply = () => setIsDesktop(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);
  const fixedNow = fixed && isDesktop;
  const shellRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const fixedRef = useRef(false);
  const fromTopRef = useRef<number | null>(null);
  const rafRef = useRef(0);

  const prefersReducedMotion = useCallback(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const y = window.scrollY;
      const next = fixedRef.current ? y >= SCROLL_LEAVE : y >= SCROLL_ENTER;
      if (next === fixedRef.current) return;
      // Holat o'zgarishidan oldingi koordinatani saqlab qolamiz.
      fromTopRef.current = panelRef.current?.getBoundingClientRect().top ?? null;
      fixedRef.current = next;
      setFixed(next);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  // Holat almashgach — yuqoridagi izohdagi 2- va 3-qadamlar.
  // `useLayoutEffect`: brauzer yangi joylashuvni CHIZISHDAN OLDIN
  // ishlaydi, shuning uchun oraliq kadrda sakrash umuman ko'rinmaydi.
  useLayoutEffect(() => {
    const el = panelRef.current;
    const from = fromTopRef.current;
    fromTopRef.current = null;
    // Birinchi renderda (from === null) animatsiya qilinmaydi.
    if (!el || from === null) return;

    const to = el.getBoundingClientRect().top;
    const delta = from - to;

    // Eski animatsiya qoldig'i yangi holatni buzmasligi uchun avval
    // tozalanadi (tez scroll yoki yo'nalish almashganda muhim).
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    if (!delta || prefersReducedMotion()) {
      // Harakat kamaytirilgan rejimda davomiylik 0ms — lekin `fixed`
      // ishlashi saqlanadi.
      el.style.transition = 'none';
      el.style.transform = '';
      return;
    }

    el.style.transition = 'none';
    el.style.transform = `translateY(${delta}px)`;
    // Reflow: brauzer yuqoridagi qiymatni "boshlang'ich holat" deb
    // qabul qilishi uchun majburan o'lchov olinadi. Busiz brauzer
    // ikkala o'zgarishni bitta kadrga birlashtirib, animatsiyani
    // umuman o'ynatmasdi.
    void el.offsetHeight;

    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      el.style.transition = `transform 420ms ${EASING}`;
      el.style.transform = 'translateY(0)';
    });

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    };
  }, [fixedNow, prefersReducedMotion]);

  // ── O'rin saqlovchi (spacer) balandligi ─────────────────────────────
  // `fixed` element hujjat oqimidan chiqib ketadi va o'zidan keyingi
  // hamma narsa uning balandligicha yuqoriga sakraydi. Tashqi wrapper
  // shu balandlikni ushlab turadi. Balandlik TAXMINIY emas — elementdan
  // o'lchanadi (u ekran kengligiga, mobil qidiruv qatoriga va shriftga
  // bog'liq), ResizeObserver esa uni yangilab turadi.
  const [panelHeight, setPanelHeight] = useState(0);
  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const measure = () => {
      // Faqat oddiy (fixed bo'lmagan) holatdagi balandlik o'lchanadi.
      if (!fixedRef.current) setPanelHeight(el.offsetHeight);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  // ── Katalog menyusi ──────────────────────────────────────────────────
  const [catalogOpen, setCatalogOpen] = useState(false);
  const catalogButtonRef = useRef<HTMLButtonElement>(null);

  // Sahifa almashganda menyu yopiladi (havola bosilganda ham, brauzer
  // "orqaga" tugmasi bosilganda ham).
  useEffect(() => {
    setCatalogOpen(false);
  }, [pathname]);

  // Tashqariga bosilganda yopiladi.
  useEffect(() => {
    if (!catalogOpen) return;
    function onPointerDown(e: MouseEvent | TouchEvent) {
      if (!panelRef.current?.contains(e.target as Node)) setCatalogOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setCatalogOpen(false);
        // Escape'dan keyin fokus kategoriya tugmasiga qaytadi.
        catalogButtonRef.current?.focus();
      }
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [catalogOpen]);

  const topLinks = [
    { href: `/${locale}/about`, label: dict.nav.about },
    { href: `/${locale}/contact`, label: dict.nav.contact },
    { href: `/${locale}/terms`, label: dict.terms.title },
  ];

  // Faqat ikonali tugmalar (sevimlilar, savat): bosish maydoni 44×44.
  const iconButtonClass =
    'relative flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] text-ink-900/80 transition-colors hover:bg-ink-900/5 hover:text-ink-950 dark:text-cream/80 dark:hover:bg-cream/5 dark:hover:text-cream';
  // Ikona + matnli chegarali tugmalar (Magazin, Profil).
  const pillButtonClass =
    'flex h-11 shrink-0 items-center gap-2 rounded-[10px] border border-[color:var(--surface-border)] px-4 text-[13px] font-medium group-[.is-fixed]:text-xs text-ink-900/85 transition-colors hover:border-gold-500 hover:text-gold-600 dark:text-cream/85 dark:hover:text-gold-400';
  const badgeClass =
    'absolute right-1 top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-gold-500 px-1 text-[10px] font-bold leading-none text-white';

  return (
    <header className="w-full">
      {/* ── 1) YUQORI QATOR ───────────────────────────────────────────
          Oddiy oqimda (position: static) — scroll qilinganda sahifa
          bilan birga yuqoriga chiqib ketadi. Ataylab `sticky`/`fixed`
          EMAS va atrofida oval kapsula yo'q: ostida faqat nozik
          ajratuvchi chiziq. Kichik ekranlarda ko'rsatilmaydi — u yerda
          bu havolalar pastki navigatsiya va footer orqali mavjud. */}
      {/* `relative z-[1001]` — MUHIM: bu qator hujjatda asosiy headerdan
          OLDIN turadi, asosiy header esa o'zining `z-[1000]` qatlamini
          hosil qiladi. Stacking konteksti bo'lmasa, til menyusining
          ochiladigan ro'yxati headerning ORQASIDA qolib ketardi va
          ustiga bosilganda bosish aslida headerga tushib, sahifa boshqa
          joyga o'tib ketardi (aynan shu nosozlik kuzatilgan). */}
      {/* Foni — asosiy bar bilan AYNAN bir xil (`--surface-header`).
          Avval foni yo'q edi va sahifaning `bg-cream` (#F8FAFC) rangi
          ko'rinib turardi: kunduzgi rejimda yuqori qator sal kulrang,
          bar esa oq bo'lib, ikkalasining chegarasi bilinib qolardi. */}
      <div className="relative z-[1001] hidden border-b border-[color:var(--surface-border)] bg-[color:var(--surface-header)] lg:block">
        {/* Ichkarida yana bir qatlam, `lg:px-5` bilan — asosiy
            headerdagi bar AYNAN shu ichki bo'shliqqa ega. Busiz yuqori
            qatordagi havolalar va pastdagi WARDROBE yozuvi bir chiziqda
            turmasdi: logo barning o'z paddingi hisobiga 20px o'ngga
            surilib qolardi. Ataylab alohida div — `container-app` ning
            o'z paddingini arbitrar qiymat bilan bosib o'tishga urinish
            CSS tartibiga bog'liq bo'lib, ishonchsiz bo'lardi. */}
        <div className="container-app">
          <div className="flex h-10 items-center justify-between lg:px-5">
            <nav className="flex items-center gap-6">
              {topLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  prefetch={false}
                  className="text-xs font-normal text-ink-900/60 transition-colors hover:text-ink-950 dark:text-cream/60 dark:hover:text-cream"
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            <div className="flex items-center gap-1">
              <ThemeToggle label={{ light: dict.admin.themeToggleLight, dark: dict.admin.themeToggleDark }} />
              <LanguageMenu locale={locale} />
            </div>
          </div>
        </div>
      </div>

      {/* ── 2) ASOSIY HEADER ──────────────────────────────────────────
          Scroll 60px ga yetganda `position: fixed` ga o'tadi va ekran
          tepasidan 12px masofada qotib qoladi. Pastga scroll davom
          etganda ham yo'qolmaydi.

          NEGA SPACER KERAK: `fixed` element hujjat oqimidan chiqib
          ketadi, ya'ni o'zidan keyingi hamma narsa uning balandligicha
          yuqoriga sakraydi. Pastdagi bo'sh element AYNAN o'sha
          balandlikni egallab turadi (balandlik o'lchanadi — yuqoridagi
          ResizeObserver'ga qarang), shuning uchun hujjatning umumiy
          balandligi ikkala holatda ham bir xil qoladi va kontent
          sakramaydi.

          NEGA KENGLIK O'ZGARMAYDI: tashqi `fixed` qatlam butun ekran
          kengligida (`inset-x-0`), haqiqiy kenglikni esa uning ichidagi
          o'sha bitta `container-app` beradi — ya'ni oddiy va fixed
          holatlarda bar bir xil kenglikda va bir xil gorizontal
          tekislanishda bo'ladi.

          `position` ni CSS orqali animatsiya qilib bo'lmaydi, shuning
          uchun silliq harakat FLIP usulida, faqat `transform` orqali
          bajariladi — yuqoridagi useLayoutEffect izohiga qarang. */}
      {/* O'rin saqlovchi wrapper: `fixed` holatda panel oqimdan chiqib
          ketgani uchun uning balandligini shu element ushlab turadi —
          hujjatning umumiy balandligi ikkala holatda bir xil qoladi,
          shuning uchun kontent sakramaydi. */}
      <div ref={shellRef} style={{ height: fixedNow ? panelHeight : undefined }}>
        <div
          ref={panelRef}
          // FON: barning O'ZI bilan bir xil rang (`--surface-header` —
          // kunduzgi rejimda toza oq, tungi rejimda #07111C). Avval bu
          // yerda `bg-cream` (#F8FAFC) turardi: bar oq, atrofi esa
          // sal kulrang oq bo'lib, kunduzgi rejimda barning chetlari
          // ko'zga tashlanardi. Endi butun header yo'lagi bir xil.
          //
          // Fon kichik ekranlarda ayniqsa zarur: u yerda bar va qidiruv
          // qatori orasida bo'shliq bor, fonsiz sahifa mazmuni o'sha
          // oraliqdan surilib o'tib ko'rinib qolardi.
          //
          // lg+ da fon FAQAT `fixed` holatda shaffof bo'ladi — "suzib
          // turuvchi" pill ko'rinishi aynan shundan hosil bo'ladi.
          // Oddiy (scroll qilinmagan) holatda esa shaffof emas, chunki
          // ayni shunda atrofi oq bo'lishi kerak.
          //
          // `will-change-transform` — FLIP animatsiyasi (yuqoridagi
          // useLayoutEffect) aynan shu elementning `transform`ini
          // harakatlantiradi.
          className={`bg-[color:var(--surface-header)] will-change-transform ${
            fixedNow ? 'fixed inset-x-0 z-[1000] lg:!bg-transparent' : 'relative z-[1000]'
          }`}
          style={fixedNow ? { top: FIXED_TOP } : undefined}
        >
        <div className="container-app">
          {/* Kenglik o'zgarishi: fixed holatda bar har ikki tomondan
              16px ichkariga kiradi (jami 32px torayadi) va 420ms
              davomida silliq bajariladi. Bu FAQAT headerga tegadi —
              sahifaning umumiy konteyneri va boshqa bo'limlar
              kengligi umuman o'zgarmaydi. Katalog paneli ham shu
              o'ramning ichida, shuning uchun u bar bilan birga
              toraya­di va chetlari doim tekis turadi.
              Kichik ekranlarda torayish yo'q (`lg:`) — u yerda 32px
              juda katta yo'qotish bo'lardi. */}
          <div
            className={`relative transition-[margin] duration-[420ms] ease-[cubic-bezier(.33,1,.68,1)] motion-reduce:transition-none ${
              fixedNow ? 'lg:mx-4' : 'mx-0'
            }`}
          >
          {/* `header-bar` klassi (globals.css) faqat KERAKLI
              xususiyatlarni animatsiya qiladi — `transition: all` emas:
              border-radius 420ms, box-shadow 420ms, border-color 300ms.
              Chegara uchun joy boshidanoq ajratilgan (`border` +
              shaffof rang), shuning uchun u paydo bo'lganda o'lcham
              o'zgarmaydi va kontent siljimaydi. Kenglik, max-width,
              shrift o'lchami va elementlar orasidagi masofa umuman
              animatsiya qilinmaydi. */}
          <div
            // `group` — ichkaridagi elementlar `group-[.is-fixed]:`
            // varianti orqali ixcham holatga reaksiya qilishi uchun.
            // Ichki bo'shliq oddiy holatda avvalgidek (12/20px), fixed
            // holatda esa kengayadi (20/32px) — buni globals.css dagi
            // `.header-bar.is-fixed` qoidasi 420ms bilan animatsiya
            // qiladi.
            className={`header-bar group flex h-16 items-center gap-3 border bg-[color:var(--surface-header)] px-3 lg:h-[76px] lg:gap-4 lg:px-5 xl:gap-5 ${
              fixedNow ? 'is-fixed' : ''
            }`}
          >
            {/* ── Logotip ── faqat WARDROBE yozuvi (ostidagi kichik
                "style lives here" qatori so'rovga ko'ra olib tashlandi). */}
            <Link
              href={`/${locale}`}
              prefetch={false}
              className="brand-wordmark shrink-0 text-[18px] font-semibold uppercase leading-none text-ink-950 transition-[font-size] duration-[420ms] ease-[cubic-bezier(.33,1,.68,1)] group-[.is-fixed]:lg:text-[19px] dark:text-cream lg:text-[22px]"
              style={{ letterSpacing: '0.14em' }}
            >
              Wardrobe
            </Link>

            {/* ── Kategoriya tugmasi (chegarali, 44px) ── */}
            <button
              ref={catalogButtonRef}
              type="button"
              onClick={() => setCatalogOpen((v) => !v)}
              aria-haspopup="dialog"
              aria-expanded={catalogOpen}
              className={`hidden h-11 shrink-0 items-center gap-2 rounded-[10px] border px-4 text-[13px] font-semibold transition-colors group-[.is-fixed]:text-xs lg:flex ${
                catalogOpen
                  ? 'border-gold-500 text-gold-600 dark:text-gold-400'
                  : 'border-[color:var(--surface-border)] text-ink-900/85 hover:border-gold-500 hover:text-gold-600 dark:text-cream/85 dark:hover:text-gold-400'
              }`}
            >
              <LayoutGrid size={18} strokeWidth={1.75} />
              <span>{dict.nav.category}</span>
              <ChevronDown
                size={15}
                className={`transition-transform duration-200 ${catalogOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {/* ── Qidiruv: qatordagi eng keng element ── */}
            <div className="hidden min-w-0 flex-1 lg:block">
              <HeaderSearch locale={locale} dict={dict} compact={fixedNow} onOpen={() => setCatalogOpen(false)} />
            </div>

            {/* ── O'ng tomon: Saralanganlar → Savat → Magazin → Profil ── */}
            <div className="ml-auto hidden shrink-0 items-center gap-2 lg:flex">
              <Link href={`/${locale}/wishlist`} prefetch={false} className={iconButtonClass} aria-label={dict.nav.wishlist} title={dict.nav.wishlist}>
                <Heart size={18} strokeWidth={1.75} />
                {wishlistCount > 0 && <span className={badgeClass}>{wishlistCount}</span>}
              </Link>

              <Link href={`/${locale}/cart`} prefetch={false} className={iconButtonClass} aria-label={dict.nav.cart} title={dict.nav.cart}>
                {/* G'ildirakli outline savat ikonkasi — sayt bo'ylab bir xil. */}
                <ShoppingCart size={18} strokeWidth={1.75} />
                {cartCount > 0 && <span className={badgeClass}>{cartCount}</span>}
              </Link>

              <Link href={`/${locale}/shop`} prefetch={false} className={pillButtonClass}>
                <Store size={17} strokeWidth={1.75} />
                <span className="hidden xl:inline">{dict.nav.shop}</span>
              </Link>

              {/* Bitta havola: mehmon -> Kirish, tizimga kirgan -> Profil.
                  Admin paneliga kirish profil sahifasi orqali saqlanib
                  qoladi — asosiy headerda alohida "Admin panel" tugmasi
                  ataylab ko'rsatilmaydi. */}
              <Link href={`/${locale}/${user ? 'profile' : 'login'}`} prefetch={false} className={pillButtonClass}>
                {user ? <User2 size={17} strokeWidth={1.75} /> : <LogIn size={17} strokeWidth={1.75} />}
                <span className="hidden xl:inline">{user ? dict.nav.profile : dict.nav.login}</span>
              </Link>
            </div>

            {/* ── Kichik ekranlar: MAVJUD tuzilma o'zgartirilmadi ── */}
            <div className="ml-auto flex shrink-0 items-center gap-2 lg:hidden">
              <LanguageSwitcher locale={locale} />
              <ThemeToggle label={{ light: dict.admin.themeToggleLight, dark: dict.admin.themeToggleDark }} />
            </div>
          </div>

          {/* Katalog paneli — bar ICHIDA emas, uning ostida, shu
              `container-app` ning ichki chetlariga tekislangan. Shuning
              uchun u oval headerning chegarasida kesilib qolmaydi va
              headerning tashqi kengligiga ham tegmaydi. */}
            <div className="hidden lg:block">
              <CatalogPanel open={catalogOpen} onClose={() => setCatalogOpen(false)} locale={locale} dict={dict} />
            </div>
          </div>
        </div>

          {/* Kichik ekranlardagi qidiruv qatori bu yerdan OLIB
              TASHLANDI: u endi headerdan tashqarida, HeaderGate ichida
              `sticky` holatda turadi. Sababi — `sticky` element faqat
              o'z OTASI ko'rinib turganda yopishib turadi; header ichida
              qolsa, header tepaga chiqib ketishi bilan u ham g'oyib
              bo'lardi. */}
        </div>
      </div>
    </header>
  );
}
