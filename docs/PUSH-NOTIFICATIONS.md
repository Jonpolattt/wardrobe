# Push notification design

Status: design only. No push package/plugin, permission request, device-token endpoint, provider call, new Prisma model or migration was introduced.

## Existing evidence

- `apps/server/prisma/schema.prisma` stores users, orders, payments and Telegram links, but has no push-token, device-registration, notification-job or outbox model.
- `OrderService.updateStatus`, `setPaymentStatus` and `rejectPayment` in `apps/server/src/modules/order/order.service.ts` own fulfillment/payment/inventory transitions.
- `TelegramService.notifyPaymentStatus` delivers existing buyer payment messages. This is Telegram infrastructure; it does not provide mobile push delivery.
- Current fulfillment states in `packages/types/src/index.ts` are `PENDING`, `PROCESSING`, `SHIPPED`, `DELIVERED` and `CANCELLED`.
- The mobile app currently has no notification registration or notification-driven routing.

Push must reuse the existing server and primary database. Do not introduce a second backend, Redis/Bull deployment or general device-session system just to deliver order updates.

## Proposed minimal API and record

Use the existing authenticated GraphQL transport. These names are proposals, not currently callable operations:

| Proposed operation | Input | Authorization and behavior |
| --- | --- | --- |
| `registerPushDevice` | installation ID, Expo token, platform, language, transactional preference, marketing preference | Authenticated user; server derives owner ID, validates lengths/platform/token/project environment, upserts the caller's registration |
| `updatePushPreferences` | registration ID and preferences | Authenticated owner only; never accept a target user ID |
| `unregisterPushDevice` | registration ID | Authenticated owner only; idempotent disable/delete |

Keep a small registration record: opaque ID, user relation, installation ID, encrypted/restricted-access token, token hash for uniqueness, platform, project/environment, locale, consent flags, last-seen time, disabled reason, and timestamps. Use a unique installation/project scope and token hash; limit registrations per user and rate-limit writes. Store no contacts, advertising identifier, phone identifier or general browsing history.

A token is a delivery address, not an authentication credential. Do not expose it in public GraphQL types or logs. Re-registration must verify current user ownership and must not silently transfer another active user's registration. On a shared device, explicitly unregister the old account before registering the new one; a conflict must not attach the old account's delivery address to a new owner accidentally.

On token rotation, replace the caller's token and retire the previous token atomically. Refresh registration on authenticated launch and permission changes. Permission denial disables delivery without blocking catalog, orders or login. Keep marketing disabled by default and obtain separate consent; transactional order alerts remain independently controllable.

## Mobile lifecycle and logout

After core features pass device QA:
1. Explain order-alert value in Uzbek/Russian at an appropriate moment; avoid a permission dialog on first anonymous app launch.
2. Request native permission only after the user chooses to enable alerts. Create an Android notification channel first, and handle denied/restricted/provisional iOS states.
3. Obtain the token using the verified EAS project UUID, then register it through the authenticated API.
4. Observe token changes; register replacements. Reconcile consent and permissions on foreground.
5. Before logout, attempt owner-authorized unregister while access/refresh credentials still exist. Always clear local auth and private query cache even if that network request fails.
6. On a tap, accept only a known order-event shape; wait for session hydration, then fetch the order from the backend. Server ownership checks remain authoritative.

Offline logout cannot guarantee immediate server revocation. A short registration lease and generic lock-screen text reduce that exposure but do not provide instant revocation. If immediate eventual cleanup is a requirement, issue a separate high-entropy registration revocation capability, hash it on the server, store it in SecureStore, and queue a narrowly scoped revoke retry after auth is cleared. That capability can only disable its one registration; it cannot read orders or create sessions. Decide this tradeoff before claiming logout privacy guarantees.

## Order events and durable delivery

Emit events only after a committed, real change; repeated admin actions must not create repeated logical events. Cover order creation/processing, shipping, delivery and cancellation based on actual states. Keep payment notifications optional and separate; a push must never be treated as proof of payment.

A direct post-commit HTTP call is simpler but can lose notifications if the process crashes after the order commit. For reliable order alerts, add a small transactional outbox to the same database: insert an event with the order update in one transaction, then let a single bounded worker deliver pending jobs. Also handle the existing direct-update branches of `updateStatus` and payment methods; a resolver-only hook would miss Telegram-initiated changes.

Use a unique event/recipient key, explicit transition revision or event UUID, attempts, next-attempt time, lease expiry and terminal status. Claim jobs transactionally; recover expired leases after crashes. Keep ordering per order or suppress stale transitions. Delivery is at least once, so deduplicate by event ID on the client and tolerate duplicate provider delivery. Never wait for provider success while holding the order database transaction.

A rollout may begin with documented best-effort delivery, but durability must be explicit. No outbox schema is applied in this phase.

## Provider boundary and receipt cleanup

Expo Push Service is a suitable first provider for the Expo app, subject to the owner's credential/data-processing decision. The server sends small, localized messages and stores provider ticket IDs for receipt checks. Retry transient network/429/5xx errors with capped backoff. Disable tokens that return `DeviceNotRegistered`; do not retry malformed payloads or permanent credential failures indefinitely. Alert operators using redacted metadata. A provider ticket or receipt does not prove that a user read a notification. [Expo delivery documentation](https://docs.expo.dev/push-notifications/sending-notifications/)

Keep FCM service-account keys, APNs private keys and an optional Expo push-service access token in approved server/EAS credential storage. The mobile binary contains only its public project identity. A real Expo project and platform credentials are required before delivery can work. [Expo setup documentation](https://docs.expo.dev/push-notifications/push-notifications-setup/)

Use `expo-notifications@57.0.21` only after reviewing the pinned SDK 57 dependency graph again and showing the install command. Remote Android push needs a development build rather than Expo Go; Android 13 needs an opt-in channel/permission flow. No exact-alarm permission is needed for server-driven order alerts. [SDK notifications documentation](https://docs.expo.dev/versions/latest/sdk/notifications/)

Payloads should contain a generic order update and opaque order/event identifiers, avoiding addresses, phone numbers, reset/auth tokens, card data or receipt details. Read full state after authenticated navigation. Maintain separate transactional and marketing channels/preferences.

## Acceptance gates

Before implementation/activation, agree on owner/project, provider, consent copy, retention, logout failure behavior and durable-vs-best-effort delivery. Test ownership rejection, token rotation, account switching, invalid-token cleanup, retry/deduplication, worker restart, denied permissions, both languages and order-link authorization using mocked provider responses and disposable data first. Real credential registration, external test delivery and production schema/deployment require their own reviewed action.
