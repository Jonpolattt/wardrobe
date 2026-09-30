# Environment boundaries

Root configuration holds pnpm/Turbo/build controls only. Keep real runtime env files outside Git and never share an entire env file across applications. The examples have placeholders only. Root `.gitignore` and `.dockerignore` exclude real env files, databases, uploads, logs, local caches and private signing material while retaining examples and Prisma migrations.

| Boundary | Variable names | Treatment |
|---|---|---|
| Root/tooling | WARDROBE_PNPM_CLI, EAS_BUILD, CI, NEXT_TELEMETRY_DISABLED, TURBO_TELEMETRY_DISABLED | Local/cloud build controls; no product secrets |
| Web public | NEXT_PUBLIC_GRAPHQL_URL, NEXT_PUBLIC_SITE_URL, NEXT_PUBLIC_TELEGRAM_BOT_USERNAME | Public build inputs; browser bundles may disclose them |
| Web legacy public | NEXT_PUBLIC_API_URL, NEXT_PUBLIC_WS_PRESENCE_URL | Examples retained; current images and presence use same-origin routes rather than these stale origins |
| Next server/build | GRAPHQL_INTERNAL_URL | Private network destination only; Next rewrite destination is set during build; never put credentials into the URL |
| Mobile public | EXPO_PUBLIC_API_URL, EXPO_PUBLIC_TELEGRAM_BOT_USERNAME | Embedded in native bundles; API URL must be HTTPS for release and explicitly configured |
| Mobile native build identity | WARDROBE_APP_VARIANT, WARDROBE_ANDROID_PACKAGE, WARDROBE_IOS_BUNDLE_IDENTIFIER, WARDROBE_APP_SCHEME, WARDROBE_EAS_PROJECT_ID | Nonsecret identifiers; provisional until ownership is confirmed |
| Server database/runtime | DATABASE_URL, PORT, CORS_ORIGIN, NODE_ENV | Server only; persistent database path reviewed independently of code relocation |
| Server authentication | JWT_ACCESS_SECRET, JWT_ACCESS_EXPIRES_IN, JWT_REFRESH_SECRET, JWT_REFRESH_EXPIRES_IN | Secrets and token lifetimes stay server-side |
| Server payments | CLICK_SERVICE_ID, CLICK_MERCHANT_ID, CLICK_SECRET_KEY, CLICK_TEST_MODE, PAYME_MERCHANT_ID, PAYME_SECRET_KEY, PAYME_TEST_MODE | Server only; missing secrets/test-mode behavior must be reviewed before provider activation |
| Server email | SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM | Server only; no SMTP credentials in web/native |
| Server SMS | DEVSMS_API_TOKEN, DEVSMS_FROM, SMS_GATEWAY_BASE_URL, SMS_GATEWAY_USERNAME, SMS_GATEWAY_PASSWORD, ESKIZ_EMAIL, ESKIZ_PASSWORD, ESKIZ_FROM, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM | Server only; provider credentials can trigger actual messages |
| Server Telegram | TELEGRAM_BOT_TOKEN, TELEGRAM_ADMIN_CHAT_ID, TELEGRAM_BOT_USERNAME, TELEGRAM_STOCK_BOT_TOKEN, TELEGRAM_SUPPORT_BOT_TOKEN, TELEGRAM_ERROR_BOT_TOKEN, TELEGRAM_ERROR_CHAT_ID | Tokens/chat IDs server only; only a reviewed public username may be duplicated to UI configuration |
| Deployment templates | SERVER_ENV_FILE, SERVER_DATA_DIRECTORY, SERVER_UPLOADS_DIRECTORY | Protected env path and existing data directories, independently reviewed; do not copy data as part of an image build |

Locations: `apps/web/.env.local.example`, `apps/server/.env.example`, `apps/mobile/.env.example`. Future real app env files belong to the relevant app or deployment secret manager. Root `.env` is not required. Turbo passes only explicitly listed public/native build values and the private Next network destination to build tasks; server runtime secrets are not shared-package inputs. No shared package reads secret env variables.

Mobile auth uses SecureStore. Only language/theme preferences use AsyncStorage. Private query data is memory-only and cleared on session replacement/logout; passwords and registration/recovery state are not persisted. Safe validation sanitizes inherited credentials and refuses real env files; the local runtime uses a new isolated working directory and random local JWT secrets. The local API endpoint is loopback-only and cannot be used from a physical phone without a separately reviewed developer network setup.

Release checks must inspect native/Next bundle outputs for unexpected values, use a developer-controlled staging API, and keep Expo/signing credentials in protected account tooling rather than `EXPO_PUBLIC_*` or source. Do not print token/key/env values while diagnosing configuration.
