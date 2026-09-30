'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery } from '@apollo/client';
import { Check, Pencil } from 'lucide-react';
import { GET_MY_CART, GET_ME } from '@/lib/graphql/queries';
import { CHECK_PROMO_CODE, CREATE_ORDER, UPDATE_PROFILE } from '@/lib/graphql/mutations';
import { useAuthStore } from '@/lib/store/auth-store';
import { formatPrice } from '@/lib/utils/format';
import { UZBEKISTAN_REGIONS, districtsOf } from '@/lib/data/uzbekistan-regions';
import { resolveUnitPrice } from '@/lib/utils/variantPrice';
import { translateColorName } from '@/lib/utils/colorNames';
import { Reveal } from '@/components/ui/Reveal';
import { OrderPaymentPanel } from '@/components/checkout/OrderPaymentPanel';
import type { Locale } from '@/i18n/config';
import uzDict from '@/i18n/dictionaries/uz.json';
import ruDict from '@/i18n/dictionaries/ru.json';

interface CheckoutForm {
  // Aniq manzil — ko'cha, uy, xonadon, mo'ljal (qo'lda yoziladi).
  deliveryAddress: string;
  // Viloyat va tuman/shahar ro'yxatdan tanlanadi. Buyurtmaga esa ikkalasi
  // birlashtirilib, avvalgi `deliveryCity` maydoniga yoziladi ("Jizzax
  // viloyati, Sharof Rashidov") — shuning uchun backendda, admin panelda
  // va eski buyurtmalarda hech narsa o'zgarmaydi.
  region: string;
  district: string;
  deliveryCity: string;
  phone: string;
  note: string;
}

// `placedOrder` below is plain component state, so it's normally lost the
// moment this component remounts — e.g. a locale switch, or (very commonly
// on mobile) the browser discarding this background tab while the buyer is
// away in the Telegram app and reloading it when they come back. Mirroring
// it here lets a fresh mount restore the payment-confirmation screen instead
// of silently dropping the buyer back onto a blank checkout form.
const PLACED_ORDER_STORAGE_KEY = 'checkout:lastPlacedOrder';
// Written by QuickBuyModal.tsx / ProductActions.tsx right before they
// navigate here with `?buyNow=1` — carries exactly the product/size/color/
// quantity the buyer picked, so this page can order that directly via
// CreateOrderInput's buyNowProductId (see order.service.ts) instead of
// routing through the cart. Bypassing the cart entirely (rather than
// addToCart-then-?items=<row>) is deliberate: CartService.add() increments
// an EXISTING matching cart row instead of creating a second one, so a
// "buy now" of 1 unit used to silently become "3" whenever 2 of that exact
// same size/color were already sitting in the cart for later.
const BUY_NOW_ITEM_STORAGE_KEY = 'checkout:buyNowItem';

// Viloyat + tuman => bitta matn ("Jizzax viloyati, Sharof Rashidov").
// Buyurtmada avvalgidek bitta `deliveryCity` maydoni saqlanadi, shuning
// uchun backend, admin panel va eski buyurtmalarga umuman tegilmadi.
function cityOf(values: { region?: string; district?: string; deliveryCity?: string }) {
  const parts = [values.region, values.district].filter(Boolean);
  // Ro'yxatdan tanlanmagan (masalan eski saqlangan qiymat) holat uchun
  // zaxira — avvalgi erkin matn.
  return parts.length ? parts.join(', ') : (values.deliveryCity ?? '');
}
// Faqat "Shahar" (deliveryCity) uchun eslatma sifatida ishlatiladi —
// muvaffaqiyatli buyurtmadan keyin shu kalit bilan saqlanadi (pastdagi
// onSubmit'ga qarang). Manzil va telefon ENDI bu yerdan o'qilmaydi — ular
// har doim xaridorning "Shaxsiy ma'lumotlar" profilidan (GET_ME so'rovi
// orqali) olinadi, shunda profilda telefon/manzil yangilansa, keyingi
// xariddan boshlab aynan o'sha yangi qiymat ishlatiladi. Avval bu yerda
// eski buyurtmadan qolgan manzil/telefon ustunlik qilar edi — bu esa
// profilni to'g'irlagandan keyin ham checkout'da ESKI raqamni
// ko'rsatishga olib kelgan xato edi.
const SAVED_DELIVERY_INFO_KEY = 'checkout:savedDeliveryInfo';

