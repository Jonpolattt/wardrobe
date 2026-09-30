'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useQuery } from '@apollo/client';
import { Check, Copy, Send, X, Package } from 'lucide-react';
import { GET_ORDER, GET_SITE_SETTINGS } from '@/lib/graphql/queries';
import { formatPrice } from '@/lib/utils/format';
import { translateColorName } from '@/lib/utils/colorNames';
import { resolveProductCoverImage } from '@/lib/utils/productImage';
import { Reveal } from '@/components/ui/Reveal';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/get-dictionary';

// Real Click/Payme merchant credentials aren't configured yet, so payment is
// coordinated manually: the buyer transfers to this card and sends the
// receipt via Telegram.
//
// KARTA endi admin panelning "Sozlamalar" bo'limidan o'zgartiriladi
// (siteSettings.paymentCardNumber / paymentCardHolder) — karta
// almashsa, saytni qayta deploy qilish shart emas, yangi raqam o'sha
// zahoti shu ekranda ko'rinadi. Quyidagilar faqat ZAXIRA qiymat: admin
// hali hech narsa kiritmagan (yoki so'rov javob bermagan) holat uchun,
// shunda to'lov ekrani hech qachon bo'sh karta ko'rsatmaydi.
const FALLBACK_CARD_NUMBER = '4073 4200 2305 8815';
const FALLBACK_CARD_HOLDER = 'Muhammadjon Zoirov';

// "4073420023058815" -> "4073 4200 2305 8815". Admin raqamni bo'sh
// joysiz yozsa ham karta chiroyli ko'rinishi uchun.
function formatCardNumber(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length < 12) return value.trim();
  return digits.replace(/(.{4})/g, '$1 ').trim();
}
// Falls back to the admin's personal account if the bot isn't configured yet
// (NEXT_PUBLIC_TELEGRAM_BOT_USERNAME empty in .env.local) — otherwise
// deep-links straight into the bot with ?start=order_<id>, so the bot can
// bind the buyer's chat to this exact order automatically.
const TELEGRAM_BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || '';
const TELEGRAM_FALLBACK_USERNAME = 'MZ0526';

