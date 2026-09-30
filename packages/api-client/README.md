# @wardrobe/api-client

Platform-compatible JSON GraphQL transport. No React, browser storage, Node-only runtime imports, environment-file loading or logging.

Create one persistent client per app using `createGraphQLClient({ endpoint, storage, fetch?, timeoutMs? })`, then `client.request<Data, Variables>(document, variables?, options?)`. The endpoint is an explicit HTTP(S) GraphQL URL. Native tokens use an injected async `TokenStorage` adapter, normally Expo SecureStore. Public login/register/reset requests must set `{ auth: false }`.

Stable `ApiClientError.code` / `.kind` values let UI localize failures. HTTP status and sanitized GraphQL extension codes are available; server messages, bodies, request variables and secrets are never included in errors/logs.

Automatic retry is limited to a query whose response has no data and only UNAUTHENTICATED errors. Refresh is shared between concurrent rejected requests, stores the returned token pair, and allows one retry. Transient refresh failures preserve stored tokens. Logout or a new login during refresh cannot resurrect an old session.

Mutations do not retry by default. A single known authentication-guarded mutation may opt into `{ retryOnUnauthenticated: true }`; this only permits retry after a data-null all-UNAUTHENTICATED rejection before the mutation body. No network/timeout/HTTP/partial-response retries occur. Multi-field mutations must never opt in.

`{ skipRefresh: true }`, `{ auth: false }`, request `operationName` and AbortSignal are available. Build emits CommonJS and declarations. Tests use injected mock fetch only and never call a real API.
