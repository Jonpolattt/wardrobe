import { PRODUCT_FIELDS } from '@wardrobe/api-client';
import type { Product } from '@wardrobe/types';
import { parseMl } from '@wardrobe/utils';

// The deployed API exposes price/variants.price; unitPrice is only in the
// newer monorepo backend. Keep public catalog requests compatible with both.
export const CATALOG_DOCUMENTS = {
  products: `query MobileProducts($filter: ProductFilterInput!) { products(filter: $filter) { total list { ${PRODUCT_FIELDS} } } }`,
  product: `query MobileProduct($slug: String!) { product(slug: $slug) { ${PRODUCT_FIELDS} } }`,
  bestSellers: `query MobileBestSellers { bestSellers(limit: 6) { ${PRODUCT_FIELDS} } }`,
  quote: 'query MobileQuote($filter: ProductFilterInput!) { products(filter: $filter) { list { price variants { id size color stock price } } } }',
};

/** Display only: mirrors existing server variant pricing from API fields.
 * Checkout still recalculates the payable amount on the server. */
export function catalogDisplayPrice(
  product: Pick<Product, 'price' | 'variants'>,
  size?: string,
  color?: string,
): number {
  const variant = size || color
    ? product.variants.find((value) => value.size === (size ?? '') && value.color === (color ?? ''))
    : undefined;
  if (variant?.price != null && Number(variant.price) > 0) return Number(variant.price);
  const volume = parseMl(variant?.size ?? size);
  const volumes = product.variants.map((value) => parseMl(value.size))
    .filter((value): value is number => value !== null);
  const base = volumes.length ? Math.min(...volumes) : null;
  return volume !== null && base !== null
    ? Math.round(Number(product.price) * (volume / base))
    : Number(product.price);
}
