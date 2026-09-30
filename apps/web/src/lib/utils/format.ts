// Narx va sanani matnga aylantirish.
//
// ILDIZ SABAB (hydration xatosi): avval bu yerda `Intl.NumberFormat`
// ishlatilardi. Muammo shundaki, Intl natijasi MUHITGA bog'liq —
// u o'sha muhitda qaysi tillar ma'lumoti (ICU) borligiga qarab
// o'zgaradi:
//   - server (Node) "uz-UZ" ni tanib, "250 000" deb yozardi;
//   - brauzer esa uni tanimay "en-US" ga qaytib, "250,000" deb yozardi.
// Next.js sahifani avval serverda chizadi, keyin brauzerda "hydrate"
// qiladi va ikkala matnni solishtiradi — farq chiqishi bilan
// "Text content does not match server-rendered HTML" xatosi paydo
// bo'ladi (aynan shu ko'rinib turgan xato).
//
// Yechim: raqamni Intl'siz, QO'LDA formatlash. Natija har qanday
// muhitda — serverda ham, istalgan brauzerda ham — bir xil bo'ladi,
// ya'ni hydration xatosi qaytib kelmaydi. Ko'rinishi ham o'zgarmaydi:
// mingliklar ajratgichi sifatida avvalgidek oddiy bo'sh joy ishlatiladi
// ("250 000 so'm").
//
// Ataylab ODDIY bo'sh joy (U+0020) olingan, "narrow no-break space"
// (U+202F) emas — ba'zi muhitlarda Intl aynan shuni qo'yardi va
// nusxa-ko'chirishda ko'rinmas belgi bo'lib yopishib qolardi.

function groupDigits(value: number): string {
  // Manfiy son ham to'g'ri chiqishi uchun ishorani alohida saqlaymiz.
  const negative = value < 0;
  const digits = Math.round(Math.abs(value)).toString();
  // Har uch raqamdan keyin bo'sh joy: "250000" -> "250 000".
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return negative ? `-${grouped}` : grouped;
}

export function formatPrice(value: number | string, locale: 'uz' | 'ru' = 'uz') {
  const num = Number(value);
  // NaN (masalan bo'sh satr kelsa) sahifani buzmasligi uchun 0 ga
  // tushiriladi.
  const safe = Number.isFinite(num) ? num : 0;
  return `${groupDigits(safe)} so'm`;
}

// Sana ham xuddi shu sababga ko'ra qo'lda yig'iladi: `Intl.DateTimeFormat`
// oy nomini muhitga qarab turlicha yozardi ("15 sen." / "15 Sep" / "15
// сент.") va bu ham hydration farqiga olib kelardi.
const MONTHS: Record<'uz' | 'ru', string[]> = {
  uz: ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'],
  ru: ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'],
};

export function formatDate(value: string | Date, locale: 'uz' | 'ru' = 'uz') {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '';
  const day = String(date.getDate()).padStart(2, '0');
  const month = MONTHS[locale === 'ru' ? 'ru' : 'uz'][date.getMonth()] ?? '';
  return `${day} ${month} ${date.getFullYear()}`;
}
