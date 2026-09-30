// Kategoriya → qaysi o'lcham turi: BITTA manba, ikkala joyda ishlatiladi —
// do'kon filtri (components/shop/ShopFilters.tsx) va admin panelning
// mahsulot formasi (components/admin/ProductForm.tsx).
//
// ══ NEGA BU FAYL SHUNCHALIK "EHTIYOTKOR" ══
// Category modelida "bu poyabzal" degan aniq belgi yo'q, shuning uchun
// toifaning nomidan aniqlanadi. Avvalgi urinish oddiy ro'yxat bilan
// qidirardi ("krossov|кроссов|...") va u AMALDA ISHLAMADI. Bazadagi
// haqiqiy nomlar tekshirilganda sabab ma'lum bo'ldi:
//
//   'Kроссовки'  →  birinchi harf LOTINCHA "K", qolganlari KIRILCHA!
//   'Aксессуары' →  birinchi harf LOTINCHA "A", qolganlari KIRILCHA!
//   'Krosovka'   →  bitta "s" bilan (ikkita emas)
//
// Ya'ni nom ko'zga bir xil ko'rinsa ham, ichida lotincha va kirilcha
// harflar aralashib ketgan (klaviatura tili almashtirilmay yozilgani
// uchun), ustiga-ustak "s" harfi goh bitta, goh ikkita. Shu sababli
// "krossov" ham, "кроссов" ham hech qachon mos kelmagan.
//
// Endi nom avval NORMALLASHTIRILADI:
//   1) kirilcha harflar lotinchaga o'giriladi  (Kроссовки → Krossovki)
//   2) kichik harfga keltiriladi               (→ krossovki)
//   3) harf bo'lmagan belgilar olib tashlanadi (bo'shliq, tire, ' ...)
//   4) takrorlangan harflar bittaga tushiriladi (krossovki → krosovki)
// Shundan keyingina qidiriladi — natijada "Krosovka", "Krossovka",
// "Кроссовки", "Kроссовки", "КРОССОВКА" — hammasi birdek tanilaveradi.

const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'j', з: 'z',
  и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
  с: 's', т: 't', у: 'u', ф: 'f', х: 'x', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sh',
  ъ: '', ы: 'i', ь: '', э: 'e', ю: 'yu', я: 'ya', ғ: 'g', қ: 'q', ҳ: 'h', ў: 'o',
};

function normalize(text: string): string {
  const lowered = text.toLowerCase();
  let out = '';
  for (const ch of lowered) {
    const mapped = CYRILLIC_TO_LATIN[ch];
    if (mapped !== undefined) out += mapped;
    else if (ch >= 'a' && ch <= 'z') out += ch;
    else if (ch >= '0' && ch <= '9') out += ch;
    // qolgan hamma narsa (bo'shliq, tire, apostrof, boshqa belgilar)
    // tashlab yuboriladi
  }
  // Takrorlangan harflarni bittaga tushirish: "krossovki" → "krosovki",
  // shu bilan "s" bitta yoki ikkita yozilgani ahamiyatsiz bo'lib qoladi.
  return out.replace(/(.)\1+/g, '$1');
}

// Diqqat: ro'yxatdagi so'zlar ham xuddi shu qoida bo'yicha yozilgan —
// ya'ni takrorlanuvchi harfsiz ("krosov", "aksesuar").
const FOOTWEAR_ROOTS = [
  'krosov',   // krossovka, кроссовки, Krosovka, Kроссовки
  'krasov',   // ko'p uchraydigan yozilish: krasovka
  'keda',     // o'zbekcha "keda"
  'poyabzal',
  'obuv',     // обувь
  'tufli',    // туфли
  'botin',    // botinka, ботинки
  'sapog',    // сапоги
  'sandal',   // сандалии
  'shoe',
  'sneaker',
  'snikers',
];

// Shim/jinsi/shortik — bularning o'lchami XS-XXL emas, RAQAM bilan
// beriladi (bel o'lchami). Diqqat: bu ro'yxat oyoq kiyimdan KEYIN emas,
// undan ALOHIDA tekshiriladi va o'zining alohida raqamlar to'plamiga ega
// (shim 36-56, poyabzal esa 35-45 — ular bir xil emas).
const TROUSER_ROOTS = [
  'shim',     // Shim
  'bryuk',    // Брюки → bryuki
  'jins',     // Jinsi, Джинсы → djinsi (ichida "jins" bor)
  'short',    // Shortik, Шорты → shorti
  'shalvar',
  'pants',
  'trouser',
];

// Duxi/atir — hajm (ml) bilan sotiladi. DIQQAT: 'parf' ildizi avval
// pastdagi SIZELESS_ROOTS ro'yxatida turardi, ya'ni parfyumeriya
// "o'lchamsiz toifa" deb hisoblanardi. Endi u shu yerga ko'chirildi —
// aks holda duxi toifasida hajm ro'yxati umuman chiqmay qolardi.
const PERFUME_ROOTS = [
  'duxi',     // duxi, духи → duxi
  'atir',     // atir, atir-upa
  'parf',     // parfyum, parfyumeriya, парфюм, парфюмерия
  'odekolon', // одеколон
  'perfume',
  'tualet',   // "tualet suvi" / туалетная вода
];

