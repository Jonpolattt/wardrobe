export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/** Implement with native secure storage; the transport never persists tokens itself. */
export interface TokenStorage {
  getTokens(): Promise<TokenPair | null>;
  setTokens(tokens: TokenPair, expectedSessionKey?: string): Promise<void>;
  clearTokens(expectedSessionKey?: string): Promise<void>;
  /** Stable through refresh; changes when login/logout replaces the account session. */
  getSessionKey?(): Promise<string>;
}
export type SessionStorage = TokenStorage;

export type ApiErrorCode =
  | 'INVALID_ENDPOINT'
  | 'NETWORK'
  | 'TIMEOUT'
  | 'ABORTED'
  | 'HTTP'
  | 'GRAPHQL'
  | 'INVALID_RESPONSE'
  | 'STORAGE'
  | 'SESSION_CHANGED';

export class ApiClientError extends Error {
  readonly kind: ApiErrorCode;
  readonly code: ApiErrorCode;
  readonly status?: number;
  readonly graphqlCodes: readonly string[];

  constructor(
    code: ApiErrorCode,
    options: { status?: number; graphqlCodes?: readonly string[] } = {},
  ) {
    // Server response bodies, variables, token values and original error causes
    // never become diagnostic messages. Callers localize these stable codes.
    super(ERROR_MESSAGES[code]);
    this.name = 'ApiClientError';
    this.code = code;
    this.kind = code;
    this.status = options.status;
    this.graphqlCodes = options.graphqlCodes ?? [];
  }
}

const ERROR_MESSAGES: Record<ApiErrorCode, string> = {
  INVALID_ENDPOINT: 'The API address is not valid.',
  NETWORK: 'The API could not be reached.',
  TIMEOUT: 'The API request timed out.',
  ABORTED: 'The API request was cancelled.',
  HTTP: 'The API returned an unsuccessful response.',
  GRAPHQL: 'The API rejected the request.',
  INVALID_RESPONSE: 'The API returned an invalid response.',
  STORAGE: 'Secure session storage is unavailable.',
  SESSION_CHANGED: 'The session changed while the request was pending.',
};

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface GraphQLClientOptions {
  endpoint: string;
  storage?: TokenStorage;
  fetch?: FetchLike;
  timeoutMs?: number;
}

export interface GraphQLRequestOptions {
  operationName?: string;
  signal?: AbortSignal;
  /** false for login, registration, password reset and other public requests. */
  auth?: boolean;
  skipRefresh?: boolean;
  /**
   * Mutations are never retried by default. Opt in only for one known guarded
   * mutation when an all-UNAUTHENTICATED, data-null response proves rejection
   * before its body. No network/HTTP/timeout/partial-result retry is possible.
   */
  retryOnUnauthenticated?: boolean;
}

interface GraphQLErrorShape {
  extensions?: { code?: unknown };
}
interface GraphQLResponse<T> {
  data?: T | null;
  errors?: GraphQLErrorShape[];
}

export interface GraphQLClient {
  request<TData, TVariables extends object = Record<string, unknown>>(
    document: string,
    variables?: TVariables,
    options?: GraphQLRequestOptions,
  ): Promise<TData>;
  fetchGraphQL<TData, TVariables extends object = Record<string, unknown>>(
    document: string,
    variables?: TVariables,
    options?: GraphQLRequestOptions,
  ): Promise<TData>;
}

function sameTokens(a: TokenPair | null, b: TokenPair | null): boolean {
  return a?.accessToken === b?.accessToken && a?.refreshToken === b?.refreshToken;
}
function validTokens(value: unknown): value is TokenPair {
  if (!value || typeof value !== 'object') return false;
  const tokens = value as Partial<TokenPair>;
  return typeof tokens.accessToken === 'string' && tokens.accessToken.length > 0
    && typeof tokens.refreshToken === 'string' && tokens.refreshToken.length > 0;
}
function graphQLCodes(errors: GraphQLErrorShape[] | undefined): string[] {
  return (errors ?? []).map((error) => {
    const code = error.extensions?.code;
    return typeof code === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/.test(code)
      ? code : 'UNKNOWN';
  });
}
function isAuthenticationRejection(response: GraphQLResponse<unknown>): boolean {
  return response.data == null && !!response.errors?.length
    && graphQLCodes(response.errors).every((code) => code === 'UNAUTHENTICATED');
}
function isQuery(document: string): boolean {
  // Conservative classification: a mixed document must never auto-retry a
  // selected mutation. Unknown/fragment-first documents need explicit policy.
  const source = document.replace(/"""[\s\S]*?"""|"(?:\\.|[^"\\])*"|#[^\n]*/g, ' ');
  if (/\b(?:mutation|subscription)\b/.test(source)) return false;
  const start = source.trimStart();
  return start.startsWith('{') || /^query\b/.test(start);
}
function unwrap<T>(response: GraphQLResponse<T>): T {
  if (response.errors?.length) {
    throw new ApiClientError('GRAPHQL', { graphqlCodes: graphQLCodes(response.errors) });
  }
  if (response.data == null) throw new ApiClientError('INVALID_RESPONSE');
  return response.data;
}

