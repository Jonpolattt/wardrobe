// Native copy of the canonical responsive-web colorNames.ts; mapping values are preserved.
import type { Locale } from '@wardrobe/types';

// Mahsulot ranglari admin panelida doim faqat o'zbekcha nom bilan saqlanadi
// (masalan "Qora", "Ko'k" — bazada rang uchun sarlavha/tavsif kabi alohida
// "colorRu" maydoni yo'q). Shuning uchun sayt rus tilida ko'rsatilganda ham
// rang nomlari o'zbekcha chiqib qolar edi. Bu — tayyor ranglar ro'yxati
// (lib/utils/colorSwatch.ts, PRESET_COLORS) uchun tarjima jadvali.
// Jadvalda topilmagan nom (admin qo'lda yozgan erkin rang) o'zgarishsiz
// qaytariladi — ya'ni bu funksiya hech qachon bo'sh/undefined qaytarmaydi.
//
// Kalitlar `normalizeKey` ko'rinishida — kichik harf, apostrofsiz.
const COLOR_NAME_RU: Record<string, string> = {
  // Neytral
  oq: 'Белый',
  krem: 'Кремовый',
  bej: 'Бежевый',
  kumush: 'Серебряный',
  'och kulrang': 'Светло-серый',
  kulrang: 'Серый',
  'toq kulrang': 'Тёмно-серый',
  qora: 'Чёрный',
  // Ko'k
  'och kok': 'Голубой',
  moviy: 'Синий',
  kok: 'Синий',
  'toq kok': 'Тёмно-синий',
  firuza: 'Бирюзовый',
  // Yashil
  'och yashil': 'Светло-зелёный',
  yashil: 'Зелёный',
  'toq yashil': 'Тёмно-зелёный',
  xaki: 'Хаки',
  // Qizil va pushti
  'och qizil': 'Светло-красный',
  qizil: 'Красный',
  'toq qizil': 'Тёмно-красный',
  bordo: 'Бордовый',
  'och pushti': 'Светло-розовый',
  pushti: 'Розовый',
  // Sariq va jigarrang
  sariq: 'Жёлтый',
  oltin: 'Золотой',
  'toq sariq': 'Оранжевый',
  'och jigarrang': 'Светло-коричневый',
  jigarrang: 'Коричневый',
  // Binafsha
  siyohrang: 'Фиолетовый',
  binafsha: 'Фиолетовый',
  'toq siyohrang': 'Тёмно-фиолетовый',
};

// Kalitni normalizatsiya qilish — "Ko'k" so'zidagi apostrof turli
// klaviatura/terminaldan turlicha belgi (', ', `, ʻ) bo'lib kelishi mumkin,
// shuning uchun qidiruvdan oldin ularning barchasi olib tashlanadi.
// Ortiqcha bo'shliqlar ham bir ko'rinishga keltiriladi ("To'q  ko'k").
function normalizeKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/['’`ʻ]/g, '')
    .replace(/\s+/g, ' ');
}

export function translateColorName(name: string, locale: Locale): string {
  if (locale !== 'ru' || !name) return name;
  return COLOR_NAME_RU[normalizeKey(name)] ?? name;
}
