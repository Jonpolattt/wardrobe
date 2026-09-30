// ROOT-CAUSE FIX for "rang har joyda boshqacha ko'rinadi" (the color swatch
// looks different in different places): four separate spots in this app
// each need to turn a product's color NAME (a plain string like "Qizil")
// into an actual color to paint a swatch with — the admin's product form,
// the shop page's filter sidebar, the quick-buy modal, and the product
// detail page's own color picker — and each of them used to keep its OWN
// hardcoded name→hex list. They'd drifted apart (e.g. "Qizil" was #a83232
// in the admin form/shop filter but #dc2626 in the quick-buy modal), so the
// same color read as a visibly different shade depending which part of the
// site you were looking at. This is the one shared source all four now
// import from, so a color always paints the same swatch everywhere.

// The curated one-click preset list the admin panel offers when adding a
// product's colors, and the shop filter sidebar's fixed swatch list — both
// want this exact ordered {name, hex} shape.
//
// RO'YXAT KENGAYTIRILDI: avval atigi 9 ta rang bor edi, ya'ni admin
// "och ko'k" yoki "to'q yashil" kabi oddiy tuslarni qo'lda yozishga
// majbur bo'lardi (qo'lda yozilgan nom esa hech qanday tusga mos
// kelmay, kulrang nuqta bo'lib chiqardi). Endi asosiy ranglarning
// och/oddiy/to'q variantlari tayyor turadi.
//
// TARTIB: oq → kulranglar → qora, keyin ko'k, yashil, qizil/pushti,
// sariq/jigarrang va binafsha oilalari. Har oila ichida ochdan to'qqa.
//
// DIQQAT — MAVJUD 9 TA RANGNING HEX QIYMATI O'ZGARMADI: bazadagi
// tovarlarda rang NOMI saqlanadi, tus esa shu yerdan olinadi. Qiymat
// o'zgartirilsa, allaqachon qo'shilgan tovarlarning rangi ham
// o'zgarib ketardi.
export const PRESET_COLORS: { name: string; hex: string }[] = [
  // ── Neytral ──
  { name: 'Oq', hex: '#f7f5f2' },
  { name: 'Krem', hex: '#f4ead7' },
  { name: 'Bej', hex: '#d8c9a8' },
  { name: 'Kumush', hex: '#c7ccd1' },
  { name: 'Och kulrang', hex: '#d4d4d8' },
  { name: 'Kulrang', hex: '#8b8b8b' },
  { name: "To'q kulrang", hex: '#4b5563' },
  { name: 'Qora', hex: '#111114' },
  // ── Ko'k ──
  { name: "Och ko'k", hex: '#93c5fd' },
  { name: 'Moviy', hex: '#3b82f6' },
  { name: "Ko'k", hex: '#2b4a7a' },
  { name: "To'q ko'k", hex: '#1e3a8a' },
  { name: 'Firuza', hex: '#14b8a6' },
  // ── Yashil ──
  { name: 'Och yashil', hex: '#86efac' },
  { name: 'Yashil', hex: '#3a6b45' },
  { name: "To'q yashil", hex: '#14532d' },
  { name: 'Xaki', hex: '#8a8156' },
  // ── Qizil va pushti ──
  { name: 'Och qizil', hex: '#f87171' },
  { name: 'Qizil', hex: '#a83232' },
  { name: "To'q qizil", hex: '#7f1d1d' },
  { name: 'Bordo', hex: '#5b1a2b' },
  { name: 'Och pushti', hex: '#fbcfe8' },
  { name: 'Pushti', hex: '#f472b6' },
  // ── Sariq va jigarrang ──
  { name: 'Sariq', hex: '#d8b969' },
  { name: 'Oltin', hex: '#c9a227' },
  { name: "To'q sariq", hex: '#f97316' },
  { name: 'Och jigarrang', hex: '#b08968' },
  { name: 'Jigarrang', hex: '#6b4a2f' },
  // ── Binafsha ──
  { name: 'Siyohrang', hex: '#a855f7' },
  { name: "To'q siyohrang", hex: '#6b21a8' },
];

// Nomni qidirishdan oldin bir ko'rinishga keltirish: katta-kichik harf,
// apostrofning turli belgilari ("To'q" / "To‘q" / "To`q") va ortiqcha
// bo'shliqlar farq qilmasligi kerak. Shuning uchun quyidagi jadvalning
// KALITLARI ham aynan shu ko'rinishda — apostrofsiz — yozilgan.
function normalizeColorKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/['’`ʻ]/g, '')
    .replace(/\s+/g, ' ');
}

