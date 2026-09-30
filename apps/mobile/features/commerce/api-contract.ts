import { PRODUCT_FIELDS } from '@wardrobe/api-client';
import type { CartItem } from '@wardrobe/types';
import { catalogDisplayPrice } from '../catalog/api-contract';

// The deployed API has no Product.unitPrice or CartItem.unitPrice field.
// Keep mutation payloads unchanged and derive only the cart's display price.
export const COMMERCE_DOCUMENTS = {
  wishlist: `query MobileWishlist { myWishlist { id productId product { ${PRODUCT_FIELDS} } } }`,
  cart: `query MobileCart { myCart { id productId size color quantity product { ${PRODUCT_FIELDS} } } }`,
  addCart: 'mutation MobileAddCart($input: AddToCartInput!) { addToCart(input: $input) { id productId size color quantity } }',
  updateCart: 'mutation MobileUpdateCart($input: UpdateCartItemInput!) { updateCartItem(input: $input) { id quantity } }',
};

export type CartResponseItem = Omit<CartItem, 'unitPrice'>;

export function cartDisplayItem(item: CartResponseItem): CartItem {
  return {
    ...item,
    unitPrice: item.product
      ? catalogDisplayPrice(item.product, item.size ?? undefined, item.color ?? undefined)
      : 0,
  };
}