// Bitta buyurtmaning "holatini ko'rish + to'lash" ekrani — ikkita joyda
// ishlatiladi: (1) checkout sahifasida, xaridor "Buyurtma berish"ni bosgan
// zahoti, va (2) "Buyurtmalarim"dagi to'lanmagan buyurtma kartochkasi
// bosilganda ochiladigan alohida sahifada (xaridor keyinroq qaytib to'lashni
// xohlasa). Ikkalasi ham xuddi shu ma'lumotni (mahsulot, miqdor, narx,
// "Bizning karta", Telegram tugmasi) ko'rsatishi kerak edi — shuning uchun
// bitta joyga chiqarilgan, ikkinchi marta yozilmagan.
//
// `orderId` beriladi, qolgan hammasi (mahsulot rasmlari, narxi, holati)
// shu buyurtmaning o'zidan (GET_ORDER) so'raladi — hech narsa hardcode
// qilinmagan yoki chaqiruvchi component orqali qo'lda uzatilmagan, shunda
// checkout va "Buyurtmalarim"dan kelgan holatlar bir xil, ishonchli manbadan
// (backend) o'qiydi.
export function OrderPaymentPanel({
  orderId,
  locale,
  dict,
  onGoToOrders,
}: {
  orderId: string;
  locale: Locale;
  dict: Dictionary;
  onGoToOrders: () => void;
}) {
  const [copied, setCopied] = useState(false);

  // `cache-first` — sozlamalar kam o'zgaradi, har bir ochilishda qayta
  // so'rashning hojati yo'q; admin o'zgartirganda esa uning o'z
  // sahifasidagi `refetchQueries` keshni yangilaydi.
  const { data: settingsData } = useQuery(GET_SITE_SETTINGS, { fetchPolicy: 'cache-first' });
  const cardNumber = formatCardNumber(
    settingsData?.siteSettings?.paymentCardNumber || FALLBACK_CARD_NUMBER,
  );
  const cardHolder = settingsData?.siteSettings?.paymentCardHolder || FALLBACK_CARD_HOLDER;

  // `network-only` + polling — admin to'lovni tasdiqlagan/rad etgan zahoti
  // (saytda yoki Telegram bot orqali) bu ekran ham yangilanishi kerak,
  // xaridor sahifani qo'lda yangilamasdan turib.
  const { data, loading, error } = useQuery(GET_ORDER, {
    variables: { id: orderId },
    pollInterval: 4000,
    fetchPolicy: 'network-only',
  });
  const order = data?.order;

  function copyCardNumber() {
    navigator.clipboard.writeText(cardNumber.replace(/\s/g, ''));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading && !data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink-900/10 border-t-ink-950" />
      </div>
    );
  }

  // Buyurtma topilmadi (o'chirilgan) yoki bu foydalanuvchiga tegishli emas
  // (backend order.resolver.ts buni ForbiddenException bilan rad etadi) —
  // ikkala holatda ham xato ekran o'rniga tushunarli xabar ko'rsatiladi.
  if (error || !order) {
    return (
      <div className="container-app flex flex-col items-center py-20 text-center">
        <Package size={36} className="text-ink-900/20" />
        <p className="mt-4 text-sm text-ink-900/50">{dict.checkout.orderNotFoundBody}</p>
        <button type="button" onClick={onGoToOrders} className="btn-outline mt-6">
          {dict.checkout.goToOrders}
        </button>
      </div>
    );
  }

  // With the bot configured, `?start=order_<id>` deep-links straight into
  // it — the bot then knows exactly which order this chat belongs to the
  // moment the buyer opens it. Falls back to the old pre-filled-text link to
  // the admin's personal account if the bot isn't set up yet.
  const telegramHref = TELEGRAM_BOT_USERNAME
    ? `https://t.me/${TELEGRAM_BOT_USERNAME}?start=order_${order.id}`
    : `https://t.me/${TELEGRAM_FALLBACK_USERNAME}?text=${encodeURIComponent(
        `${dict.orders.orderNumber}: ${order.orderNumber}\n${dict.orders.total}: ${formatPrice(order.totalAmount, locale)}\n${dict.checkout.telegramReceiptMessage}`,
      )}`;

  const goToOrdersButton = (
    <button type="button" onClick={onGoToOrders} className="btn-outline w-full">
      {dict.checkout.goToOrders}
    </button>
  );

  // 1) Mahsulot rasmi/nomi/varianti/miqdori/narxi — har bir buyurtma
  // qatorida, xaridor tanlagan RANGGA mos rasm bilan (resolveProductCoverImage
  // — bitta standart rasm emas).
  const productList = (
    <div className="space-y-3 text-left">
      {order.items.map((item: any) => {
        const cover = resolveProductCoverImage(item.product, item.color);
        return (
          <div
            key={item.id}
            className="flex items-center gap-3 rounded-xl border border-ink-900/10 p-3 dark:border-cream/10"
          >
            <div className="relative h-16 w-14 shrink-0 overflow-hidden rounded-lg bg-ink-900/5">
              <Image src={cover} alt={item.title} fill className="object-cover" unoptimized />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold dark:text-cream">{item.title}</p>
              {(item.size || item.color) && (
                <p className="text-xs text-ink-900/50">
                  {[item.size, item.color ? translateColorName(item.color, locale) : null].filter(Boolean).join(' · ')}
                </p>
              )}
              <p className="text-xs text-ink-900/50">
                {item.quantity} × {formatPrice(item.price, locale)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );

  // 2) Narx / buyurtma xulosasi.
  const totalRow = (
    <div className="flex items-center justify-between border-t border-ink-900/10 pt-3 text-base font-bold dark:border-cream/10">
      <span>{dict.cart.total}</span>
      <span>{formatPrice(order.totalAmount, locale)}</span>
    </div>
  );

  // Confirmed — the card/Telegram instructions are no longer needed, so this
  // replaces them entirely with a plain success state instead of leaving a
  // "still waiting for payment" screen up after payment is already done.
  if (order.paymentStatus === 'PAID') {
    return (
      <div className="container-app py-20">
        <Reveal>
          <div className="mx-auto max-w-md card-surface space-y-5 p-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300">
              <Check size={28} strokeWidth={3} />
            </div>
            <h1 className="font-display text-2xl font-medium">{dict.checkout.paymentConfirmedTitle}</h1>
            <p className="text-sm text-ink-900/60 dark:text-cream/60">{dict.checkout.paymentConfirmedBody}</p>
            <p className="text-xs text-ink-900/50">
              {dict.checkout.orderPlacedSubtitle}: <span className="font-mono font-semibold">{order.orderNumber}</span>
            </p>
            {productList}
            {totalRow}
            {goToOrdersButton}
          </div>
        </Reveal>
      </div>
    );
  }

  // Rejected — keeps the card/Telegram instructions below the rejection
  // notice (rather than replacing them) so the buyer can immediately retry
  // with a corrected screenshot without hunting for the card number again.
  const rejected = order.paymentStatus === 'FAILED';

  return (
    <div className="container-app py-20">
      <Reveal>
        <div className="mx-auto max-w-md card-surface space-y-5 p-8 text-center">
          {rejected ? (
            <>
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-300">
                <X size={28} strokeWidth={3} />
              </div>
              <h1 className="font-display text-2xl font-medium">{dict.checkout.paymentRejectedTitle}</h1>
              <p className="text-sm text-ink-900/60 dark:text-cream/60">{dict.checkout.paymentRejectedBody}</p>
            </>
          ) : (
            <h1 className="font-display text-2xl font-medium">{dict.checkout.orderPlacedTitle}</h1>
          )}
          <p className="text-xs text-ink-900/50">
            {dict.checkout.orderPlacedSubtitle}: <span className="font-mono font-semibold">{order.orderNumber}</span>
          </p>

          {/* Tartib: 1) mahsulot ma'lumoti, 2) narx/xulosa, 3) "Bizning
              karta", 4) qolgan to'lov ma'lumoti (Telegram), 5) amal
              tugmalari — so'ralgan joylashuvga mos. */}
          {productList}
          {totalRow}

          <div className="space-y-3 text-left">
            <p className="text-sm text-ink-900/70 dark:text-cream/70">{dict.checkout.paymentCardInstructions}</p>

            {/* "Bizning karta" — haqiqiy bank kartasiga o'xshash ko'rinish:
                yumaloq burchak, ism va raqam oddiy (sans) shriftda pastki
                chap burchakda. Kenglik doim ota elementga (max-w-md karta)
                100% mos keladi — alohida max-width belgilanmagan.
                Light mode'da oq fon + aniq ko'rinadigan border ("qosh"),
                dark mode'da esa to'q (qora) fon — sayt bo'yicha `dark:`
                pattern'iga mos. */}
            <button
              type="button"
              onClick={copyCardNumber}
              className="group relative flex aspect-[8/5] w-full flex-col justify-end gap-1 rounded-2xl border border-ink-900/15 bg-white p-5 text-left shadow-soft transition-transform active:scale-[0.98] dark:border-cream/15 dark:bg-gradient-to-br dark:from-ink-900 dark:to-ink-950"
            >
              <Copy size={16} className="absolute right-4 top-4 text-ink-900/30 transition-colors group-hover:text-ink-900/60 dark:text-cream/30 dark:group-hover:text-cream/60" />
              <p className="text-[24px] font-medium leading-tight text-ink-900/80 dark:text-cream/90">{cardHolder}</p>
              <p className="text-2xl font-semibold leading-tight tracking-wider text-ink-950 dark:text-cream">{cardNumber}</p>
            </button>
            {copied && <p className="text-xs font-semibold text-emerald-600">{dict.checkout.copied}</p>}

            <a
              href={telegramHref}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary flex w-full items-center justify-center gap-2"
            >
              <Send size={16} />
              {dict.checkout.sendReceiptTelegram}
            </a>
          </div>

          {goToOrdersButton}
        </div>
      </Reveal>
    </div>
  );
}