const REFRESH_DOCUMENT = `mutation WardrobeRefresh($refreshToken: String!) {
  refreshToken(refreshToken: $refreshToken) { accessToken refreshToken }
}`;

export function createGraphQLClient(options: GraphQLClientOptions): GraphQLClient {
  let endpoint: string;
  try {
    const parsed = new URL(options.endpoint);
    if (!['https:', 'http:'].includes(parsed.protocol)
      || parsed.username || parsed.password || parsed.hash || parsed.search) {
      throw new Error();
    }
    endpoint = parsed.toString();
  } catch {
    throw new ApiClientError('INVALID_ENDPOINT');
  }

  const timeoutMs = options.timeoutMs ?? 15_000;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new ApiClientError('INVALID_RESPONSE');
  }
  const fetcher = options.fetch ?? globalThis.fetch?.bind(globalThis);
  if (!fetcher) throw new ApiClientError('NETWORK');
  const storage = options.storage;
  let refreshInFlight: Promise<TokenPair> | null = null;

  async function readTokens(): Promise<TokenPair | null> {
    if (!storage) return null;
    try {
      const tokens = await storage.getTokens();
      if (tokens !== null && !validTokens(tokens)) throw new Error();
      return tokens;
    } catch {
      throw new ApiClientError('STORAGE');
    }
  }

  async function sessionKey(): Promise<string | undefined> {
    try { return await storage?.getSessionKey?.(); }
    catch { throw new ApiClientError('STORAGE'); }
  }
  async function assertSession(expected: string | undefined): Promise<void> {
    if (expected !== undefined && await sessionKey() !== expected) throw new ApiClientError('SESSION_CHANGED');
  }

  async function send<T>(
    document: string,
    variables: object | undefined,
    accessToken: string | undefined,
    requestOptions: GraphQLRequestOptions = {},
  ): Promise<GraphQLResponse<T>> {
    if (requestOptions.signal?.aborted) throw new ApiClientError('ABORTED');
    const controller = new AbortController();
    let timedOut = false;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let externalAbort: (() => void) | undefined;
    const interrupted = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        timedOut = true;
        reject(new ApiClientError('TIMEOUT'));
        controller.abort();
      }, timeoutMs);
      if (requestOptions.signal) {
        externalAbort = () => {
          cancelled = true;
          reject(new ApiClientError('ABORTED'));
          controller.abort();
        };
        requestOptions.signal.addEventListener('abort', externalAbort, { once: true });
      }
    });
    const operation = (async () => {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
      let response: Response;
      try {
        response = await fetcher(endpoint, {
          method: 'POST',
          headers,
          credentials: 'omit',
          signal: controller.signal,
          body: JSON.stringify({
            query: document,
            ...(variables === undefined ? {} : { variables }),
            ...(requestOptions.operationName ? { operationName: requestOptions.operationName } : {}),
          }),
        });
      } catch {
        throw new ApiClientError(timedOut ? 'TIMEOUT' : cancelled ? 'ABORTED' : 'NETWORK');
      }
      if (!response.ok) throw new ApiClientError('HTTP', { status: response.status });
      let json: unknown;
      try {
        json = await response.json();
      } catch {
        throw new ApiClientError(timedOut ? 'TIMEOUT' : cancelled ? 'ABORTED' : 'INVALID_RESPONSE');
      }
      if (!json || typeof json !== 'object' || Array.isArray(json)) {
        throw new ApiClientError('INVALID_RESPONSE');
      }
      const payload = json as GraphQLResponse<T>;
      if (payload.errors !== undefined && (!Array.isArray(payload.errors)
        || payload.errors.some((error) => !error || typeof error !== 'object'))) {
        throw new ApiClientError('INVALID_RESPONSE');
      }
      if (payload.data != null && (typeof payload.data !== 'object' || Array.isArray(payload.data))) {
        throw new ApiClientError('INVALID_RESPONSE');
      }
      if (!('data' in payload) && !payload.errors?.length) {
        throw new ApiClientError('INVALID_RESPONSE');
      }
      return payload;
    })();
    try {
      return await Promise.race([operation, interrupted]);
    } finally {
      if (timer !== undefined) clearTimeout(timer);
      if (externalAbort) requestOptions.signal?.removeEventListener('abort', externalAbort);
    }
  }

  async function recoverTokens(rejectedTokens: TokenPair, expectedSession: string | undefined): Promise<TokenPair> {
    await assertSession(expectedSession);
    const current = await readTokens();
    await assertSession(expectedSession);
    if (!current) throw new ApiClientError('SESSION_CHANGED');
    if (!sameTokens(current, rejectedTokens)) return current;
    if (refreshInFlight) return refreshInFlight;

    refreshInFlight = (async () => {
      const response = await send<{ refreshToken?: unknown }>(
        REFRESH_DOCUMENT,
        { refreshToken: rejectedTokens.refreshToken },
        undefined,
      );
      await assertSession(expectedSession);
      if (isAuthenticationRejection(response)) {
        // Failed refresh must not delete a newly logged-in session. Transient
        // network/server failures never clear tokens.
        const latest = await readTokens();
        await assertSession(expectedSession);
        if (sameTokens(latest, rejectedTokens) && storage) {
          try { await storage.clearTokens(expectedSession); } catch { throw new ApiClientError('STORAGE'); }
        }
        return unwrap(response) as never;
      }
      const data = unwrap(response);
      if (!validTokens(data.refreshToken)) throw new ApiClientError('INVALID_RESPONSE');
      const latest = await readTokens();
      await assertSession(expectedSession);
      if (!latest) throw new ApiClientError('SESSION_CHANGED');
      if (!sameTokens(latest, rejectedTokens)) return latest;
      if (storage) {
        try { await storage.setTokens(data.refreshToken, expectedSession); } catch { throw new ApiClientError('STORAGE'); }
        await assertSession(expectedSession);
      }
      return data.refreshToken;
    })().finally(() => { refreshInFlight = null; });
    return refreshInFlight;
  }

  async function request<TData, TVariables extends object = Record<string, unknown>>(
    document: string,
    variables?: TVariables,
    requestOptions: GraphQLRequestOptions = {},
  ): Promise<TData> {
    const authenticated = requestOptions.auth !== false;
    const expectedSession = authenticated ? await sessionKey() : undefined;
    const tokens = authenticated ? await readTokens() : null;
    await assertSession(expectedSession);
    const response = await send<TData>(
      document, variables, tokens?.accessToken, requestOptions,
    );
    await assertSession(expectedSession);
    const mayRetry = requestOptions.retryOnUnauthenticated ?? isQuery(document);
    if (authenticated && !requestOptions.skipRefresh && mayRetry
      && tokens?.refreshToken && isAuthenticationRejection(response)) {
      const refreshed = await recoverTokens(tokens, expectedSession);
      await assertSession(expectedSession);
      // Exactly one retry, using the same operation/variables after rejected
      // authentication. A second rejection is returned to the caller.
      const retried = await send<TData>(
        document, variables, refreshed.accessToken, requestOptions,
      );
      await assertSession(expectedSession);
      return unwrap(retried);
    }
    return unwrap(response);
  }

  return { request, fetchGraphQL: request };
}

export const createApiClient = createGraphQLClient;
export { CUSTOMER_DOCUMENTS, PRODUCT_FIELDS, ORDER_FIELDS, USER_FIELDS } from './operations';

/** One-off public transport; use a persistent client for token refresh sharing. */
export async function fetchGraphQL<TData, TVariables extends object = Record<string, unknown>>(
  options: GraphQLClientOptions,
  document: string,
  variables?: TVariables,
  requestOptions?: GraphQLRequestOptions,
): Promise<TData> {
  return createGraphQLClient(options).request<TData, TVariables>(
    document, variables, requestOptions,
  );
}
