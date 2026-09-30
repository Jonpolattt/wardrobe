'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useForm, Controller } from 'react-hook-form';
import { useMutation, useQuery } from '@apollo/client';
import {
  User2,
  Package,
  Pencil,
  X,
  ArrowRight,
  Heart,
  ArrowLeft,
  ChevronRight,
  Check,
  Sun,
  Moon,
  Globe,
} from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut, ShieldCheck } from 'lucide-react';
import { useThemeStore } from '@/lib/store/theme-store';
import { FlagIcon } from '@/components/ui/FlagIcon';
import { locales, localeNames } from '@/i18n/config';
import { GET_ME, GET_MY_ORDERS } from '@/lib/graphql/queries';
import { UPDATE_PROFILE } from '@/lib/graphql/mutations';
import { useAuthStore } from '@/lib/store/auth-store';
import { formatPrice, formatDate } from '@/lib/utils/format';
import { resolveProductCoverImage } from '@/lib/utils/productImage';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { Reveal } from '@/components/ui/Reveal';
import { useScrollLock } from '@/lib/hooks/use-scroll-lock';
import type { Locale } from '@/i18n/config';
import uzDict from '@/i18n/dictionaries/uz.json';
import ruDict from '@/i18n/dictionaries/ru.json';

interface ProfileForm {
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
}

// `theme` va `language` — FAQAT mobil ko'rinishdagi bo'limlar: telefonda
// header ko'rinmaydi, ya'ni undagi mavzu/til tugmalariga yo'l qolmaydi.
// Desktopda ular avvalgidek headerda turadi va bu ro'yxatda ko'rsatilmaydi.
type ProfileTab = 'orders' | 'info' | 'theme' | 'language';
type OrderFilter = 'all' | 'paid' | 'unpaid';

// Strips an optional leading "+998" (with or without a following space) and
// any other non-digit characters, then caps at 9 — turns whatever shape a
// stored phone happens to be in ("+998992132801", "+998 99 213 28 01", or
// even an old pre-+998 bare "975213130") into just the 9-digit tail
// PhoneInput's `value` prop expects. Pairs with `+998${digits}` below to
// reconstruct the full canonical value on every change/save.
function toPhoneDigits(phone: string) {
  return phone.replace(/^\+?998\s*/, '').replace(/\D/g, '').slice(0, 9);
}

