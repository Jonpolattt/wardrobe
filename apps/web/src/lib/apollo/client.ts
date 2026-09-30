import { ApolloClient, InMemoryCache, HttpLink, from } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';
import { fromPromise } from '@apollo/client/link/utils';
import { useAuthStore } from '../store/auth-store';

// Relative by default — resolves against whatever host the browser is
// currently on (localhost:3000 or a tunnel URL), and next.config.js
// rewrites that path through to the real backend. NEXT_PUBLIC_GRAPHQL_URL
// can still override this for a genuinely separate-domain deployment.
const GRAPHQL_URL = process.env.NEXT_PUBLIC_GRAPHQL_URL || '/graphql';

const httpLink = new HttpLink({
  uri: GRAPHQL_URL,
});

const authLink = setContext((_, { headers }) => {
  const token = typeof window !== 'undefined' ? useAuthStore.getState().accessToken : null;
  return {
    headers: {
      ...headers,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  };
});

// ROOT-CAUSE FIX: the access token issued at login is short-lived (15
// minutes — see backend config/configuration.ts's jwt.accessExpiresIn),
// and the backend already exposes a working `refreshToken(refreshToken)`
// mutation (auth.resolver.ts -> auth.service.ts's refresh()) that trades
// the long-lived refresh token (7 days) for a brand-new access+refresh
// pair — but nothing on the frontend was ever calling it. useAuthStore
// (auth-store.ts) already persists `refreshToken` to localStorage, so it
// was sitting there unused the whole time. Symptom this caused: a user
// stays "logged in" (the UI never told them otherwise) but 15 minutes
// after their last login, every authenticated action (leaving a review,
// adding to cart, etc.) started failing with an "unauthorized" GraphQL
// error — logging out and back in "fixed" it only because that mints a
// fresh 15-minute access token. Fix: when a GraphQL response comes back
// unauthorized, silently trade the stored refresh token for a new access
// token via a raw fetch (deliberately NOT through this same Apollo Client
// instance, to avoid re-entering this same error-handling link) and
// transparently retry the original request — the user never sees the
// failure at all unless the refresh token itself has also expired (7
// days of inactivity), in which case the session is cleared so the app's
// normal "please log in" state takes over instead of silently pretending
// to still be authenticated.
// Exported so plain REST calls that don't go through this Apollo Client
// instance (e.g. the admin product-image upload endpoint — see
// lib/utils/uploadProductImage.ts) can reuse the exact same refresh+retry
// logic instead of just surfacing the expired-token failure as a generic
// "something went wrong" error.
let refreshPromise: Promise<string | null> | null = null;

export async function refreshAccessToken(): Promise<string | null> {
  const { refreshToken } = useAuthStore.getState();
  if (!refreshToken) return null;

  // Shared in-flight promise: several queries can fail with "unauthorized"
  // at the same moment (e.g. Header's cart + wishlist queries right after
  // the token expires) — without this they'd each kick off their own
  // refresh call, racing to write different token pairs into the store.
  if (!refreshPromise) {
    refreshPromise = fetch(GRAPHQL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `mutation RefreshToken($refreshToken: String!) {
          refreshToken(refreshToken: $refreshToken) {
            accessToken
            refreshToken
            user { id email firstName lastName avatar role }
          }
        }`,
        variables: { refreshToken },
      }),
    })
      .then((res) => res.json())
      .then((json) => {
        const result = json?.data?.refreshToken;
        if (json.errors || !result) throw new Error('refresh failed');
        useAuthStore.getState().setSession({
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          user: result.user,
        });
        return result.accessToken as string;
      })
      .catch(() => {
        // Refresh token itself is invalid/expired — nothing left to try;
        // clear the stale session instead of leaving the UI thinking it's
        // still logged in with tokens that will never work again.
        useAuthStore.getState().clearSession();
        return null;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

function isUnauthorized(err: { extensions?: Record<string, unknown>; message?: string }) {
  // `extensions.code` is the reliable signal when the backend sets it, but
  // this project's GraphQLModule doesn't define a custom `formatError`, so
  // exactly which code an UnauthorizedException surfaces as depends on
  // @nestjs/apollo's own default mapping — checking the message too (every
  // expired/invalid-token path here throws a message containing "session"
  // or NestJS's default "Unauthorized") keeps this working even if that
  // default ever changes.
  return (
    err.extensions?.code === 'UNAUTHENTICATED' ||
    err.extensions?.code === 'UNAUTHORIZED' ||
    /unauthor|invalid session/i.test(err.message ?? '')
  );
}

const errorLink = onError(({ graphQLErrors, networkError, operation, forward }) => {
  if (graphQLErrors) {
    for (const err of graphQLErrors) {
      // eslint-disable-next-line no-console
      console.error('[GraphQL error]:', err.message);
    }

    const authError = graphQLErrors.find(isUnauthorized);
    // Skip the retry dance for the auth mutations themselves — a genuinely
    // wrong password, an already-used reset link, or the refresh token
    // itself being rejected should surface as a normal error, not loop
    // back through a refresh attempt.
    const skipRetry = ['Login', 'Register', 'RefreshToken', 'ResetPassword', 'VerifyEmail'].includes(
      operation.operationName,
    );
    if (authError && !skipRetry) {
      return fromPromise(
        refreshAccessToken().then((newAccessToken) => {
          if (!newAccessToken) return;
          operation.setContext(({ headers = {} }: { headers?: Record<string, string> }) => ({
            headers: { ...headers, authorization: `Bearer ${newAccessToken}` },
          }));
        }),
      ).flatMap(() => forward(operation));
    }
  }
  if (networkError) {
    // eslint-disable-next-line no-console
    console.error('[Network error]:', networkError);
  }
});

export function createApolloClient() {
  return new ApolloClient({
    link: from([errorLink, authLink, httpLink]),
    cache: new InMemoryCache({
      typePolicies: {
        Query: {
          fields: {
            products: {
              keyArgs: ['filter', ['categorySlug', 'brandSlug', 'search', 'sort']],
            },
          },
        },
      },
    }),
  });
}
