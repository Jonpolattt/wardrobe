import type { Banner, Locale, Product } from '@wardrobe/types';

export function productTitle(product: Product, locale: Locale): string {
  return locale === 'ru' && product.titleRu ? product.titleRu : product.title;
}

export function localizedName(
  value: { name: string; nameRu?: string | null },
  locale: Locale,
): string {
  return locale === 'ru' && value.nameRu ? value.nameRu : value.name;
}

export function bannerTitle(banner: Banner, locale: Locale): string {
  return (locale === 'ru' && banner.titleRu ? banner.titleRu : banner.title) ?? '';
}

export function productDescription(product: Product, locale: Locale): string {
  return (locale === 'ru' && product.descriptionRu
    ? product.descriptionRu
    : product.description) ?? '';
}

export function productImages(product: Product, color?: string): string[] {
  const selected = product.colorImages.find((entry) => entry.color === color)?.images;
  return selected?.length ? selected : product.images;
}

/** Availability hint only. Final quantities and prices are validated by the server. */
export function selectedStock(product: Product, size?: string, color?: string): number {
  if (!product.variants.length) return product.stock;
  return product.variants.find(
    (variant) => variant.size === (size ?? '') && variant.color === (color ?? ''),
  )?.stock ?? 0;
}