export default function ProfilePage({ params }: { params: { locale: Locale } }) {
  const { locale } = params;
  const dict = locale === 'ru' ? ruDict : uzDict;
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const clearSession = useAuthStore((s) => s.clearSession);

  // Dashboard/sidebar navigation — which section is shown on the right.
  // Kept as in-page tab state (not separate routes) so switching sections
  // never re-triggers the full page's loading spinner.
  const [activeTab, setActiveTab] = useState<ProfileTab>('orders');
  const [orderFilter, setOrderFilter] = useState<OrderFilter>('all');

  // ── Mobil navigatsiya ────────────────────────────────────────────────
  // Telefonda profil ikki "ekran" bo'lib ishlaydi: asosiy menyu va
  // tanlangan bo'limning ichki ekrani. `mobileScreen === null` — menyu
  // ko'rinib turibdi. Yangi URL yoki sahifa qayta yuklanishi YO'Q:
  // ikkala ekran ham shu sahifada, faqat ko'rsatilishi almashadi.
  //
  // NEGA `activeTab` DAN ALOHIDA: desktopdagi o'ng ustun faqat
  // `activeTab` ga qaraydi va u hech qachon "mavzu"/"til" bo'lib
  // qolmaydi (ular telefonga xos bo'limlar). Shuning uchun telefonda
  // mavzu ekranini ochib qo'yib, oynani kengaytirib yuborilsa ham
  // desktopdagi ko'rinish buzilmaydi.
  //
  // Ko'rsatish/yashirish CSS orqali (`hidden lg:block`), JS bilan ekran
  // kengligini o'lchash orqali emas — shuning uchun oyna kengligi
  // o'zgarganda hech qachon bo'sh ekran qolmaydi.
  const [mobileScreen, setMobileScreen] = useState<ProfileTab | null>(null);
  const pathname = usePathname();

  // Mavzu — saytning MAVJUD tizimi (lib/store/theme-store.ts). Bu yerda
  // yangi mexanizm yaratilmadi: tanlov o'sha do'konga yoziladi, u esa
  // <html> dagi `dark` klassini va localStorage'ni o'zi boshqaradi.
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  // Mavzu localStorage'dan o'qiladi, ya'ni serverda va brauzerda
  // boshlang'ich qiymat farq qilishi mumkin. Belgi (✓) faqat brauzerda
  // chizilsa, React'ning "hydration mismatch" ogohlantirishi chiqmaydi.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  // "Accountdan chiqish" no longer logs out on the first click — it opens a
  // confirmation modal, and only the modal's own "Ha, chiqish" button
  // actually calls handleLogout. Shares the same body-scroll-lock hook every
  // other modal on the site uses, so background content stays frozen while
  // it's open exactly like the buy/review modals do.
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  useScrollLock(showLogoutConfirm);

  // Fields start read-only — the pencil icon next to "Shaxsiy ma'lumotlar"
  // is the only way in. Clicking it again while editing cancels: any
  // unsaved changes are discarded (reset back to the last-saved values) and
  // the fields lock again, rather than leaving a half-edited form behind.
  const [isEditing, setIsEditing] = useState(false);

  function handleLogout() {
    clearSession();
    router.push(`/${locale}`);
  }

  // Bo'limni ochish: desktopda o'ng ustundagi mazmun almashadi (avvalgidek),
  // telefonda esa qo'shimcha ravishda ichki ekran ochiladi.
  // Mavzu/til — faqat telefon ekranlari, shuning uchun ular `activeTab`ga
  // umuman tegmaydi (yuqoridagi izohga qarang).
  function openSection(tab: ProfileTab) {
    if (tab === 'orders' || tab === 'info') setActiveTab(tab);
    setMobileScreen(tab);
  }

  // Tilni almashtirish — saytning MAVJUD usuli bilan: manzildagi til
  // bo'lagi almashtiriladi (header'dagi LanguageMenu ham aynan shunday
  // qiladi), query parametrlari saqlanadi. Alohida til tizimi
  // yaratilmadi.
  function switchLocale(next: Locale) {
    if (next === locale) return;
    const segments = (pathname || `/${locale}`).split('/');
    segments[1] = next;
    const query = typeof window !== 'undefined' ? window.location.search : '';
    router.push((segments.join('/') || `/${next}`) + query);
  }

  const { data, loading: meLoading } = useQuery(GET_ME, { skip: !user });
  const [updateProfile, { loading }] = useMutation(UPDATE_PROFILE);

  // network-only + poll so a status/payment change the admin just made shows
  // up here without the buyer needing to manually reload — same behavior the
  // standalone /orders page already had.
  const { data: ordersData, loading: ordersLoading } = useQuery(GET_MY_ORDERS, {
    skip: !user || activeTab !== 'orders',
    fetchPolicy: 'network-only',
    pollInterval: 5000,
  });
  const allOrders = ordersData?.myOrders ?? [];
  const orders =
    orderFilter === 'unpaid'
      ? allOrders.filter((o: any) => o.paymentStatus !== 'PAID')
      : orderFilter === 'paid'
        ? allOrders.filter((o: any) => o.paymentStatus === 'PAID')
        : allOrders;

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors: profileErrors },
  } = useForm<ProfileForm>();

  useEffect(() => {
    if (data?.me) {
      reset({
        firstName: data.me.firstName,
        lastName: data.me.lastName ?? '',
        phone: data.me.phone ?? '',
        address: data.me.address ?? '',
      });
    }
  }, [data, reset]);

  function toggleEdit() {
    if (isEditing && data?.me) {
      // Cancel — throw away anything typed and go back to view mode.
      reset({
        firstName: data.me.firstName,
        lastName: data.me.lastName ?? '',
        phone: data.me.phone ?? '',
        address: data.me.address ?? '',
      });
    }
    setIsEditing((v) => !v);
  }

  async function handleSaveProfile(values: ProfileForm) {
    await updateProfile({ variables: { input: values } });
    setIsEditing(false);
  }

  if (!user) {
    return (
      <div className="container-app flex flex-col items-center py-32 text-center">
        <User2 size={40} className="text-ink-900/20" />
        <Link href={`/${locale}/login`} className="btn-primary mt-6">
          {dict.nav.login}
        </Link>
      </div>
    );
  }

  // First load only — without this the form fields briefly render empty
  // (default `useForm` state) until the `useEffect` below resets them once
  // `data.me` arrives.
  if (meLoading && !data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink-900/10 border-t-ink-950" />
      </div>
    );
  }

  // Nomlar o'zgarmadi — faqat chap paneldagi ro'yxat uchun ikonka
  // qo'shildi (rasmdagi ko'rinish shunday).
  const navItems: { key: ProfileTab; label: string; icon: typeof Package }[] = [
    { key: 'orders', label: dict.profile.ordersTab, icon: Package },
    { key: 'info', label: dict.profile.infoTab, icon: User2 },
  ];

  // Faqat telefonda ko'rinadigan bo'limlar (yuqoridagi izohga qarang).
  const mobileNavItems: { key: ProfileTab; label: string; icon: typeof Package }[] = [
    { key: 'language', label: dict.profile.languageTab, icon: Globe },
    { key: 'theme', label: dict.profile.themeTab, icon: Moon },
  ];

  // Ichki ekranning yuqorisidagi sarlavha — ro'yxatdagi nomning AYNAN
  // o'zi (yangi matn kiritilmagan).
  const sectionTitle =
    [...navItems, ...mobileNavItems].find((item) => item.key === mobileScreen)?.label ?? '';

  // Menyu qatorlari uchun yagona ko'rinish: chetdan chetga (kartochkaning
  // ichki chegarasigacha), chapda ikonka, o'rtada nom, o'ngda chevron.
  // Qatorlarning o'z burchagi/chegarasi yo'q — ular guruh kartochkasining
  // ichida ingichka chiziq bilan ajratiladi.
  const rowClass =
    'flex w-full items-center gap-3 px-4 py-3.5 text-left text-sm font-semibold transition-colors sm:px-5';
  const rowDivider = 'border-t border-ink-900/8 dark:border-cream/10';
  const rowIdle = 'text-ink-900/75 hover:bg-ink-900/5 dark:text-cream/75 dark:hover:bg-cream/5';
  const chevronClass = 'shrink-0 text-ink-900/25 dark:text-cream/25';

  return (
    <div className="container-app py-12">
      {/* Sahifa sarlavhasi — chapga tekislangan, ikkala ustundan yuqorida.
          Foydalanuvchi ismi va telefoni endi chap paneldagi kartochkada
          turadi (avval shu yerda, alohida kartochkada edi), admin havolasi
          esa chap paneldagi navigatsiyaga ko'chdi. Matnlar o'zgarmadi —
          mavjud lug'at kalitlari ishlatilgan. */}
      {/* Telefonda ichki ekran ochilganda sahifa sarlavhasi yashiriladi —
          u yerda ekranning o'z sarlavhasi (orqaga tugmasi bilan bitta
          qatorda) turadi. Desktopda doim ko'rinadi. */}
      <Reveal>
        <h1
          className={`font-display text-2xl font-semibold tracking-tight text-ink-950 sm:text-3xl dark:text-cream ${
            mobileScreen ? 'hidden lg:block' : ''
          }`}
        >
          {dict.profile.title}
        </h1>
      </Reveal>

      {/* Dashboard layout: sidebar nav on the left, active section's content
          on the right. On mobile the sidebar collapses into a horizontal
          scrollable tab row instead of a vertical list, so it stays usable
          without eating vertical space above the content. On desktop
          (lg:) it sticks under the fixed header while the right column
          scrolls normally with the page — see the plain (non-Reveal) div
          below for why. `lg:items-start` on this grid is required for the
          sticky child: without it, grid's default stretch would force the
          nav to match the right column's full height, leaving it nowhere
          to "stick" to since it would already span the whole row. */}
      <div className="mt-8 grid gap-6 lg:grid-cols-[250px_1fr] lg:items-start lg:gap-8">
        {/* Deliberately a plain <div>, not <Reveal> — Reveal is a
            framer-motion element that keeps an inline `transform` style
            even at rest (translateY(0)), and ANY transform on an ancestor
            creates a new containing block that breaks `position: sticky`
            on descendants in every browser. The fixed header floats at
            84px tall from the sm: breakpoint up (see [locale]/layout.tsx's
            `<main className="pt-[68px] sm:pt-[84px]">`); `lg:top-[100px]`
            adds a deliberate 16px breathing gap below that instead of
            sitting flush against it. */}
        {/* Telefonda: ichki ekran ochiq bo'lsa menyu UMUMAN ko'rinmaydi
            (akkordeon emas — ekran to'liq almashadi). Desktopda esa
            `lg:block` tufayli har doim o'z joyida qoladi. */}
        <div
          className={`min-w-0 lg:sticky lg:top-[100px] lg:self-start lg:block ${
            mobileScreen ? 'hidden' : ''
          }`}
        >
          {/* Chap panel: avatar → ism → telefon → navigatsiya → chiqish.
              Telefonda avatar/ism/telefon bitta qatorda yonma-yon turadi
              (vertikal joyni tejash uchun), lg: dan boshlab esa rasmdagi
              kabi ustma-ust. */}
          {/* Menyu uchta guruhga bo'lingan: 1) foydalanuvchi + asosiy
              bo'limlar, 2) til/mavzu (faqat telefon), 3) admin + chiqish.
              Har bir guruh — alohida kartochka, ichidagi qatorlar esa
              chetdan chetga va ingichka chiziq bilan ajratilgan.
              Nomlar, tartib va bosilganda bajariladigan amal
              o'zgarmadi. */}
          <div className="space-y-4">
            {/* ── 1-guruh ── */}
            <div className="card-surface overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-4 sm:px-5">
                {/* Avatar faqat desktopda — telefondagi ko'rinishda
                    ism va telefon raqamining o'zi turadi. */}
                <div className="hidden h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gold-500/10 text-gold-600 dark:text-gold-400 lg:flex">
                  {data?.me?.avatar ? (
                    <Image src={data.me.avatar} alt="" width={56} height={56} className="h-full w-full object-cover" unoptimized />
                  ) : (
                    <User2 size={26} />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-base font-bold text-ink-950 dark:text-cream">
                    {user.firstName} {user.lastName}
                  </p>
                  {data?.me?.phone ? (
                    <p className="mt-0.5 truncate text-xs text-ink-900/50 dark:text-cream/50">{data.me.phone}</p>
                  ) : null}
                </div>
              </div>

              <nav className="flex flex-col border-t border-ink-900/8 dark:border-cream/10">
                {navItems.map((item, index) => {
                  // Faol holat FAQAT desktopda ko'rsatiladi: telefonda faol
                  // bo'lim allaqachon ochilgan ichki ekranning o'zi.
                  const active = activeTab === item.key;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => openSection(item.key)}
                      className={`${rowClass} ${index > 0 ? rowDivider : ''} ${
                        active ? `${rowIdle} lg:bg-gold-500/10 lg:text-gold-600 lg:dark:text-gold-400` : rowIdle
                      }`}
                    >
                      <Icon size={18} className="shrink-0" />
                      <span className="flex-1 truncate">{item.label}</span>
                      <ChevronRight size={16} className={chevronClass} />
                    </button>
                  );
                })}

                <Link href={`/${locale}/wishlist`} className={`${rowClass} ${rowDivider} ${rowIdle}`}>
                  <Heart size={18} className="shrink-0" />
                  <span className="flex-1 truncate">{dict.nav.wishlist}</span>
                  <ChevronRight size={16} className={chevronClass} />
                </Link>
              </nav>
            </div>

            {/* ── 2-guruh: Til va Mavzu — faqat telefonda. Desktopda ular
                headerning yuqori qatorida turadi, takrorlanmaydi. ── */}
            <div className="card-surface overflow-hidden lg:hidden">
              <nav className="flex flex-col">
                {mobileNavItems.map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => openSection(item.key)}
                      className={`${rowClass} ${index > 0 ? rowDivider : ''} ${rowIdle}`}
                    >
                      <Icon size={18} className="shrink-0" />
                      <span className="flex-1 truncate">{item.label}</span>
                      <ChevronRight size={16} className={chevronClass} />
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* ── 3-guruh: admin havolasi va chiqish ── */}
            <div className="card-surface overflow-hidden">
              <nav className="flex flex-col">
                {user.role === 'ADMIN' && (
                  <Link href={`/${locale}/admin`} className={`${rowClass} ${rowIdle}`}>
                    <ShieldCheck size={18} className="shrink-0" />
                    <span className="flex-1 truncate">{dict.nav.admin}</span>
                    <ChevronRight size={16} className={chevronClass} />
                  </Link>
                )}

                {/* Chiqish — bosilganda avvalgidek tasdiqlash oynasi
                    ochiladi, darhol chiqarib yubormaydi. */}
                <button
                  type="button"
                  onClick={() => setShowLogoutConfirm(true)}
                  className={`${rowClass} ${user.role === 'ADMIN' ? rowDivider : ''} text-red-600 hover:bg-red-500/5 dark:text-red-400 dark:hover:bg-red-500/10`}
                >
                  <LogOut size={18} className="shrink-0" />
                  <span className="flex-1 truncate">{dict.profile.logoutAccount}</span>
                  <ChevronRight size={16} className="shrink-0 text-red-500/40" />
                </button>
              </nav>
            </div>
          </div>
        </div>

        {/* ── O'ng ustun / mobil ichki ekran ──────────────────────────
            Telefonda bu blok FAQAT bo'lim tanlanganda ko'rinadi va o'sha
            paytda menyu butunlay yashiringan bo'ladi — ya'ni ekran
            almashadi (akkordeon, dropdown, modal yoki bottom sheet
            EMAS). Desktopda esa avvalgidek doim ko'rinadi.

            `min-w-0` here is load-bearing, not decoration: this is a
            direct child of the CSS grid above, and grid items default to
            `min-width: auto` — which lets a descendant's un-wrapped text
            (long order numbers, addresses) force this whole column, and
            with it the page, wider than the viewport. */}
        <div className={`min-w-0 lg:block ${mobileScreen ? '' : 'hidden'}`}>
          {/* Ichki ekran sarlavhasi — faqat telefonda: chapda orqaga
              tugmasi, markazda bo'lim nomi. Orqaga bosilganda asosiy
              menyuga qaytadi (URL o'zgarmaydi). */}
          <div className="mb-5 flex items-center gap-3 lg:hidden">
            <button
              type="button"
              onClick={() => setMobileScreen(null)}
              aria-label={dict.profile.back}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border bg-[color:var(--surface-panel)] text-ink-950 transition-colors hover:bg-ink-900/5 dark:text-cream dark:hover:bg-cream/5"
              style={{ borderColor: 'var(--surface-border)' }}
            >
              <ArrowLeft size={20} />
            </button>
            <p className="min-w-0 flex-1 truncate text-center text-xl font-bold text-ink-950 dark:text-cream">
              {sectionTitle}
            </p>
            {/* Orqaga tugmasi bilan bir xil kenglikdagi bo'sh joy —
                sarlavha AYNAN markazda tursin. */}
            <span aria-hidden="true" className="h-12 w-12 shrink-0" />
          </div>

          {/* Mavzu — faqat telefon ekrani. */}
          {mobileScreen === 'theme' && (
            <div className="card-surface overflow-hidden lg:hidden">
              {(['light', 'dark'] as const).map((value, index) => {
                const selected = mounted && theme === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setTheme(value)}
                    className={`flex w-full items-center gap-3 px-4 py-4 text-left text-sm font-semibold transition-colors hover:bg-ink-900/5 dark:hover:bg-cream/5 ${
                      index > 0 ? 'border-t border-ink-900/8 dark:border-cream/10' : ''
                    } ${selected ? 'text-gold-600 dark:text-gold-400' : 'text-ink-900/80 dark:text-cream/80'}`}
                  >
                    {value === 'light' ? <Sun size={18} /> : <Moon size={18} />}
                    {/* Mavjud lug'at kalitlari — yangi matn kiritilmadi. */}
                    <span className="flex-1">
                      {value === 'light' ? dict.admin.themeToggleLight : dict.admin.themeToggleDark}
                    </span>
                    {selected && <Check size={16} className="shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}

          {/* Til — faqat telefon ekrani. */}
          {mobileScreen === 'language' && (
            <div className="card-surface overflow-hidden lg:hidden">
              {locales.map((value, index) => {
                const selected = value === locale;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => switchLocale(value)}
                    className={`flex w-full items-center gap-3 px-4 py-4 text-left text-sm font-semibold transition-colors hover:bg-ink-900/5 dark:hover:bg-cream/5 ${
                      index > 0 ? 'border-t border-ink-900/8 dark:border-cream/10' : ''
                    } ${selected ? 'text-gold-600 dark:text-gold-400' : 'text-ink-900/80 dark:text-cream/80'}`}
                  >
                    {/* Bayroqlar — mavjud inline SVG komponenti (emoji
                        bayroqlar Windows'da chizilmaydi). */}
                    <FlagIcon locale={value} />
                    <span className="flex-1">{localeNames[value]}</span>
                    {selected && <Check size={16} className="shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}

          {/* Buyurtmalar / Ma'lumotlarim. Telefonda mavzu yoki til ekrani
              ochiq bo'lsa yashiriladi; desktopda esa har doim shu blok
              ko'rinadi (mavzu/til desktop ustuniga umuman ta'sir
              qilmaydi — ular headerda). */}
          <div
            className={
              mobileScreen === 'theme' || mobileScreen === 'language' ? 'hidden lg:block' : ''
            }
          >
        {activeTab === 'orders' ? (
          <Reveal delay={0.05} className="min-w-0">
            <div className="space-y-5">
              {/* Filtrlar: telefonda — ostidan chiziq tortilgan
                  yozuvlar (faol bo'lgani ko'k chiziq bilan belgilanadi),
                  desktopda esa avvalgidek dumaloq tugmachalar.
                  `lg:!border-b` — desktopda pastki chiziq qalinligi
                  1px ga qaytariladi (telefondagi 2px o'rniga). */}
              <div className="flex gap-6 overflow-x-auto border-b border-ink-900/10 dark:border-cream/10 lg:gap-2 lg:border-b-0">
                {(['all', 'paid', 'unpaid'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setOrderFilter(f)}
                    className={`shrink-0 border-b-2 pb-2.5 text-[13px] font-semibold transition-colors lg:!border-b lg:rounded-full lg:border lg:px-4 lg:py-2 lg:text-xs ${
                      orderFilter === f
                        ? 'border-gold-500 text-gold-600 dark:text-gold-400 lg:bg-gold-500/10'
                        : 'border-transparent text-ink-900/50 hover:text-ink-950 dark:text-cream/50 dark:hover:text-cream lg:border-ink-900/15 lg:dark:border-cream/15'
                    }`}
                  >
                    {f === 'all' ? dict.profile.allOrders : f === 'paid' ? dict.profile.paidOrders : dict.profile.unpaidOrders}
                  </button>
                ))}
              </div>

              {ordersLoading && !ordersData ? (
                <div className="flex h-48 items-center justify-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink-900/10 border-t-ink-950" />
                </div>
              ) : orders.length === 0 ? (
                <div className="card-surface flex flex-col items-center px-6 py-16 text-center">
                  <Package size={36} className="text-ink-900/20" />
                  <p className="mt-4 text-sm text-ink-900/50">{dict.orders.empty}</p>
                  <Link href={`/${locale}/shop`} className="btn-primary mt-6">
                    {dict.cart.continueShopping}
                  </Link>
                </div>
              ) : (
                // RO'YXATNING O'Z SCROLL'I YO'Q. Avval telefonda bu blok
                // `max-h-[60vh]` + `overflow-y-auto` edi: buyurtmalar
                // o'z oynachasi ichida aylanardi va sahifaning umumiy
                // scroll'i bilan chalkashardi (barmoq goh ro'yxatni, goh
                // sahifani surardi). Endi ro'yxat butun bo'yiga
                // cho'ziladi — buyurtmalar tugagach sahifa oddiy tarzda
                // davom etadi.
                <div className="min-w-0 max-w-full space-y-3">
                  {orders.map((order: any, i: number) => {
                    // To'lanmagan (yoki rad etilgan) buyurtma kartochkasi
                    // bosilsa, aynan shu buyurtmaning to'lov sahifasiga
                    // o'tadi — to'langan buyurtma uchun avvalgidek hech
                    // qanday navigatsiya yo'q.
                    const payable = order.paymentStatus !== 'PAID';
                    return (
                      <Reveal key={order.id} delay={i * 0.04} className="min-w-0 max-w-full">
                        {/* Kartochka tuzilishi: yuqorida buyurtma raqami va
                            to'lov holati, ostida sana, keyin mahsulot
                            qatorlari (yirik rasm + nomi × soni + o'lcham ·
                            narx), eng pastda umumiy summa.
                            "Topshirish punkti" va "Qabul qiluvchi"
                            qatorlari olib tashlandi — ular buyurtmaning
                            o'z sahifasida qolgan. */}
                        <div
                          onClick={payable ? () => router.push(`/${locale}/orders/${order.id}`) : undefined}
                          className={`card-surface w-full min-w-0 max-w-full space-y-3 p-4 lg:p-5 ${
                            payable ? 'cursor-pointer transition-colors hover:border-gold-500/30' : ''
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <p className="min-w-0 [overflow-wrap:anywhere] text-base font-bold text-ink-950 dark:text-cream lg:text-lg">
                              № {order.orderNumber}
                            </p>
                            <span
                              className={`shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-bold ${
                                order.paymentStatus === 'PAID'
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                                  : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                              }`}
                            >
                              {order.paymentStatus === 'PAID' ? dict.admin.paid : dict.admin.unpaid}
                            </span>
                          </div>

                          <p className="text-xs text-ink-900/45 dark:text-cream/45 lg:text-sm">
                            {formatDate(order.createdAt, locale)}
                          </p>

                          {/* Har bir mahsulot alohida qator — avval faqat
                              birinchisining kichik rasmi ko'rinardi. */}
                          <div className="space-y-3">
                            {order.items.map((item: any) => {
                              // Xaridor tanlagan RANGGA mos rasm.
                              const cover = resolveProductCoverImage(item.product, item.color);
                              return (
                                <div key={item.id} className="flex items-center gap-3">
                                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-ink-900/5 dark:bg-cream/5">
                                    <Image src={cover} alt={item.title ?? ''} fill className="object-cover" unoptimized />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-semibold text-ink-950 dark:text-cream">
                                      {item.title} × {item.quantity}
                                    </p>
                                    <p className="mt-1 truncate text-xs text-ink-900/45 dark:text-cream/45 lg:text-sm">
                                      {[item.size, formatPrice(item.price, locale)].filter(Boolean).join(' · ')}
                                    </p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-base font-bold text-ink-950 dark:text-cream lg:text-lg">
                              {formatPrice(order.totalAmount, locale)}
                            </p>
                            {payable && (
                              <span className="flex items-center gap-1 text-xs font-semibold text-gold-600 dark:text-gold-400">
                                {dict.orders.payNow}
                                <ArrowRight size={13} />
                              </span>
                            )}
                          </div>
                        </div>
                      </Reveal>
                    );
                  })}
                </div>
              )}
            </div>
          </Reveal>
        ) : (
          // Same `min-w-0` reasoning as the orders tab's Reveal above —
          // this is the grid's other possible second child, so it needs
          // the same override to not be a blowout risk itself.
          <Reveal delay={0.05} className="min-w-0">
            <form onSubmit={handleSubmit(handleSaveProfile)} className="card-surface space-y-5 p-6">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-bold uppercase tracking-wider">{dict.profile.personalInfo}</h2>
                {/* Pencil = enter edit mode; while editing it swaps to an X
                    (cancel — discards unsaved changes, see toggleEdit). This
                    is now the only way to unlock the fields below; the old
                    always-editable form + separate green submit button was
                    replaced by this explicit view/edit toggle. */}
                <button
                  type="button"
                  onClick={toggleEdit}
                  aria-label={dict.profile.editInfo}
                  title={dict.profile.editInfo}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gold-500/40 bg-gold-500/5 text-gold-600 transition-colors hover:bg-gold-500/10 dark:border-gold-500/30 dark:text-gold-400"
                >
                  {isEditing ? <X size={16} /> : <Pencil size={15} />}
                </button>
              </div>

              {/* Maydonlar ustma-ust (vertikal), har bir label o'z
                  inputining tepasida, orasi ~20px — avval ism va familiya
                  ikki ustunga bo'lingan edi. Maydonlarning o'zi, tartibi,
                  validatsiyasi va saqlash mantig'i o'zgarmadi. */}
              <div className="space-y-5">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-ink-900/60">{dict.auth.firstName}</label>
                  <input
                    disabled={!isEditing}
                    {...register('firstName', { pattern: /^[^0-9]+$/ })}
                    className={`w-full rounded-xl border px-4 py-3 text-sm outline-none transition-colors ${
                      isEditing
                        ? 'border-ink-900/15 focus:border-ink-950'
                        : 'border-ink-900/10 bg-ink-900/5 text-ink-900/50'
                    }`}
                  />
                  {isEditing && profileErrors.firstName && (
                    <p className="mt-1 text-xs text-red-500">{dict.auth.nameNoDigits}</p>
                  )}
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-ink-900/60">{dict.auth.lastName}</label>
                  <input
                    disabled={!isEditing}
                    {...register('lastName', { pattern: /^[^0-9]*$/ })}
                    className={`w-full rounded-xl border px-4 py-3 text-sm outline-none transition-colors ${
                      isEditing
                        ? 'border-ink-900/15 focus:border-ink-950'
                        : 'border-ink-900/10 bg-ink-900/5 text-ink-900/50'
                    }`}
                  />
                  {isEditing && profileErrors.lastName && (
                    <p className="mt-1 text-xs text-red-500">{dict.auth.nameNoDigits}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-ink-900/60">{dict.auth.phone}</label>
                {/* Same PhoneInput used on the register wizard's phone step:
                    the "+998 " prefix is permanently fixed (can't be
                    deleted/selected-over/pasted-over) and only the 9 digits
                    after it are editable, digit-only, capped at 9 — the
                    exact way an earlier account's phone got corrupted to
                    "+998 99b 213 28 01" in the database is no longer
                    possible here. Wired through Controller (rather than
                    plain register()) since PhoneInput is a controlled
                    value/onChange component, not a native <input>. */}
                <Controller
                  name="phone"
                  control={control}
                  render={({ field }) => (
                    <PhoneInput
                      value={toPhoneDigits(field.value ?? '')}
                      onChange={(digits) => field.onChange(`+998${digits}`)}
                      disabled={!isEditing}
                      className={`w-full rounded-xl border px-4 py-3 text-sm outline-none transition-colors ${
                        isEditing
                          ? 'border-ink-900/15 focus:border-ink-950'
                          : 'border-ink-900/10 bg-ink-900/5 text-ink-900/50'
                      }`}
                    />
                  )}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-ink-900/60">{dict.checkout.address}</label>
                <input
                  disabled={!isEditing}
                  {...register('address')}
                  className={`w-full rounded-xl border px-4 py-3 text-sm outline-none transition-colors ${
                    isEditing
                      ? 'border-ink-900/15 focus:border-ink-950'
                      : 'border-ink-900/10 bg-ink-900/5 text-ink-900/50'
                  }`}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-ink-900/60">{dict.auth.email}</label>
                <input
                  disabled
                  value={data?.me?.email ?? user.email}
                  className="w-full rounded-xl border border-ink-900/10 bg-ink-900/5 px-4 py-3 text-sm text-ink-900/50 outline-none"
                />
              </div>

              {/* "Saqlash" only appears once the pencil icon has unlocked the
                  fields — the old always-visible green submit button is
                  gone. "Accountdan chiqish" endi shu yerda emas, chap
                  paneldagi ro'yxatning oxirida turadi (tasdiqlash oynasi
                  bilan birga, o'zgarishsiz). */}
              {isEditing && (
                <div className="pt-1">
                  <button type="submit" disabled={loading} className="btn-primary disabled:opacity-50">
                    {loading ? '…' : dict.profile.save}
                  </button>
                </div>
              )}
            </form>
          </Reveal>
        )}
          </div>
        </div>
      </div>

      {/* Rendered through a portal straight into <body>, same reasoning as
          every other overlay in the app: a `fixed inset-0` backdrop nested
          inside a transformed ancestor (Reveal's motion wrapper) would get
          clipped/mispositioned instead of covering the full viewport. */}
      {showLogoutConfirm &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
            onClick={() => setShowLogoutConfirm(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-ink-900"
            >
              <h3 className="text-base font-bold text-ink-950 dark:text-cream">{dict.profile.logoutConfirmTitle}</h3>
              <p className="mt-2 text-sm text-ink-900/60 dark:text-cream/60">{dict.profile.logoutConfirmBody}</p>
              <div className="mt-6 flex gap-3">
                <button type="button" onClick={() => setShowLogoutConfirm(false)} className="btn-outline flex-1 !px-4">
                  {dict.profile.cancel}
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex-1 rounded-full bg-red-500 px-4 py-3 text-sm font-semibold text-white transition-all duration-200 hover:bg-red-600 active:scale-95"
                >
                  {dict.profile.confirmLogout}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
