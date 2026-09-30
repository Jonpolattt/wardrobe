// Development diagnostics contain contract metadata only, never auth inputs,
// response values, tokens, OTPs, or raw server error bodies.
type Trace = Record<string, unknown>;
const listeners = new Set<() => void>();
let snapshot: readonly Trace[] = [];
export const API_DIAGNOSTIC_VERSION = 'catalog-v2';
export const readApiTrace = () => snapshot;
export const subscribeApiTrace = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
export function recordApiTrace(event: Trace) {
  if (!__DEV__) return;
  snapshot = [...snapshot.slice(-14), event];
  console.info('[Wardrobe API]', JSON.stringify(event));
  listeners.forEach((listener) => listener());
}
export function publicEndpoint(value: string | undefined): string {
  if (!value) return 'UNSET';
  try { const url = new URL(value); return `${url.protocol}//${url.host}${url.pathname}`; }
  catch { return 'INVALID_URL'; }
}
export function operationName(document: string): string {
  return /\b(?:query|mutation)\s+(\w+)/.exec(document)?.[1] ?? 'unnamed';
}
export function publicVariables(operation: string, variables?: Record<string, unknown>): unknown {
  if (['MobileProducts', 'MobileQuote'].includes(operation)) return { filter: variables?.filter };
  if (operation === 'MobileProduct') return { slug: variables?.slug };
  return '[redacted]';
}
function describe(value: unknown): unknown {
  if (Array.isArray(value)) return `array(${value.length})`;
  if (value === null) return 'null';
  if (typeof value !== 'object') return typeof value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter(([key]) => /^[A-Za-z_]\w{0,63}$/.test(key))
    .map(([key, child]) => [key, Array.isArray(child) ? `array(${child.length})` : child === null ? 'null' : typeof child]));
}
export async function tracedFetch(endpoint: string, init?: RequestInit): Promise<Response> {
  const request = JSON.parse(String(init?.body ?? '{}')) as { query?: string; variables?: Record<string, unknown> };
  const operation = operationName(request.query ?? '');
  const authorization = new Headers(init?.headers).get('Authorization');
  recordApiTrace({ stage: 'sent', endpoint: publicEndpoint(endpoint), operation, variables: publicVariables(operation, request.variables), authorizationPresent: !!authorization });
  const response = await fetch(endpoint, init);
  try {
    const body = await response.clone().json() as { data?: Record<string, unknown>; errors?: { message?: string; extensions?: { code?: string } }[] };
    const errors = Array.isArray(body?.errors) ? body.errors.map((error) => {
      const value = error.extensions?.code;
      const code = typeof value === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/.test(value) ? value : 'UNKNOWN';
      const field = /^Cannot query field "([A-Za-z_]\w{0,63})" on type "([A-Za-z_]\w{0,63})"/.exec(error.message ?? '');
      return field ? { code, field: field[1], type: field[2] } : { code };
    }) : [];
    const shape = body?.data && typeof body.data === 'object'
      ? Object.fromEntries(Object.entries(body.data).map(([key, value]) => [key, describe(value)])) : null;
    const products = body?.data?.products as { total?: unknown; list?: unknown } | undefined;
    const catalogCount = products && typeof products.total === 'number' && Array.isArray(products.list)
      ? { total: products.total, returned: products.list.length } : undefined;
    recordApiTrace({ stage: 'response', operation, httpStatus: response.status, graphqlErrors: errors, responseShape: shape, catalogCount });
  } catch {
    recordApiTrace({ stage: 'response', operation, httpStatus: response.status, responseShape: 'NOT_JSON' });
  }
  return response;
}
