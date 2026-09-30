'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Package } from 'lucide-react';
import { useAuthStore } from '@/lib/store/auth-store';
import { OrderPaymentPanel } from '@/components/checkout/OrderPaymentPanel';
import type { Locale } from '@/i18n/config';
import uzDict from '@/i18n/dictionaries/uz.json';
import ruDict from '@/i18n/dictionaries/ru.json';

// "Buyurtmalarim" ro'yxatidagi TO'LANMAGAN buyurtma kartochkasi bosilganda
// shu sahifa ochiladi — aynan o'sha buyurtmaning mahsuloti, miqdori, narxi
// va "Bizning karta" to'lov ma'lumotini ko'rsatib, xaridorga uni keyinroq
// ham to'lash imkonini beradi. To'langan buyurtma uchun ham ishlaydi (to'g'ri
// URL orqali ochilsa) — OrderPaymentPanel bunday holatda faqat "to'landi"
// tasdiqini ko'rsatadi, karta/Telegram ma'lumotisiz.
export default function OrderDetailPage({ params }: { params: { locale: Locale; id: string } }) {
  const { locale, id } = params;
  const dict = locale === 'ru' ? ruDict : uzDict;
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);

  // Xuddi checkout/profile/orders sahifalaridagi kabi — sessiya hali
  // tiklanayotgan bir lahzalik holatni tizimga kirmagan deb hisoblamaslik
  // uchun `hasHydrated`ga qarab kutiladi.
  useEffect(() => {
    if (hasHydrated && !user) {
      router.push(`/${locale}/login`);
    }
  }, [user, hasHydrated, locale, router]);

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

  if (!id) {
    return (
      <div className="container-app flex flex-col items-center py-20 text-center">
        <Package size={36} className="text-ink-900/20" />
        <p className="mt-4 text-sm text-ink-900/50">{dict.checkout.orderNotFoundBody}</p>
      </div>
    );
  }

  return <OrderPaymentPanel orderId={id} locale={locale} dict={dict} onGoToOrders={() => router.push(`/${locale}/orders`)} />;
}
