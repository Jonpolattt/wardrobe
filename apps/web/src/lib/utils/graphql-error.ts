import { ApolloError } from '@apollo/client';

/**
 * Turns a raw Apollo/GraphQL error (which by default is just "Bad Request
 * Exception" or a stack trace) into a short message an admin can actually
 * understand, in Uzbek.
 */
export function getFriendlyErrorMessage(error: unknown): string {
  if (error instanceof ApolloError) {
    const gqlMessage = error.graphQLErrors?.[0]?.message;
    const networkMessage = (error.networkError as any)?.result?.message;

    const raw = gqlMessage || (Array.isArray(networkMessage) ? networkMessage[0] : networkMessage) || error.message;

    if (!raw) return "Noma'lum xatolik yuz berdi. Qaytadan urinib ko'ring.";

    // class-validator messages usually look like "brandId must be a UUID" —
    // translate the field names we know about into readable Uzbek.
    const lower = String(raw).toLowerCase();
    if (lower.includes('categoryid')) return 'Toifani (kategoriya) tanlashingiz kerak.';
    if (lower.includes('brandid')) return "Brend noto'g'ri tanlangan. Qaytadan tanlang yoki bo'sh qoldiring.";
    if (lower.includes('sku')) return "SKU kodi noto'g'ri yoki allaqachon band. Boshqa kod kiriting.";
    if (lower.includes('title')) return "Mahsulot nomini to'g'ri kiriting (kamida 2 ta belgi).";
    if (lower.includes('price')) return "Narx noto'g'ri kiritilgan.";
    if (lower.includes('unauthorized') || lower.includes('forbidden')) {
      return 'Sizda bu amalni bajarish uchun ruxsat yo‘q. Qaytadan tizimga kiring.';
    }
    if (lower.includes('bad request')) return "Ma'lumotlarda xatolik bor. Barcha (*) maydonlarni to'g'ri to'ldirganingizni tekshiring.";
    if (lower.includes('phone_not_verified')) return "Telefon raqamingiz hali tasdiqlanmagan. Tasdiqlash sahifasiga o'ting.";
    if (lower.includes('email_not_verified')) return "Hisobingiz hali tasdiqlanmagan. Tasdiqlash sahifasiga o'ting.";

    return String(raw);
  }

  if (error instanceof Error) {
    if (error.message.toLowerCase().includes('failed to fetch')) {
      return "Serverga ulanib bo'lmadi. Backend ishga tushirilganini tekshiring.";
    }
    return error.message;
  }

  return "Noma'lum xatolik yuz berdi. Qaytadan urinib ko'ring.";
}
