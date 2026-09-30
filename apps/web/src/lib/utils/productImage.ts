// Bitta mahsulot uchun, xaridor tanlagan RANGGA mos keladigan asosiy rasmni
// aniqlaydigan yagona joy. Bu mantiq avval QuickBuyModal.tsx'da alohida
// yozilgan edi (Product.colorImages'dan rangga mos rasmni tanlash, topilmasa
// umumiy `images`ga qaytish) — buyurtma/to'lov sahifasi ham xuddi shu
// muammoga duch keladi ("ko'k ko'ylak tanlangan bo'lsa ham har doim bitta
// standart rasm chiqishi"), shuning uchun kodni ikkinchi marta yozish o'rniga
// shu yerga chiqarib, ikkala joy ham ishlatadi.
export interface ProductImageSource {
  images?: string[] | null;
  colorImages?: { color: string; images: string[] }[] | null;
}

export function resolveProductCoverImage(
  product: ProductImageSource | null | undefined,
  color?: string | null,
): string {
  const images = product?.images && product.images.length > 0 ? product.images : ['/placeholder-product.svg'];
  const colorImages = product?.colorImages ?? [];
  const entry = color ? colorImages.find((ci) => ci.color === color) : undefined;
  return entry && entry.images.length > 0 ? entry.images[0] : images[0];
}
