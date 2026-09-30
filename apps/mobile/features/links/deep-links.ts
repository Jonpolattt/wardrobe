/** Navigation-only parsing. IDs select content; they confer no authorization. */
export type RouteParameter = string | string[] | undefined;
export interface PaymentReturnParameters { orderId?: RouteParameter; id?: RouteParameter; }
export type SafeNavigationTarget =
  | '/(tabs)/profile' | '/(tabs)/cart' | '/(tabs)/favorites' | '/(tabs)/shop'
  | '/orders' | '/checkout' | '/profile/edit' | '/support'
  | { pathname: '/orders/[id]'; params: { id: string } }
  | { pathname: '/product/[slug]'; params: { slug: string } }
  | { pathname: '/payment-return'; params: { orderId: string } }
  | { pathname: '/checkout'; params: { items: string } };
const FALLBACK = '/(tabs)/profile';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Repeated query parameters are ambiguous, even when the values match. */
export function singleParameter(value: RouteParameter): string | undefined {
  if (Array.isArray(value)) return value.length === 1 && typeof value[0] === 'string' ? value[0] : undefined;
  return typeof value === 'string' ? value : undefined;
}
export function safeOrderId(value: RouteParameter): string | undefined {
  const id = singleParameter(value);
  return id && id.length === 36 && UUID.test(id) ? id.toLowerCase() : undefined;
}
export function safeProductSlug(value: RouteParameter): string | undefined {
  const slug = singleParameter(value);
  return slug && !/[\u0000-\u0020]/.test(slug) && /^[\p{L}\p{N}][\p{L}\p{N}_-]{0,199}$/u.test(slug) ? slug : undefined;
}
export function paymentOrderId(params: PaymentReturnParameters): string | undefined {
  const hasOrderId = params.orderId !== undefined;
  const hasId = params.id !== undefined;
  const orderId = safeOrderId(params.orderId);
  const id = safeOrderId(params.id);
  if (hasOrderId && hasId) return orderId && id && orderId === id ? orderId : undefined;
  return hasOrderId ? orderId : id;
}
export function paymentReturnPath(params: PaymentReturnParameters): string | undefined {
  const id = paymentOrderId(params);
  return id ? '/payment-return?orderId=' + encodeURIComponent(id) : undefined;
}
function decodedSegment(value: string): string | undefined {
  try { return decodeURIComponent(value); } catch { return undefined; }
}
function queryParameter(query: URLSearchParams, name: string): RouteParameter {
  const values = query.getAll(name);
  return values.length === 0 ? undefined : values.length === 1 ? values[0] : values;
}
function checkoutItems(value: RouteParameter): string | undefined {
  const text = singleParameter(value);
  if (!text || text.length > 3699) return undefined;
  const values = text.split(',');
  if (values.length > 100 || values.some(id => !safeOrderId(id))) return undefined;
  return [...new Set(values.map(id => id.toLowerCase()))].join(',');
}
/** External URLs, unknown routes, path traversal, and auth tokens never become continuations. */
export function safeSignedInDestination(value: RouteParameter): SafeNavigationTarget {
  const input = singleParameter(value);
  if (!input || input.length > 4096 || !input.startsWith('/') || input.startsWith('//')
    || /[\\\u0000-\u0020#]/.test(input)) return FALLBACK;
  const marker = input.indexOf('?');
  const pathname = marker === -1 ? input : input.slice(0, marker);
  const query = new URLSearchParams(marker === -1 ? '' : input.slice(marker + 1));
  const tabs: Record<string, SafeNavigationTarget> = {
    '/profile': '/(tabs)/profile', '/(tabs)/profile': '/(tabs)/profile',
    '/cart': '/(tabs)/cart', '/(tabs)/cart': '/(tabs)/cart',
    '/favorites': '/(tabs)/favorites', '/(tabs)/favorites': '/(tabs)/favorites',
    '/shop': '/(tabs)/shop', '/(tabs)/shop': '/(tabs)/shop',
  };
  if (Object.hasOwn(tabs, pathname)) return tabs[pathname]!;
  if (pathname === '/orders' || pathname === '/profile/edit' || pathname === '/support') return pathname;
  if (pathname === '/checkout') {
    if (!query.has('items')) return '/checkout';
    const items = checkoutItems(queryParameter(query, 'items'));
    return items ? { pathname: '/checkout', params: { items } } : FALLBACK;
  }
  if (pathname === '/payment-return') {
    const orderId = paymentOrderId({ orderId: queryParameter(query, 'orderId'), id: queryParameter(query, 'id') });
    return orderId ? { pathname: '/payment-return', params: { orderId } } : FALLBACK;
  }
  const orderMatch = /^\/orders\/([^/]+)$/.exec(pathname);
  if (orderMatch) {
    const id = safeOrderId(decodedSegment(orderMatch[1]!));
    return id ? { pathname: '/orders/[id]', params: { id } } : FALLBACK;
  }
  const productMatch = /^\/product\/([^/]+)$/.exec(pathname);
  if (productMatch) {
    const slug = safeProductSlug(decodedSegment(productMatch[1]!));
    return slug ? { pathname: '/product/[slug]', params: { slug } } : FALLBACK;
  }
  return FALLBACK;
}
/** Canonical string for the login screen; query fields survive only explicit allowlists. */
export function safeContinuationPath(value: RouteParameter): string {
  const target = safeSignedInDestination(value);
  if (typeof target === 'string') return target;
  if (target.pathname === '/orders/[id]') return '/orders/' + target.params.id;
  if (target.pathname === '/product/[slug]') return '/product/' + encodeURIComponent(target.params.slug);
  if (target.pathname === '/payment-return') return '/payment-return?orderId=' + encodeURIComponent(target.params.orderId);
  return '/checkout?items=' + encodeURIComponent(target.params.items);
}