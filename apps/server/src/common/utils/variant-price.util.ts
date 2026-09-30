// Duxi (parfum) hajmlari uchun narx qoidasi — SERVER tomonidagi nusxasi.
//
// Frontenddagi `src/lib/utils/variantPrice.ts` bilan AYNAN bir xil qoida:
//   - variantda o'z narxi yozilgan bo'lsa — o'sha ishlatiladi
//     (admin 100ml dan yuqorisiga qo'lda qo'ygan narxlar shu yerga tushadi),
//   - yozilmagan bo'lsa-yu o'lcham hajm bo'lsa ("10ml", "20ml") — eng
//     kichik hajmga nisbatan proporsional hisoblanadi: eng kichik hajm
//     narxi = mahsulotning umumiy narxi, 2 barobar hajm = 2 barobar narx,
//   - hajm ham bo'lmasa — mahsulotning umumiy narxi.
//
// Ikkala tomonda bir xil bo'lishi SHART: foydalanuvchi saytda ko'rgan narx
// bilan buyurtmada hisoblangan summa farq qilib qolmasligi kerak. Lekin
// haqiqiy summa baribir shu yerda, bazadagi qiymatlardan hisoblanadi —
// brauzerdan kelgan narxga hech qachon ishonilmaydi.

import { parseMl } from '@wardrobe/utils';
import type { PriceValue, PricedVariant } from '@wardrobe/types';

export type PricedVariantLike = PricedVariant;

export interface PricedProductLike {
  price: PriceValue;
  variants?: PricedVariantLike[] | null;
}

export { parseMl } from '@wardrobe/utils';

export function baseVolumeMl(product: PricedProductLike | null | undefined): number | null {
  const volumes = (product?.variants ?? [])
    .map((v) => parseMl(v.size))
    .filter((ml): ml is number => ml != null);
  if (volumes.length === 0) return null;
  return Math.min(...volumes);
}

export function priceForVariant(
  product: PricedProductLike,
  variant: PricedVariantLike | null | undefined,
): number {
  const productPrice = Number(product.price);
  if (variant?.price != null && Number(variant.price) > 0) return Number(variant.price);
  const ml = parseMl(variant?.size);
  const base = baseVolumeMl(product);
  if (ml != null && base != null && base > 0) {
    return Math.round(productPrice * (ml / base));
  }
  return productPrice;
}

// Savatcha qatori (o'lcham/rang) uchun birlik narxi.
export function resolveUnitPrice(
  product: PricedProductLike,
  size?: string | null,
  color?: string | null,
): number {
  const variant =
    size || color
      ? (product.variants ?? []).find((v) => v.size === (size ?? '') && v.color === (color ?? ''))
      : null;
  // Variant topilmasa ham o'lcham hajm bo'lsa proporsional hisoblanadi.
  return priceForVariant(product, variant ?? (size ? { size, color: color ?? '' } : null));
}