// Broader lookup for turning an arbitrary color name (however it's actually
// stored on a product — including a custom color an admin free-typed, or
// the same color spelled in Uzbek/Russian/English) into a real color for a
// swatch. Built from PRESET_COLORS' own hex values plus common synonyms,
// so a preset color always matches the exact shade shown when the admin
// picked it.
const COLOR_SWATCHES: Record<string, string> = {
  // ── Neytral ──
  oq: '#f7f5f2',
  white: '#f7f5f2',
  белый: '#f7f5f2',
  krem: '#f4ead7',
  cream: '#f4ead7',
  кремовый: '#f4ead7',
  bej: '#d8c9a8',
  beige: '#d8c9a8',
  бежевый: '#d8c9a8',
  kumush: '#c7ccd1',
  silver: '#c7ccd1',
  серебряный: '#c7ccd1',
  'och kulrang': '#d4d4d8',
  'light gray': '#d4d4d8',
  'светло-серый': '#d4d4d8',
  kulrang: '#8b8b8b',
  gray: '#8b8b8b',
  grey: '#8b8b8b',
  серый: '#8b8b8b',
  'toq kulrang': '#4b5563',
  'dark gray': '#4b5563',
  'тёмно-серый': '#4b5563',
  'темно-серый': '#4b5563',
  qora: '#111114',
  black: '#111114',
  чёрный: '#111114',
  черный: '#111114',
  // ── Ko'k ──
  'och kok': '#93c5fd',
  'light blue': '#93c5fd',
  голубой: '#93c5fd',
  moviy: '#3b82f6',
  kok: '#2b4a7a',
  blue: '#2b4a7a',
  синий: '#2b4a7a',
  'toq kok': '#1e3a8a',
  navy: '#1e3a8a',
  'dark blue': '#1e3a8a',
  'тёмно-синий': '#1e3a8a',
  'темно-синий': '#1e3a8a',
  firuza: '#14b8a6',
  turquoise: '#14b8a6',
  бирюзовый: '#14b8a6',
  // ── Yashil ──
  'och yashil': '#86efac',
  'light green': '#86efac',
  'светло-зелёный': '#86efac',
  'светло-зеленый': '#86efac',
  yashil: '#3a6b45',
  green: '#3a6b45',
  зелёный: '#3a6b45',
  зеленый: '#3a6b45',
  'toq yashil': '#14532d',
  'dark green': '#14532d',
  'тёмно-зелёный': '#14532d',
  'темно-зеленый': '#14532d',
  xaki: '#8a8156',
  khaki: '#8a8156',
  хаки: '#8a8156',
  // ── Qizil va pushti ──
  'och qizil': '#f87171',
  'light red': '#f87171',
  'светло-красный': '#f87171',
  qizil: '#a83232',
  red: '#a83232',
  красный: '#a83232',
  'toq qizil': '#7f1d1d',
  'dark red': '#7f1d1d',
  'тёмно-красный': '#7f1d1d',
  'темно-красный': '#7f1d1d',
  bordo: '#5b1a2b',
  burgundy: '#5b1a2b',
  бордовый: '#5b1a2b',
  'och pushti': '#fbcfe8',
  'light pink': '#fbcfe8',
  'светло-розовый': '#fbcfe8',
  pushti: '#f472b6',
  pink: '#f472b6',
  розовый: '#f472b6',
  // ── Sariq va jigarrang ──
  sariq: '#d8b969',
  yellow: '#d8b969',
  жёлтый: '#d8b969',
  желтый: '#d8b969',
  oltin: '#c9a227',
  gold: '#c9a227',
  золотой: '#c9a227',
  'toq sariq': '#f97316',
  orange: '#f97316',
  оранжевый: '#f97316',
  'och jigarrang': '#b08968',
  'light brown': '#b08968',
  'светло-коричневый': '#b08968',
  jigarrang: '#6b4a2f',
  brown: '#6b4a2f',
  коричневый: '#6b4a2f',
  // ── Binafsha ──
  siyohrang: '#a855f7',
  binafsha: '#a855f7',
  purple: '#a855f7',
  фиолетовый: '#a855f7',
  'toq siyohrang': '#6b21a8',
  'dark purple': '#6b21a8',
  'тёмно-фиолетовый': '#6b21a8',
  'темно-фиолетовый': '#6b21a8',
};

// Anything not recognized (a genuinely custom color name) falls back to a
// neutral gray dot rather than breaking.
export function swatchColor(name: string): string {
  return COLOR_SWATCHES[normalizeColorKey(name)] ?? '#9ca3af';
}
