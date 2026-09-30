# Telegram architecture review

Decision: keep the existing Telegram, payment, support and stock functionality inside `apps/server`. Do not create `apps/telegram` or a second polling process in this migration.

## Existing components

| Component | Source | Runtime and responsibility |
| --- | --- | --- |
| Payment/receipt bot | `src/modules/telegram/telegram.service.ts` | Telegraf polling; accepts order deep links/language selection and receipt photos; forwards receipts to admin; delegates payment decisions to OrderService |
| Support sender | Same TelegramService | Separate optional Telegraf client used only for outgoing contact messages; no polling |
| Error sender | Same TelegramService | Separate optional outgoing client with its own optional chat; no polling; falls back to the main bot |
| Seller/stock bot | `src/modules/stock-bot/stock-bot.service.ts` | Separate Telegraf polling token; store-code account binding, product/variant selection, stock deduction and audit history |
| Retry helper | `src/common/utils/launch-bot-with-retry.ts` | Starts polling with bounded exponential retry and shutdown timer cancellation |
| Support API | `src/modules/telegram/telegram.resolver.ts` | Existing public `sendContactMessage` mutation forwards support form messages |
| Admin payment path | `src/modules/order/order.resolver.ts` | Admin-only payment/rejection mutations reuse OrderService and Telegram buyer notification |

All source paths above are relative to `apps/server`. `AppModule` imports both TelegramModule and StockBotModule. TelegramModule and OrderModule use Nest `forwardRef` because OrderService and Telegram notifications are coupled.

No separate seller/admin application was found beyond the stock bot and admin callbacks in the payment bot. Do not infer any deployed bot is unused from its optional configuration.

## Data and communication

The web/mobile applications call the existing GraphQL API. The receipt bot currently calls Prisma and OrderService inside the same Nest process; it does not use a separate HTTP backend. The stock bot calls Prisma directly. This makes moving just their files into another app unsafe.

The database owns persistent Telegram state:
- `Order.telegramChatId` and `telegramLang` identify the buyer conversation.
- `TelegramStoreLink` maps a Telegram user to a Store.
- `Store.accessCode` holds the seller enrollment secret.
- `StockDeduction` stores who changed which stock and by how much.

Stock bot conversation steps live in an in-memory Map keyed by chat ID and are lost on restart; a seller restarts with `/start`. There is no independent local bot database or durable bot-session directory in the current source. Receipt photos are forwarded using Telegram file IDs rather than saved to a new local upload directory. Back up the primary database together with its existing production uploads; do not copy production state into mobile.

## Environment boundaries

Server-only variable names:

```text
TELEGRAM_BOT_TOKEN
TELEGRAM_ADMIN_CHAT_ID
TELEGRAM_BOT_USERNAME
TELEGRAM_SUPPORT_BOT_TOKEN
TELEGRAM_ERROR_BOT_TOKEN
TELEGRAM_ERROR_CHAT_ID
TELEGRAM_STOCK_BOT_TOKEN
```

The stock token must identify a different bot from the main payment token. Web/mobile may receive only the public bot username for a handoff link; never a token. Support sends via its separate bot when configured, falling back to the main bot. Both use the admin chat ID. Error sending can initialize independently of the main token and use a separate error chat ID.

Current initialization returns early if the main payment token is absent, before constructing the optional support sender. A support-only token therefore does not initialize on its own in the existing code. This is an existing configuration coupling to preserve/document until a narrowly reviewed fix is requested.

## Polling and deployment

Exactly one active polling consumer may own each polling bot token. Running two Nest server replicas with the same configured payment/stock tokens is unsafe. Do not start copied local backends with production bot tokens. Do not rely on retry logic to make multiple polling consumers safe.

Polling and a configured webhook are mutually exclusive Telegram update mechanisms. Outgoing-only support/error clients do not consume updates. [Telegram Bot API](https://core.telegram.org/bots/api#getupdates)

The current helper retries `launch()` and cancels its timer during shutdown; services also call `bot.stop()`. Graceful shutdown and single-owner process configuration must be confirmed before a production handover. Never drop pending updates, rotate credentials, switch webhook/polling, or replace live bot processes as part of an unapproved local validation step.

## Existing risks to review separately

These findings do not change payment/stock behavior in this migration:

| Severity | Evidence and implication |
| --- | --- |
| High | Receipt language callback accepts an order UUID and sets its Telegram chat without proving the Telegram account is the order owner. Possession of a leaked deep link can rebind a conversation and expose order information. Use a server-issued, short-lived one-time handoff token in a later compatible migration. |
| High | Stock `prod_` and `var_` callback lookups do not enforce product-to-store and variant-to-product consistency. Final deduction also does not revalidate those relationships/current user binding. Stale or mismatched callbacks need owner-scoped checks. |
| High | Stock deduction performs read/update/aggregate/history writes outside a single transaction and lacks an idempotency key. Concurrent callbacks or order inventory changes can lose updates or duplicate deductions. |
| Medium | Stock sessions are chat-scoped rather than Telegram-user-scoped; access assumptions must be reviewed if the bot is allowed in group chats. Old inline buttons can also outlive the current conversation. |
| Medium | Main-token early return prevents a support-only configuration from working. A future fix should isolate outgoing sender initialization while preserving fallbacks. |
| Medium | Error notifications include exception text/stack fragments. Review redaction and restricted chat access before sending live sensitive errors. |
| Operational | Single-replica polling ownership currently belongs to the API process, limiting horizontal scaling without a controlled bot runtime decision. |

The existing order admin checks, OrderService payment transitions and Telegram buyer messages must stay authoritative. Mobile receipt handoff does not confirm payment; it only opens the existing bot.

## Criteria for a future extraction

Extraction is justified only when independent scaling/deployment or failure isolation outweighs the added service boundary. Before moving:
1. Put stock/order/payment mutation rules behind tested server-owned interfaces, including ownership, idempotency and transaction semantics.
2. Define authenticated, narrowly scoped internal APIs or an approved event interface for bot actions; do not copy Prisma access or commerce calculations into the new app.
3. Decide polling ownership, bot-specific configuration, graceful shutdown and retry behavior.
4. Test bot handlers with mocked Telegram transport and disposable state; cover replayed callbacks, language, receipt approval/rejection and inventory consistency.
5. Prepare a rollback that stops the new poller before restoring the old one. Keep production data and credentials in their approved storage.
6. Obtain explicit approval for the live handover. Stop the old consumer before starting the new consumer; preserve pending updates.

Only then create `apps/telegram`, with server remaining the business owner. Current monorepo builds/local integration use absent tokens or overridden bot lifecycle providers and make no Telegram API calls.