const SIZELESS_ROOTS = [
  'akses',    // aksessuar, аксессуары, Aксессуары
  'kosmetik', // косметика (krem, bo'yoq va h.k. — hajm ro'yxati kerak emas)
  'sumk',     // sumka, сумки
  'soat',     // soat
  'chasi',    // часы → chasi (takror harflarsiz)
  'ochki',    // очки
  'kozoynak', // ko'zoynak
  'zargar',   // zargarlik buyumlari
  'bijuter',  // бижутерия
];

export const CLOTHING_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
// 35 dan 45 gacha — so'rov bo'yicha.
export const SHOE_SIZES = ['35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45'];
// Shim/jinsi uchun bel o'lchami — 25 dan boshlanadi (so'rov bo'yicha),
// har bir raqam alohida. Yuqori chegara yetmasa yoki boshqacha kerak
// bo'lsa, shu qatorning o'zini o'zgartirish kifoya — filtr ham, admin
// panel ham aynan shu ro'yxatdan o'qiydi.
export const TROUSER_SIZES = [
  '25', '26', '27', '28', '29', '30', '31', '32', '33',
  '34', '35', '36', '37', '38', '39', '40', '41', '42',
];

// Duxi/atir — bu yerda "o'lcham" emas, HAJM (ml). Mexanizm boshqa
// toifalar bilan bir xil: mahsulotga shu qiymatlar biriktiriladi va
// filtrda ham shular chiqadi. 50ml gacha o'nlik qadam bilan, keyin
// 100ml dan 500ml gacha ellikli qadam bilan.
export const PERFUME_SIZES = [
  '10ml', '20ml', '30ml', '40ml', '50ml',
  '100ml', '150ml', '200ml', '250ml', '300ml', '350ml', '400ml', '450ml', '500ml',
];

export type CategorySizeKind = 'clothing' | 'shoes' | 'trousers' | 'perfume' | 'none';

export interface CategoryLike {
  name?: string | null;
  nameRu?: string | null;
  slug?: string | null;
}

function haystackOf(cat: CategoryLike): string {
  // Nom, ruscha nom va slug — uchalasi birdek tekshiriladi, chunki admin
  // toifani qaysi tilda nomlagani oldindan noma'lum.
  return normalize(`${cat.name ?? ''} ${cat.nameRu ?? ''} ${cat.slug ?? ''}`);
}

export function isFootwearCategory(cat?: CategoryLike | null): boolean {
  if (!cat) return false;
  const hay = haystackOf(cat);
  return FOOTWEAR_ROOTS.some((root) => hay.includes(root));
}

export function isSizelessCategory(cat?: CategoryLike | null): boolean {
  if (!cat) return false;
  const hay = haystackOf(cat);
  return SIZELESS_ROOTS.some((root) => hay.includes(root));
}

export function isTrouserCategory(cat?: CategoryLike | null): boolean {
  if (!cat) return false;
  const hay = haystackOf(cat);
  return TROUSER_ROOTS.some((root) => hay.includes(root));
}

export function isPerfumeCategory(cat?: CategoryLike | null): boolean {
  if (!cat) return false;
  const hay = haystackOf(cat);
  return PERFUME_ROOTS.some((root) => hay.includes(root));
}

// Tekshiruv TARTIBI muhim: duxi eng oldin qaraladi, chunki toifa
// "Kosmetika va parfyumeriya" deb nomlangan bo'lsa, u ikkala ro'yxatga
// ham tushadi — bunday holatda hajm ro'yxati foydaliroq.
// Toifa tanlanmagan bo'lsa (do'konda "Barchasi", adminda hali
// tanlanmagan) — avvalgi xulq-atvor saqlanadi: kiyim o'lchamlari.
export function getCategorySizeKind(cat?: CategoryLike | null): CategorySizeKind {
  if (isPerfumeCategory(cat)) return 'perfume';
  if (isSizelessCategory(cat)) return 'none';
  if (isFootwearCategory(cat)) return 'shoes';
  if (isTrouserCategory(cat)) return 'trousers';
  return 'clothing';
}

// Bo'sh massiv = o'lcham bo'limi umuman ko'rsatilmasin.
export function getSizeOptions(cat?: CategoryLike | null): string[] {
  switch (getCategorySizeKind(cat)) {
    case 'none':
      return [];
    case 'shoes':
      return SHOE_SIZES;
    case 'trousers':
      return TROUSER_SIZES;
    case 'perfume':
      return PERFUME_SIZES;
    default:
      return CLOTHING_SIZES;
  }
}
