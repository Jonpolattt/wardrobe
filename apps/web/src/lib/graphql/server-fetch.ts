// Deliberately NOT `NEXT_PUBLIC_GRAPHQL_URL` — this file only ever runs on
// the Next.js server (inside React Server Components), which lives on the
// exact same machine as the NestJS backend. When a Cloudflare quick tunnel
// is in use, NEXT_PUBLIC_GRAPHQL_URL points at the public
// https://xxx.trycloudflare.com address so the *browser* (possibly a phone
// on a different network) can reach the backend — but using that same
// public URL here sent every server-rendered page's data fetch (Home, Shop,
// Categories, Product) on a pointless round trip out to Cloudflare's edge
// network and back down through the tunnel, instead of just calling
// localhost directly. That extra hop was the main cause of "sahifalar
// asta ochilyapti" (pages loading slowly) when navigating between
// sections. GRAPHQL_INTERNAL_URL (no NEXT_PUBLIC_ prefix, so it's never
// sent to the browser) lets server-side fetches always go straight to
// localhost, tunnel or no tunnel.
const GRAPHQL_URL = process.env.GRAPHQL_INTERNAL_URL ?? 'http://localhost:4000/graphql';

/**
 * Server-side GraphQL fetch used inside React Server Components so
 * SEO-critical pages (home, shop, product detail, categories) render
 * with real content on the first response instead of a client-only
 * loading state. Interactive/authenticated data (cart, wishlist, admin)
 * still goes through Apollo Client on the client.
 */
export async function serverFetchGraphQL<T = any>(
  query: string,
  variables?: Record<string, unknown>,
  revalidate = 60,
): Promise<T> {
  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
    next: { revalidate },
  });

  const json = await res.json();
  if (json.errors) {
    // eslint-disable-next-line no-console
    console.error('GraphQL server-fetch error:', json.errors);
    throw new Error(json.errors[0]?.message ?? 'GraphQL error');
  }
  return json.data as T;
}
