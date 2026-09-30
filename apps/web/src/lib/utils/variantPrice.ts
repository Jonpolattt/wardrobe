// Mahsulotning TANLANGAN variant (o'lcham/rang) uchun haqiqiy narxi.
//
// NEGA KERAK: duxi hajm bo'yicha sotiladi va har bir hajmning o'z narxi
// bor (10ml — bir narx, 100ml — boshqa narx). Shuning uchun variantda
// alohida `price` maydoni paydo bo'ldi. Kiyim, poyabzal kabi narxi
// o'lchamga bog'liq bo'lmagan mahsulotlarda esa u bo'sh (null) qoladi va
// avvalgidek mahsulotning umumiy narxi ishlatiladi.
//
// HAJMGA PROPORSIONAL NARX (duxi): agar variantda o'z narxi yozilmagan
// bo'lsa-yu, o'lcham "10ml", "20ml" kabi hajm bo'lsa — narx eng kichik
// hajmga nisbatan o'zi hisoblanadi:
//
//   eng kichik hajm (10ml) narxi = mahsulotning "Narx" maydoni,
//   20ml = ×2, 30ml = ×3, 50ml = ×5 ...
//
// Ya'ni 10ml = 275 000 bo'lsa, 20ml avtomatik 550 000, 30ml 825 000
// bo'ladi. Admin panelda 100ml dan yuqorisiga qo'lda narx qo'yilsa (ko'p
// hajm arzonroq bo'lgani uchun), o'sha qo'lda yozilgan narx ustun turadi —
// bu hisob faqat narx yozilmagan hajmlar uchun ishlaydi. Shu sababli
// bazada narx saqlanmay qolgan eski mahsulotlar ham to'g'ri ko'rinadi.
//
// MUHIM: bu faqat KO'RSATISH uchun. Buyurtmaning haqiqiy summasi baribir
// serverda, bazadagi qiymatlardan qaytadan hisoblanadi (order.service.ts —
// u yerda ham AYNAN shu qoida takrorlangan) — brauzerdan kelgan narxga
// hech qachon ishonilmaydi.

export interface PricedVariant {
  size: string;
  color: string;
  price?: number | null;
}

export interface PricedProduct {
  price: number;
  // Duxi hajmlari ro'yxati. Bo'lmasa variantlarning o'lchamlaridan
  // olinadi — shuning uchun ixtiyoriy.
  sizes?: string[] | null;
  variants?: PricedVariant[] | null;
}

// "50ml" → 50. Hajm emas (masalan "XL", "42") bo'lsa null.
export function parseMl(size: string | null | undefined): number | null {
  if (!size) return null;
  const match = /^(\d+)\s*ml$/i.exec(String(size).trim());
  if (!match) return null;
  const ml = Number(match[1]);
  return Number.isFinite(ml) && ml > 0 ? ml : null;
}

// Mahsulotning "Narx" maydoni qaysi hajmga tegishli ekani — ENG KICHIK
// hajm. Duxi bo'lmasa (hajm umuman yo'q) null.
export function baseVolumeMl(product: PricedProduct | null | undefined): number | null {
  if (!product) return null;
  const all = [
    ...(product.sizes ?? []),
    ...((product.variants ?? []).map((v) => v.size)),
  ];
  const volumes = all.map(parseMl).filter((ml): ml is number => ml != null);
  if (volumes.length === 0) return null;
  return Math.min(...volumes);
}

// Bitta o'lcham uchun narx: bazada yozilgani bo'lsa — o'sha, bo'lmasa
// hajmga proporsional, u ham bo'lmasa mahsulotning umumiy narxi.
export function priceForSize(
  product: PricedProduct | null | undefined,
  size: string | null | undefined,
  storedPrice?: number | null,
): number {
  if (!product) return 0;
  if (storedPrice != null && Number(storedPrice) > 0) return Number(storedPrice);
  const ml = parseMl(size);
  const base = baseVolumeMl(product);
  if (ml != null && base != null && base > 0) {
    return Math.round(Number(product.price) * (ml / base));
  }
  return Number(product.price);
}

// Tanlangan o'lcham/rang uchun variantni topadi. Variantlar jadvalida
// o'lcham yoki rang ishlatilmaydigan mahsulotlarda bo'sh satr ('')
// saqlanadi, shuning uchun taqqoslashda ham '' ishlatiladi.
export function findVariant(
  product: PricedProduct | null | undefined,
  size?: string | null,
  color?: string | null,
): PricedVariant | undefined {
  if (!product?.variants?.length) return undefined;
  return product.variants.find((v) => v.size === (size ?? '') && v.color === (color ?? ''));
}

export function resolveUnitPrice(
  product: PricedProduct | null | undefined,
  size?: string | null,
  color?: string | null,
): number {
  if (!product) return 0;
  const variant = findVariant(product, size, color);
  // Variant topilmasa ham hajm bo'yicha hisoblanadi — savatchadagi eski
  // qator yoki o'chirib yuborilgan rang tufayli variant topilmay qolsa,
  // narx baribir tanlangan hajmga mos bo'lib qoladi.
  return priceForSize(product, variant?.size ?? size, variant?.price);
}

// Mahsulot kartochkasi uchun: variantlar orasidagi ENG ARZON narx.
// Duxi ro'yxatda turganda eng kichik hajm (10ml) narxi ko'rsatiladi —
// aks holda kartochkadagi narx tanlangan hajmga umuman mos kelmaydi.
export function resolveMinPrice(product: PricedProduct | null | undefined): number {
  if (!product) return 0;
  const variants = product.variants ?? [];
  if (variants.length === 0) return Number(product.price);
  const prices = variants
    .map((v) => priceForSize(product, v.size, v.price))
    .filter((p) => Number.isFinite(p) && p > 0);
  if (prices.length === 0) return Number(product.price);
  return Math.min(...prices);
}

// Narx tanlovga qarab O'ZGARADIMI — ya'ni variantlarning narxi bir xil
// emasmi. Kartochkada "dan boshlab" izohini faqat shunda ko'rsatamiz;
// hamma variant bir xil narxda bo'lgan kiyim/poyabzalda u chiqmaydi.
export function hasVariantPricing(product: PricedProduct | null | undefined): boolean {
  const variants = product?.variants ?? [];
  if (variants.length === 0) return false;
  const prices = variants.map((v) => priceForSize(product, v.size, v.price));
  return Math.max(...prices) > Math.min(...prices);
}
