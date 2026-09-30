# Wardrobe

One pnpm 10.33.4 / Turborepo repository for the existing Next.js storefront, NestJS GraphQL backend and Expo Android/iOS customer app. The server owns the existing Prisma SQLite database, commerce rules, uploads and Telegram/payment/support integrations. Web and native UI remain separate.

## Workspace

```
apps/web          Existing Next.js storefront and admin UI
apps/server       Existing NestJS server, Prisma, Telegram and payment modules
apps/mobile       Expo Router, React Native, TypeScript customer UI
packages/types    Platform-neutral public types and existing enums
packages/api-client  Fetch GraphQL transport and customer operation documents
packages/validation  Pure form and phone validation
packages/theme    Brand colors, spacing, radius and native theme tokens
packages/utils    Existing price parsing, currency and date formatting
packages/config   Public brand/locales and safe endpoint/image resolution
deploy/           Docker review templates, not deployed configuration
docs/             Architecture, local testing, security and release instructions
scripts/          Pinned pnpm wrapper and isolated validation/integration tools
```

Use Node 22.15.1 for the validated baseline. Node 22.13+ in the 22 line and compatible 24.3+ meet native engine requirements; changing the validated runtime needs another full check. Existing web/server package versions and both npm lockfiles have been preserved. React 18 for web and React 19 for native are intentionally isolated by pnpm; do not force a single React version.

## Safe validation

From the repository root with pnpm 10.33.4 available:

```
pnpm install --frozen-lockfile --ignore-scripts
pnpm validate
pnpm test:integration
```

Validation refuses real application env files, builds shared packages first, generates Prisma without opening a database, checks types/tests/builds/configs and exports native JavaScript. The integration command creates a new ignored disposable SQLite database and fake fixtures, binds a guarded local server to loopback, clears real service credentials and rejects external network calls. It never runs migrations or seeds production data. See [local development](docs/LOCAL-DEVELOPMENT.md) before intentionally starting any app. `pnpm local:plan` is a non-running preflight.

On this computer an ignored local pinned CLI is available at `.tooling/pnpm/bin/pnpm.cjs`. If global pnpm differs, set `WARDROBE_PNPM_CLI` to its absolute path and use `node scripts/pnpm.cjs <command>`. Nothing repairs or upgrades the global installation automatically.

## Configuration and release

Copy only placeholder examples when preparing a developer-controlled environment; never copy production env files into frontend/native code. Mobile requires an explicit reviewed `EXPO_PUBLIC_API_URL`, with HTTPS for release. An empty endpoint produces a styled configuration error; there is no silent production fallback.

Read [environment boundaries](docs/ENVIRONMENT.md), [security review](docs/SECURITY-REVIEW.md), [Docker deployment preparation](docs/DEPLOYMENT-MONOREPO.md), [CI](docs/CI.md), [mobile release](docs/MOBILE-RELEASE.md), [deep links](docs/DEEP-LINKS.md), [push design](docs/PUSH-NOTIFICATIONS.md) and [Telegram architecture](docs/TELEGRAM-ARCHITECTURE.md). Automated Click/Payme activation, account deletion, push sending and universal/app-link domain association require additional reviewed work. Native exports are not signed store binaries or proof of device acceptance.

No remote push, production deployment, production data move, production migration, live bot startup, actual payment or store submission was performed. Original project folders and the home-directory Git repository remain protected.
