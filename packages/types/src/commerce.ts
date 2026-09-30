import type { OrderStatus, PaymentMethod, PaymentStatus, UserSummary } from './index';
export interface UserProfile extends UserSummary { address?: string | null; createdAt?: string; }
export interface Category { id: string; slug: string; name: string; nameRu?: string | null; image?: string | null; }
export interface Brand { id: string; slug: string; name: string; }
export interface Gender { id: string; slug: string; name: string; nameRu?: string | null; }
export interface ProductVariant { id: string; size: string; color: string; stock: number; price?: number | null; }
export interface Product {
  id: string; slug: string; title: string; titleRu?: string | null;
  description?: string | null; descriptionRu?: string | null; price: number;
  oldPrice?: number | null; discountPercent?: number | null; stock: number;
  sizes: string[]; colors: string[]; images: string[];
  colorImages: { color: string; images: string[] }[]; variants: ProductVariant[];
  category?: Category | null; brand?: Brand | null; gender?: Gender | null;
  rating: number; reviewsCount: number; isFeatured: boolean; isActive: boolean;
  unitPrice?: number; createdAt: string;
}
export type ProductSortValue = 'NEWEST' | 'PRICE_ASC' | 'PRICE_DESC' | 'MOST_POPULAR' | 'TOP_RATED' | 'RANDOM';
export interface ProductFilter {
  search?: string; ids?: string[]; categorySlug?: string; brandSlug?: string; genderSlug?: string;
  sizes?: string[]; colors?: string[]; minPrice?: number; maxPrice?: number; onlyFeatured?: boolean;
  sort?: ProductSortValue; page?: number; limit?: number;
}
export interface ProductPage { list: Product[]; total: number; }
export interface Banner {
  id: string; image: string; title?: string | null; titleRu?: string | null;
  linkType: string; productId?: string | null; productSlug?: string | null;
  categoryId?: string | null; categorySlug?: string | null;
  products: { id: string; slug: string; title: string; image?: string | null }[];
}
export interface SiteSettings {
  id: string; heroImage?: string | null; contactAddress?: string | null;
  contactPhone?: string | null; contactTelegram?: string | null; contactEmail?: string | null;
  socialTelegram?: string | null; socialInstagram?: string | null;
  paymentCardNumber?: string | null; paymentCardHolder?: string | null;
}
export interface CartItem {
  id: string; productId: string; product?: Product | null;
  size?: string | null; color?: string | null; quantity: number;
  /** Computed by the existing server pricing helper; never submitted by a client. */
  unitPrice: number;
}
export interface WishlistItem { id: string; productId: string; product?: Product | null; }
export interface OrderItem {
  id: string; productId: string; product?: Product | null; title: string;
  price: number; size?: string | null; color?: string | null; quantity: number;
}
export interface Order {
  id: string; orderNumber: string; status: OrderStatus; paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod; totalAmount: number; discountAmount?: number | null;
  promoCode?: string | null; deliveryAddress: string; deliveryCity?: string | null;
  phone: string; note?: string | null; items: OrderItem[]; createdAt: string;
}
export interface CreateOrderInput {
  deliveryAddress: string; deliveryCity?: string; phone: string; note?: string;
  paymentMethod: PaymentMethod; promoCode?: string; itemIds?: string[];
  buyNowProductId?: string; buyNowSize?: string; buyNowColor?: string; buyNowQuantity?: number;
}
export interface PromoPreview { valid: boolean; code?: string | null; message?: string | null; eligibleAmount: number; discount: number; total: number; }
export interface Review { id: string; rating: number; comment: string; image?: string | null; createdAt: string; user?: { firstName: string; lastName?: string | null } | null; }
