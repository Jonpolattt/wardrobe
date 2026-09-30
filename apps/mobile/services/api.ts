import { ApiClientError, createGraphQLClient, CUSTOMER_DOCUMENTS as D, type GraphQLClient, type GraphQLRequestOptions } from '@wardrobe/api-client';
import { apiEndpoint, assetUrl } from '@wardrobe/config';
import type { AuthSession, UserProfile, Product, ProductFilter, ProductPage, Category, Brand, Gender, Banner, SiteSettings, CartItem, WishlistItem, Order, CreateOrderInput, PromoPreview, Review } from '@wardrobe/types';
import { tokenStorage } from './secure-session';
export type AuthPayload = AuthSession & { user: UserProfile };
export type RegisterInput = { phone: string; firstName: string; lastName: string; password: string; email?: string; address?: string };
export type ResetInput = { token?: string; identifier?: string; code?: string; newPassword: string };
export type ProfileInput = { firstName?: string; lastName?: string; address?: string };
export const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL;
export const imageUrl = (value: string | null | undefined) => assetUrl(value, configuredApiUrl);
let transport: GraphQLClient | undefined;
function client(): GraphQLClient {
  if (!transport) {
    let endpoint: string;
    try { endpoint = apiEndpoint(configuredApiUrl, !__DEV__); }
    catch { throw new ApiClientError('INVALID_ENDPOINT'); }
    transport = createGraphQLClient({ endpoint, storage: tokenStorage, timeoutMs: 15_000 });
  }
  return transport;
}
async function request<T>(query: string, variables?: object, options?: GraphQLRequestOptions): Promise<T> {
  return client().request<T, object>(query, variables, options);
}
const publicOptions = (signal?: AbortSignal): GraphQLRequestOptions => ({ auth: false, signal });
const guarded = { retryOnUnauthenticated: true };
export const mobileApi = {
  async products(filter: ProductFilter, signal?: AbortSignal) { return (await request<{products: ProductPage}>(D.products, { filter }, publicOptions(signal))).products; },
  async product(slug: string, signal?: AbortSignal) { return (await request<{product: Product}>(D.product, { slug }, publicOptions(signal))).product; },
  async quote(productId: string, size?: string, color?: string, signal?: AbortSignal): Promise<number> {
    const result = await request<{products: {list: {unitPrice: number}[]}}>(D.quote, { filter: { ids: [productId], page: 1, limit: 1 }, size, color }, publicOptions(signal));
    const price = result.products.list[0]?.unitPrice;
    if (price === undefined) throw new ApiClientError('GRAPHQL');
    return price;
  },
  async categories(signal?: AbortSignal) { return (await request<{categories: Category[]}>(D.categories, undefined, publicOptions(signal))).categories; },
  async filters(signal?: AbortSignal) { return request<{categories: Category[]; brands: Brand[]; genders: Gender[]; productColors: string[]}>(D.filters, undefined, publicOptions(signal)); },
  async banners(signal?: AbortSignal) { return (await request<{banners: Banner[]}>(D.banners, undefined, publicOptions(signal))).banners; },
  async siteSettings(signal?: AbortSignal) { return (await request<{siteSettings: SiteSettings}>(D.settings, undefined, publicOptions(signal))).siteSettings; },
  async bestSellers(signal?: AbortSignal) { return (await request<{bestSellers: Product[]}>(D.bestSellers, undefined, publicOptions(signal))).bestSellers; },
  async me(signal?: AbortSignal) { return (await request<{me: UserProfile}>(D.me, undefined, { signal })).me; },
  async login(input: {identifier: string; password: string}) { return (await request<{login: AuthPayload}>(D.login, { input }, publicOptions())).login; },
  async register(input: RegisterInput) { return (await request<{register: AuthPayload}>(D.register, { input }, publicOptions())).register; },
  async sendOtp(phone: string) { return (await request<{sendRegisterOtp: boolean}>(D.sendOtp, { input: {phone} }, publicOptions())).sendRegisterOtp; },
  async verifyOtp(phone: string, code: string) { return (await request<{verifyRegisterOtp: boolean}>(D.verifyOtp, { input: {phone,code} }, publicOptions())).verifyRegisterOtp; },
  async requestReset(identifier: string) { return (await request<{requestPasswordReset: {method: 'PHONE'|'EMAIL'}}>(D.requestReset, { input: {identifier} }, publicOptions())).requestPasswordReset; },
  async resetPassword(input: ResetInput) { return (await request<{resetPassword: AuthPayload}>(D.resetPassword, { input }, publicOptions())).resetPassword; },
  async updateProfile(input: ProfileInput) { return (await request<{updateProfile: UserProfile}>(D.updateProfile, { input }, guarded)).updateProfile; },
  async cart(signal?: AbortSignal) { return (await request<{myCart: CartItem[]}>(D.cart, undefined, { signal })).myCart; },
  async addCart(input: {productId: string; size?: string; color?: string; quantity: number}) { return (await request<{addToCart: Omit<CartItem,'product'>}>(D.addCart, { input }, guarded)).addToCart; },
  async updateCart(input: {id: string; quantity: number}) { return (await request<{updateCartItem: {id: string; quantity: number; unitPrice: number}}>(D.updateCart, { input }, guarded)).updateCartItem; },
  async removeCart(id: string) { return (await request<{removeCartItem: boolean}>(D.removeCart, { id }, guarded)).removeCartItem; },
  async wishlist(signal?: AbortSignal) { return (await request<{myWishlist: WishlistItem[]}>(D.wishlist, undefined, { signal })).myWishlist; },
  async toggleWishlist(productId: string) { return (await request<{toggleWishlist: {added: boolean}}>(D.toggleWishlist, { productId }, guarded)).toggleWishlist; },
  async removeWishlist(id: string) { return (await request<{removeWishlistItem: boolean}>(D.removeWishlist, { id }, guarded)).removeWishlistItem; },
  async createOrder(input: CreateOrderInput) { return (await request<{createOrder: Order}>(D.createOrder, { input }, guarded)).createOrder; },
  async orders(signal?: AbortSignal) { return (await request<{myOrders: Order[]}>(D.orders, undefined, { signal })).myOrders; },
  async order(id: string, signal?: AbortSignal) { return (await request<{order: Order}>(D.order, { id }, { signal })).order; },
  async checkPromo(input: {code: string; phone: string; itemIds?: string[]}) { return (await request<{checkPromoCode: PromoPreview}>(D.promo, { input }, guarded)).checkPromoCode; },
  async reviews(productId: string, signal?: AbortSignal) { return (await request<{reviews: Review[]}>(D.reviews, { productId }, publicOptions(signal))).reviews; },
  async canReview(productId: string, signal?: AbortSignal) { return (await request<{canReviewProduct: boolean}>(D.canReview, { productId }, { signal })).canReviewProduct; },
  async createReview(input: {productId: string; rating: number; comment: string}) { return (await request<{createReview: Review}>(D.createReview, { input }, guarded)).createReview; },
  async contact(input: {name: string; contact: string; message: string}) { return (await request<{sendContactMessage: boolean}>(D.contact, { input }, publicOptions())).sendContactMessage; },
};
