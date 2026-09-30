/** Framework-free values used by API contracts and application adapters. */
export enum Role {
  ADMIN = 'ADMIN',
  USER = 'USER',
}

export type RoleValue = `${Role}`;

export enum OrderStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}

export enum PaymentMethod {
  CLICK = 'CLICK',
  PAYME = 'PAYME',
  CASH = 'CASH',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  FAILED = 'FAILED',
}

export type Locale = 'uz' | 'ru';
export type Theme = 'light' | 'dark';

/** Allows the backend's existing Decimal-like value without importing Prisma. */
export type PriceValue = number | { toString(): string };

export interface PricedVariant {
  size: string;
  color: string;
  price?: number | null;
}

/** Public display shape; API prices are numbers. */
export interface PricedProduct {
  price: number;
  sizes?: string[] | null;
  variants?: PricedVariant[] | null;
}

export interface UserSummary {
  id: string;
  email: string;
  firstName: string;
  lastName?: string | null;
  avatar?: string | null;
  phone?: string | null;
  role: RoleValue;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  user: UserSummary;
}
export type { UserProfile, Category, Brand, Gender, ProductVariant, Product, ProductSortValue, ProductFilter, ProductPage, Banner, SiteSettings, CartItem, WishlistItem, OrderItem, Order, CreateOrderInput, PromoPreview, Review } from './commerce';