// useSearchParams() opts the calling component out of static prerendering
// unless it's wrapped in <Suspense> — without this wrapper `next build`
// fails with "useSearchParams() should be wrapped in a suspense boundary"
// (same fix already applied to the verify-email page for the same reason).
export default function CheckoutPage({ params }: { params: { locale: Locale } }) {
  return (
    <Suspense fallback={null}>
      <CheckoutPageInner params={params} />
    </Suspense>
  );
}

function CheckoutPageInner({ params }: { params: { locale: Locale } }) {
  const { locale } = params;
  const dict = locale === 'ru' ? ruDict : uzDict;
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  // zustand's persist middleware reads localStorage asynchronously — right
  // after a fresh mount `user` is still `null` for one tick even when a
  // valid session exists. Gating the login-redirect effect on this (instead
  // of just `!user`) stops a still-logged-in buyer from being bounced to
  // /login the instant this page remounts.
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // To'liq buyurtma ma'lumoti (mahsulot, narx, holat) endi bu yerda emas,
  // OrderPaymentPanel ichida GET_ORDER orqali o'qiladi — shu komponent faqat
  // buyurtma ID'sini va (remount'dan keyin tiklash uchun) "bu buy-now
  // orqalimi" belgisini eslab qolishi kifoya.
  const [placedOrder, setPlacedOrder] = useState<{ id: string; buyNow?: boolean } | null>(null);

  // ?items=id1,id2 — set by the cart page when the buyer checked out only
  // some of their cart, not the whole thing (its checkbox selection). Absent
  // entirely (checkout reached with nothing selected) means "the whole
  // cart", exactly like before this existed.
  const searchParams = useSearchParams();
  const itemsParam = searchParams.get('items');
  const selectedItemIds = useMemo(
    () => (itemsParam ? itemsParam.split(',').filter(Boolean) : null),
    [itemsParam],
  );

  // ?buyNow=1 — set by QuickBuyModal.tsx / ProductActions.tsx. Synchronous
  // from the URL (unlike buyNowItem below, which needs an effect to reach
  // sessionStorage), so it's safe to use immediately for gating the cart
  // query/loading state without a one-frame flicker.
  const buyNowRequested = searchParams.get('buyNow') === '1';
  const [buyNowItem, setBuyNowItem] = useState<{
    productId: string;
    title: string;
    price: number;
    size?: string;
    color?: string;
    quantity: number;
  } | null>(null);

  // Populates buyNowItem from sessionStorage once, on mount — see
  // BUY_NOW_ITEM_STORAGE_KEY above for why this bypasses the cart entirely.
  useEffect(() => {
    if (!buyNowRequested) return;
    try {
      const raw = sessionStorage.getItem(BUY_NOW_ITEM_STORAGE_KEY);
      if (raw) setBuyNowItem(JSON.parse(raw));
    } catch {
      // sessionStorage can throw in some privacy modes — the buyer just
      // won't see their buy-now item here and can go back and retry.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Skips the cart fetch entirely during a buy-now checkout — this page
  // never needs the buyer's actual cart contents in that mode.
  const { data, loading: cartLoading } = useQuery(GET_MY_CART, { skip: !user || buyNowRequested });

  // Ro'yxatdan o'tishda kiritilgan manzil/telefonni olish uchun — pastdagi
  // effekt buyerning birinchi buyurtmasida (hali SAVED_DELIVERY_INFO_KEY
  // bo'sh bo'lganda) shulardan foydalanadi, forma bo'sh boshlanmasin deb.
  const { data: meData, loading: meLoading } = useQuery(GET_ME, { skip: !user });

  // Buyurtma joylashtirilgandan keyingi holat (to'langan/rad etilgan/hali
  // kutilmoqda), mahsulot ma'lumoti va "Bizning karta" ekrani endi
  // OrderPaymentPanel'ning o'zi ichida GET_ORDER orqali kuzatiladi — bu yerda
  // alohida so'rov yuritishning hojati yo'q.
  const allCartItems = data?.myCart ?? [];
  // Synthesizes the same `{ id, quantity, size, color, product: { title,
  // price } }` shape the summary/subtotal code below already expects from
  // real cart rows, so neither has to branch on buy-now vs. cart mode.
  const items = buyNowRequested
    ? buyNowItem
      ? [
          {
            id: 'buy-now-item',
            quantity: buyNowItem.quantity,
            size: buyNowItem.size,
            color: buyNowItem.color,
            product: { title: buyNowItem.title, price: buyNowItem.price },
          },
        ]
      : []
    : selectedItemIds
      ? allCartItems.filter((i: any) => selectedItemIds.includes(i.id))
      : allCartItems;
  // Har bir qator tanlangan variant narxidan (duxi hajmlari uchun).
  // Bu faqat ko'rsatish uchun — yakuniy summa serverda hisoblanadi.
  const subtotal = items.reduce(
    (sum: number, i: any) => sum + resolveUnitPrice(i.product, i.size, i.color) * i.quantity,
    0,
  );

  // createOrder deletes the user's cart items server-side, but that doesn't
  // touch Apollo's client cache — without this, the cart page/badge kept
  // showing the just-purchased items as if checkout had done nothing.
  const [createOrder] = useMutation(CREATE_ORDER, {
    refetchQueries: [{ query: GET_MY_CART }],
    awaitRefetchQueries: true,
  });

  // ── PROMOKOD ──────────────────────────────────────────────────────
  // Kod SERVERDA tekshiriladi va chegirma ham SERVERDA hisoblanadi —
  // bu yerdagi qiymatlar faqat KO'RSATISH uchun. Buyurtma yaratilganda
  // server kodni qaytadan tekshiradi, ya'ni brauzerda ko'rsatilgan
  // chegirmani "tahrirlab" yuborishning foydasi yo'q.
  const [promoInput, setPromoInput] = useState('');
  const [promoChecking, setPromoChecking] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; discount: number } | null>(null);
  const [checkPromoCode] = useMutation(CHECK_PROMO_CODE);
  // Buyurtmadan keyin manzil/telefonni PROFILGA saqlab qo'yish uchun.
  // GET_ME qayta so'raladi, shunda keyingi safar checkout ochilganda
  // (va profil sahifasida) yangi qiymat darhol ko'rinadi.
  const [updateProfile] = useMutation(UPDATE_PROFILE, {
    refetchQueries: [{ query: GET_ME }],
  });
  const {
    register,
    handleSubmit,
    reset,
    watch,
    // Viloyat almashtirilganda tumanni tozalash uchun.
    setValue,
    formState: { errors },
  } = useForm<CheckoutForm>({ defaultValues: { phone: '+998 ', region: '', district: '' } });

  // Yetkazib berish ma'lumotlari topilgach forma "ko'rish" (read-only
  // xulosa + qalam tugmasi) rejimida ochiladi — xaridor har safar bo'sh
  // formani qayta to'ldirmasin deb. Hali hech qanday manzil topilmagan
  // holatda (masalan GET_ME hali javob bermagan, yoki chindan ham bo'sh)
  // to'g'ridan-to'g'ri tahrirlash formasi ko'rsatiladi.
  const [editingDelivery, setEditingDelivery] = useState(false);
  const [deliveryPrefillReady, setDeliveryPrefillReady] = useState(false);

  // Manzil/telefonni formaga qaytarib to'ldirish — manba HAR DOIM
  // xaridorning "Shaxsiy ma'lumotlar" profili (GET_ME): u yerda telefon
  // yoki manzilni yangilasa, keyingi xariddan boshlab aynan o'sha yangi
  // qiymat ishlatiladi. Faqat "Shahar" (deliveryCity) — profilda bunday
  // maydon yo'qligi uchun — oldingi buyurtmada saqlangan qiymatdan
  // (SAVED_DELIVERY_INFO_KEY) to'ldiriladi. useEffect ichida — localStorage
  // faqat brauzerda mavjud, server-side render paytida bu componentning
  // o'zi ham bir marta serverda ishlaydi (bu "use client" bo'lsa ham), shu
  // sababli localStorage'ga to'g'ridan-to'g'ri render vaqtida emas, faqat
  // mount bo'lgandan keyin murojaat qilinadi. Faqat bir marta ishlaydi
  // (GET_ME javob bergach) — xaridor formani qo'lda o'zgartirsa, bu effekt
  // qayta ishga tushib uni bosib ketmaydi.
  useEffect(() => {
    if (deliveryPrefillReady) return;
    // GET_ME hali yuklanayotgan bo'lsa kutamiz — aks holda profil
    // ma'lumoti kelishidan oldin bo'sh forma "tayyor" deb belgilanib
    // qolardi.
    if (!user || meLoading) return;
    const profile = meData?.me;

    let cachedCity: string | undefined;
    let cachedRegion: string | undefined;
    let cachedDistrict: string | undefined;
    try {
      const raw = localStorage.getItem(SAVED_DELIVERY_INFO_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<CheckoutForm>;
        cachedCity = saved.deliveryCity || undefined;
        cachedRegion = saved.region || undefined;
        cachedDistrict = saved.district || undefined;
        // Eski (viloyat/tuman ajratilmagan) yozuvlar uchun: saqlangan
        // matn "Viloyat, Tuman" ko'rinishida bo'lsa qaytadan bo'lib
        // olamiz, shunda ro'yxatlar to'ldirilgan holda ochiladi.
        if (!cachedRegion && cachedCity?.includes(',')) {
          const [maybeRegion, ...rest] = cachedCity.split(',').map((p) => p.trim());
          if (UZBEKISTAN_REGIONS.some((r) => r.name === maybeRegion)) {
            cachedRegion = maybeRegion;
            cachedDistrict = rest.join(', ') || undefined;
          }
        }
      }
    } catch {
      // localStorage o'qishda xato bo'lsa (masalan maxfiy rejim) — shahar
      // maydoni shunchaki bo'sh qoladi, manzil/telefonga ta'sir qilmaydi.
    }

    reset((current) => ({
      ...current,
      ...(profile?.address ? { deliveryAddress: profile.address } : {}),
      ...(profile?.phone ? { phone: profile.phone } : {}),
      ...(cachedCity ? { deliveryCity: cachedCity } : {}),
      ...(cachedRegion ? { region: cachedRegion } : {}),
      ...(cachedDistrict ? { district: cachedDistrict } : {}),
    }));
    setDeliveryPrefillReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deliveryPrefillReady, meLoading, meData, user]);

  // Forma tayyor bo'lgach: agar manzil topilgan bo'lsa "ko'rish" rejimida
  // boshlanadi (qalam bosilsa tahrirlashga o'tadi); hech narsa topilmasa
  // (yangi profil, GET_ME bo'sh qaytdi) to'g'ridan-to'g'ri tahrirlash
  // formasi ochiladi — bo'sh xulosa ko'rsatishning ma'nosi yo'q.
  useEffect(() => {
    if (!deliveryPrefillReady) return;
    if (!watch('deliveryAddress')) setEditingDelivery(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deliveryPrefillReady]);

  // Real Click/Payme merchant credentials aren't set up yet, so online
  // payment selection is hidden — every order goes through as "to be
  // arranged", and payment itself is coordinated manually via Telegram
  // (see the contact note rendered below).
  async function applyPromo() {
    const code = promoInput.trim();
    if (!code) return;
    const phone = watch('phone');
    if (!phone || phone.replace(/\D/g, '').length < 9) {
      setPromoError(dict.checkout.promoNeedPhone);
      return;
    }
    setPromoChecking(true);
    setPromoError(null);
    try {
      const { data } = await checkPromoCode({
        variables: {
          input: {
            code,
            phone,
            // Buyurtma yaratishda nima yuborilsa — tekshiruvda ham
            // AYNAN o'sha, shuning uchun ko'rsatilgan chegirma bilan
            // yoziladigani farq qilmaydi.
            ...(buyNowRequested && buyNowItem
              ? {
                  buyNowProductId: buyNowItem.productId,
                  buyNowSize: buyNowItem.size,
                  buyNowColor: buyNowItem.color,
                  buyNowQuantity: buyNowItem.quantity,
                }
              : { itemIds: selectedItemIds ?? undefined }),
          },
        },
      });
      const result = data?.checkPromoCode;
      if (result?.valid) {
        setAppliedPromo({ code: result.code, discount: result.discount });
        setPromoError(null);
      } else {
        setAppliedPromo(null);
        setPromoError(result?.message ?? dict.checkout.promoInvalid);
      }
    } catch {
      setAppliedPromo(null);
      setPromoError(dict.checkout.promoInvalid);
    } finally {
      setPromoChecking(false);
    }
  }

  async function onSubmit(values: CheckoutForm) {
    if (buyNowRequested && !buyNowItem) {
      // Sessionstorage read failed or was cleared (private-browsing mode,
      // or the buyer opened this URL fresh without going through the
      // buy-now buttons) — nothing to actually order. The submit button is
      // already disabled in this state (items.length === 0), but this
      // guards onSubmit directly too.
      setError(dict.checkout.buyNowMissing);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const { data: orderData } = await createOrder({
        variables: {
          input: buyNowRequested
            ? {
                deliveryAddress: values.deliveryAddress,
                // Viloyat + tuman bitta matnga birlashtiriladi — backend
                // va admin panel uchun bu avvalgi "shahar" maydonining
                // o'zi.
                deliveryCity: cityOf(values),
                phone: values.phone,
                note: values.note,
                paymentMethod: 'CASH',
                promoCode: appliedPromo?.code,
                buyNowProductId: buyNowItem!.productId,
                buyNowSize: buyNowItem!.size,
                buyNowColor: buyNowItem!.color,
                buyNowQuantity: buyNowItem!.quantity,
              }
            : {
                deliveryAddress: values.deliveryAddress,
                deliveryCity: cityOf(values),
                phone: values.phone,
                note: values.note,
                paymentMethod: 'CASH',
                promoCode: appliedPromo?.code,
                // undefined (not []) when nothing was pre-selected, so the
                // backend's own "omitted = whole cart" fallback applies.
                itemIds: selectedItemIds ?? undefined,
              },
        },
      });

      // Stay on this page and show the payment card + Telegram instructions
      // instead of redirecting straight to /orders — the buyer needs those
      // details to actually send the payment. OrderPaymentPanel re-fetches
      // everything else about this order itself, so only the id needs to be
      // kept here.
      const order = {
        id: orderData?.createOrder?.id ?? '',
        buyNow: buyNowRequested,
      };
      setPlacedOrder(order);
      try {
        sessionStorage.setItem(PLACED_ORDER_STORAGE_KEY, JSON.stringify(order));
        if (buyNowRequested) sessionStorage.removeItem(BUY_NOW_ITEM_STORAGE_KEY);
      } catch {
        // sessionStorage can throw in some privacy modes — safe to ignore.
      }
      // Keyingi safar checkout'ga qaytganda "Shahar" maydonini avtomatik
      // to'ldirish uchun — yuqoridagi useEffect shundan faqat shu maydonni
      // o'qiydi. Manzil/telefon ATAYLAB bu yerga yozilmaydi — ular har doim
      // profildan (GET_ME) olinadi, shu bilan checkout hech qachon profilda
      // allaqachon to'g'irlangan raqamdan farqli ESKI qiymatni saqlab
      // qolmaydi.
      // MA'LUMOTNI SAQLASH — bu ilgari qilinmagan edi va aynan shu sababli
      // xaridor har safar manzil/telefonni qaytadan yozishga majbur
      // bo'lardi: checkout ularni PROFILDAN (GET_ME) o'qiydi, lekin hech
      // kim u yerga yozmasdi. Endi birinchi buyurtmada kiritilgan manzil
      // va raqam profilga yoziladi, keyingi buyurtmada esa tayyor holda,
      // qalam (tahrirlash) tugmasi bilan ko'rsatiladi.
      //
      // Xatolik bo'lsa (masalan raqam formati serverga yoqmasa) —
      // ataylab jim o'tiladi: buyurtmaning o'zi allaqachon muvaffaqiyatli
      // joylashtirilgan, uni xato xabari bilan buzish noto'g'ri bo'lardi.
      try {
        const profile = meData?.me;
        const patch: Record<string, string> = {};
        const nextAddress = values.deliveryAddress?.trim();
        const nextPhone = values.phone?.trim();
        if (nextAddress && nextAddress !== profile?.address) patch.address = nextAddress;
        if (nextPhone && nextPhone !== profile?.phone) patch.phone = nextPhone;
        if (Object.keys(patch).length > 0) {
          await updateProfile({ variables: { input: patch } });
        }
      } catch {
        // jim o'tiladi — yuqoridagi izohga qarang
      }

      try {
        localStorage.setItem(
          SAVED_DELIVERY_INFO_KEY,
          JSON.stringify({
            deliveryCity: cityOf(values),
            region: values.region,
            district: values.district,
          }),
        );
      } catch {
        // localStorage yozishda xato bo'lsa (masalan maxfiy rejim) —
        // buyurtmaning o'zi baribir muvaffaqiyatli joylashtirilgan, shuning
        // uchun bu yerda xato ko'rsatilmaydi, faqat eslab qolish ishlamaydi.
      }
    } catch (e: any) {
      setError(e.message ?? 'Xatolik yuz berdi');
    } finally {
      setSubmitting(false);
    }
  }

  // Restore the payment-confirmation screen after a remount (see the
  // `PLACED_ORDER_STORAGE_KEY` note above). Only restores while the cart is
  // confirmed empty — that's the state right after a real order was placed.
  // If the buyer has since added new items (a genuinely new checkout), the
  // cart won't be empty, so we drop the stale entry and show the form
  // instead of re-showing a finished order's payment details.
  useEffect(() => {
    if (placedOrder) return;
    try {
      const raw = sessionStorage.getItem(PLACED_ORDER_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      // A buy-now order never touched the cart, so there's no "cart is
      // empty" signal to gate on the way the cart-checkout branch below
      // does. ROOT-CAUSE FIX: this used to restore `parsed` unconditionally
      // whenever it was a buy-now order, with no check for whether a BRAND
      // NEW buy-now attempt was already queued — so clicking "Sotib olish"
      // on a *different* product (writing a fresh BUY_NOW_ITEM_STORAGE_KEY
      // and remounting this page with ?buyNow=1) would immediately jump
      // straight to the previous, still-unpaid order's Payment Page instead
      // of showing the new product. BUY_NOW_ITEM_STORAGE_KEY is only ever
      // present here when a buy-now item hasn't been submitted yet (it's
      // cleared the instant createOrder succeeds — see onSubmit above), so
      // its presence is exactly the signal that this is a fresh checkout
      // attempt, not a reload of an already-placed order's payment screen.
      let hasPendingBuyNowItem = false;
      try {
        hasPendingBuyNowItem = !!sessionStorage.getItem(BUY_NOW_ITEM_STORAGE_KEY);
      } catch {
        // sessionStorage can throw in some privacy modes — treat as "no
        // pending item" so the old entry can still be restored below.
      }
      if (parsed.buyNow) {
        if (hasPendingBuyNowItem) {
          sessionStorage.removeItem(PLACED_ORDER_STORAGE_KEY);
          return;
        }
        setPlacedOrder(parsed);
        return;
      }
      if (cartLoading) return;
      if (items.length === 0) {
        setPlacedOrder(parsed);
      } else {
        sessionStorage.removeItem(PLACED_ORDER_STORAGE_KEY);
      }
    } catch {
      // sessionStorage can throw in some privacy modes — safe to ignore.
    }
  }, [cartLoading, items.length, placedOrder]);

  // Redirecting here must happen in an effect, not directly in the render
  // body — calling router.push() synchronously during render can run while
  // Next.js is statically prerendering this page (no browser `location`
  // global exists then), which throws "ReferenceError: location is not
  // defined" and fails `next build`.
  useEffect(() => {
    if (hasHydrated && !user) {
      router.push(`/${locale}/login`);
    }
  }, [user, hasHydrated, locale, router]);

  // While the session is still rehydrating from storage we don't yet know
  // whether the buyer is logged in — showing the same loading spinner as the
  // cart-loading case below avoids a false "not logged in" flash/redirect.
  if (!hasHydrated) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink-900/10 border-t-ink-950" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // First load only — without this the order summary briefly showed "0
  // items" / an empty list and a clickable-looking submit button before the
  // cart had actually loaded.
  if (cartLoading && !data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink-900/10 border-t-ink-950" />
      </div>
    );
  }

  if (placedOrder) {
    return (
      <OrderPaymentPanel
        orderId={placedOrder.id}
        locale={locale}
        dict={dict}
        onGoToOrders={() => {
          try {
            sessionStorage.removeItem(PLACED_ORDER_STORAGE_KEY);
          } catch {
            // sessionStorage can throw in some privacy modes — safe to ignore.
          }
          router.push(`/${locale}/orders`);
        }}
      />
    );
  }

  return (
    <div className="container-app py-12">
      <Reveal>
        <h1 className="section-title">{dict.checkout.title}</h1>
      </Reveal>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-10 grid gap-10 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Reveal>
            <div className="card-surface space-y-5 p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-wider">{dict.checkout.deliveryInfo}</h2>
                {/* Ma'lumot allaqachon topilgan bo'lsa (oldingi buyurtma
                    yoki ro'yxatdan o'tishdagi manzil/telefon) — qalam
                    tugmasi tahrirlash formasini ochadi/yopadi. Hech narsa
                    topilmasa (editingDelivery effekt orqali avtomatik true
                    bo'ladi) bu tugma umuman ko'rsatilmaydi, chunki forma
                    allaqachon ochiq. */}
                {deliveryPrefillReady && watch('deliveryAddress') && (
                  <button
                    type="button"
                    onClick={() => setEditingDelivery((v) => !v)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-ink-900/50 hover:text-ink-950 dark:text-cream/50 dark:hover:text-cream"
                  >
                    {editingDelivery ? (
                      dict.checkout.doneEditingDelivery
                    ) : (
                      <>
                        <Pencil size={13} />
                        {dict.checkout.editDeliveryInfo}
                      </>
                    )}
                  </button>
                )}
              </div>

              {editingDelivery ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      {/* Viloyat — O'zbekiston bo'yicha to'liq ro'yxat
                          (lib/data/uzbekistan-regions.ts). Tanlanganda
                          pastdagi tuman ro'yxati o'sha viloyatniki bilan
                          to'ladi. */}
                      <label className="mb-1.5 block text-xs font-semibold text-ink-900/60">{dict.checkout.region}</label>
                      <select
                        {...register('region', {
                          required: true,
                          // Viloyat almashtirilsa, eski tuman qolib
                          // ketmasligi kerak — boshqa viloyatning tumani
                          // ro'yxatda umuman yo'q.
                          onChange: () => setValue('district', ''),
                        })}
                        className="w-full rounded-xl border border-ink-900/15 px-4 py-3 text-sm outline-none focus:border-ink-950"
                      >
                        <option value="">{dict.checkout.regionPlaceholder}</option>
                        {UZBEKISTAN_REGIONS.map((r) => (
                          <option key={r.name} value={r.name}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                      {errors.region && <p className="mt-1 text-xs text-red-500">Majburiy maydon</p>}
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-ink-900/60">{dict.checkout.district}</label>
                      <select
                        {...register('district', { required: true })}
                        disabled={!watch('region')}
                        className="w-full rounded-xl border border-ink-900/15 px-4 py-3 text-sm outline-none focus:border-ink-950 disabled:opacity-50"
                      >
                        <option value="">{dict.checkout.districtPlaceholder}</option>
                        {districtsOf(watch('region')).map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                      {errors.district && <p className="mt-1 text-xs text-red-500">Majburiy maydon</p>}
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-ink-900/60">{dict.checkout.phone}</label>
                      <input
                        {...register('phone', { required: true })}
                        placeholder="+998 90 123 45 67"
                        className="w-full rounded-xl border border-ink-900/15 px-4 py-3 text-sm outline-none focus:border-ink-950"
                      />
                      {errors.phone && <p className="mt-1 text-xs text-red-500">Majburiy maydon</p>}
                    </div>
                  </div>

                  {/* Aniq manzil — ko'cha, uy/xonadon, mo'ljal. Viloyat va
                      tuman ro'yxatdan tanlangani uchun bu yerga faqat
                      qolgan qismi qo'lda yoziladi. */}
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-ink-900/60">{dict.checkout.address}</label>
                    <input
                      {...register('deliveryAddress', { required: true, minLength: 5 })}
                      placeholder={dict.checkout.addressPlaceholder}
                      className="w-full rounded-xl border border-ink-900/15 px-4 py-3 text-sm outline-none focus:border-ink-950"
                    />
                    {errors.deliveryAddress && <p className="mt-1 text-xs text-red-500">Majburiy maydon</p>}
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-ink-900/60">{dict.checkout.note}</label>
                    <textarea
                      {...register('note')}
                      rows={3}
                      className="w-full rounded-xl border border-ink-900/15 px-4 py-3 text-sm outline-none focus:border-ink-950"
                    />
                  </div>
                </>
              ) : (
                // Ko'rish rejimi — ro'yxatdan o'tishda yoki oldingi
                // buyurtmada berilgan ma'lumot qayta so'ralmaydi, faqat
                // ko'rsatiladi. Qiymatlar baribir register() qilingan
                // maydonlarda saqlanadi (hidden emas, shunchaki
                // ko'rsatilmayapti), shuning uchun submit ularni to'liq
                // yuboradi.
                <div className="space-y-4">
                  <div className="space-y-1 text-sm text-ink-900/70 dark:text-cream/70">
                    <p>{watch('deliveryAddress')}</p>
                    {watch('deliveryCity') && <p>{watch('deliveryCity')}</p>}
                    <p>{watch('phone')}</p>
                    {watch('note') && <p className="text-ink-900/50 dark:text-cream/50">{watch('note')}</p>}
                  </div>

                  {/* "Ha, to'g'ri" — saqlangan ma'lumot to'g'ri ekanini
                      tasdiqlab, buyurtmani shu yerdan joylashtirish.
                      Yon ustundagi "Buyurtma berish" tugmasi bilan AYNAN
                      bir xil ishni bajaradi (ikkalasi ham shu formaning
                      submit tugmasi) — telefonda yon ustun pastda qolib
                      ketgani uchun, tasdiqlash ma'lumotning yonida ham
                      turgani qulay. */}
                  <button
                    type="submit"
                    disabled={submitting || items.length === 0}
                    className="btn-primary w-full disabled:opacity-50 sm:w-auto"
                  >
                    <Check size={16} />
                    {submitting ? '…' : dict.checkout.confirmDelivery}
                  </button>
                </div>
              )}
            </div>
          </Reveal>

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>

        <Reveal delay={0.15}>
          <div className="card-surface sticky top-28 space-y-4 p-6">
            <h2 className="text-sm font-bold uppercase tracking-wider">{dict.checkout.orderSummary}</h2>
            <div className="max-h-64 space-y-3 overflow-y-auto">
              {items.map((item: any) => (
                <div key={item.id} className="flex justify-between gap-2 text-xs text-ink-900/60">
                  <span className="max-w-[70%]">
                    <span className="block truncate">
                      {item.product.title} × {item.quantity}
                    </span>
                    {(item.size || item.color) && (
                      <span className="text-ink-900/40">
                        {[item.size, item.color ? translateColorName(item.color, locale) : null].filter(Boolean).join(' · ')}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0">
                    {formatPrice(resolveUnitPrice(item.product, item.size, item.color) * item.quantity, locale)}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between border-t border-ink-900/10 pt-4 text-base font-bold">
              <span>{dict.cart.total}</span>
              <span>{formatPrice(subtotal, locale)}</span>
            </div>

            {/* ── PROMOKOD ──────────────────────────────────────────
                Kod serverda tekshiriladi: mavjudmi, muddati o'tmaganmi,
                shu RAQAMDA allaqachon ishlatilmaganmi va savatdagi
                tovarlarga amal qiladimi. Bu yerdagi summa faqat
                ko'rsatish uchun — buyurtma yaratilganda server kodni
                qaytadan tekshirib, chegirmani o'zi hisoblaydi. */}
            <div className="mt-4 border-t border-ink-900/10 pt-4 dark:border-cream/10">
              <label className="mb-1.5 block text-xs font-semibold text-ink-900/60 dark:text-cream/60">
                {dict.checkout.promoTitle}
              </label>
              <div className="flex gap-2">
                <input
                  value={promoInput}
                  onChange={(e) => {
                    setPromoInput(e.target.value);
                    // Kod o'zgartirilsa avvalgi tasdiq bekor bo'ladi —
                    // aks holda ekranda eski chegirma qolib ketardi.
                    setAppliedPromo(null);
                    setPromoError(null);
                  }}
                  placeholder={dict.checkout.promoPlaceholder}
                  className="min-w-0 flex-1 rounded-xl border border-ink-900/15 px-4 py-2.5 text-sm uppercase outline-none focus:border-ink-950 dark:border-cream/15"
                />
                <button
                  type="button"
                  onClick={applyPromo}
                  disabled={promoChecking || !promoInput.trim()}
                  className="btn-outline shrink-0 !px-4 !py-2.5 text-xs disabled:opacity-50"
                >
                  {promoChecking ? '…' : dict.checkout.promoApply}
                </button>
              </div>
              {promoError && <p className="mt-1.5 text-xs font-medium text-red-500">{promoError}</p>}
              {appliedPromo && (
                <p className="mt-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  {appliedPromo.code} · −{formatPrice(appliedPromo.discount, locale)}
                </p>
              )}
            </div>

            {appliedPromo && (
              <div className="mt-4 flex items-center justify-between border-t border-ink-900/10 pt-4 text-base font-bold dark:border-cream/10">
                <span>{dict.checkout.promoTotal}</span>
                <span>{formatPrice(Math.max(0, subtotal - appliedPromo.discount), locale)}</span>
              </div>
            )}
            <button type="submit" disabled={submitting || items.length === 0} className="btn-primary w-full disabled:opacity-50">
              {submitting ? '…' : dict.checkout.placeOrder}
            </button>
          </div>
        </Reveal>
      </form>
    </div>
  );
}
