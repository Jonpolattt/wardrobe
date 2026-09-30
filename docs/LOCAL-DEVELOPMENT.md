# Disposable local API validation

These commands run from `C:/Users/Shokhjahon/Desktop/wardrobe`. They do not select an existing database, load production environment files, launch Telegram bots, send SMS/email, invoke payment callbacks, or deploy anything. Build the shared packages and backend first using the pinned workspace dependencies.

## Read-only preview

```powershell
node scripts/local-server.cjs
node scripts/local-integration.cjs
```

Without `--run`, both scripts only check prerequisites and print the isolation plan. They create no files and start no services. They refuse execution if a real `.env` or `.env.*` file exists at the Wardrobe root, `apps/server`, or `apps/server/prisma`; `.env.example` templates are allowed. Keep deployment secrets outside this disposable workflow.

## Mock inventory checks

```powershell
node --test apps/server/test/order-inventory.test.cjs
```

This requires the compiled backend at `apps/server/dist/src`. It loads only the OrderService class with an in-memory Prisma substitute. It does not instantiate PrismaClient or bootstrap Nest. The six cases verify paid/unpaid/cancel/reactivate transitions, duplicate confirmation, insufficient variant stock, and rollback when aggregate stock is insufficient.

## One-shot integration validation

```powershell
node scripts/local-integration.cjs --run
```

This creates a new random session directory and SQLite file under `.local/dev/<session>/local.db`, prepares the final Prisma schema, adds fake fixtures, binds the API only to `127.0.0.1:15411`, runs checks, then closes the API and Prisma clients. The exit code is nonzero if any check fails. A result report containing test names and status, but no tokens or OTP values, is written to that session directory.

The exact schema preparation is equivalent to:

```text
node <installed Prisma CLI> db push --schema <Wardrobe/apps/server/prisma/schema.prisma> --skip-generate
```

The runner supplies its own `DATABASE_URL` for a file that did not previously exist. It does not use `--force-reset`, `--accept-data-loss`, `migrate`, or the application seed script. Existing migration SQL targets SQLite and includes historical table rebuilds; this disposable check validates the current schema and application behavior without claiming that the full historical migration chain has been tested. Production migration validation remains a separate task.

The integration cases cover:

- Fake user login, refresh, and authenticated profile access.
- Server-computed cart unit price and cart ownership.
- Rejection of a client-supplied order total.
- Server-calculated checkout total, cart clearing, and inventory remaining unchanged until paid.
- Order ownership and private order listings.
- Local admin confirmation, duplicate confirmation, cancellation, and exactly one restock.
- Registration and password reset using codes read privately from this fresh local database.
- Explicit integration credential disabling and zero outbound network attempts.

Admin confirmation is the existing GraphQL order state operation against fake data. No Click/Payme callback endpoint is exercised.

## API for manual local checks

```powershell
node scripts/local-server.cjs --run
```

This leaves the disposable API running until Ctrl+C. The local fixture accounts are `owner@wardrobe.invalid`, `other@wardrobe.invalid`, and `admin@wardrobe.invalid`, with public fixture password `LocalFixtureOnly!123`. These accounts exist only in the new session database. Their fake phone identifiers are `+998900000001`, `+998900000002`, and `+998900000003`.

Use `--port 15412` to choose another unprivileged local port. Start each command in a separate shell process; the runtime deliberately discards its inherited environment.

## Isolation and runtime files

The runner preserves only operating-system executable path variables. It generates new JWT signing secrets in memory and blanks Telegram, SMTP, SMS, and payment credentials. Click and Payme test-mode flags are explicitly false. It runs Nest from the new session directory so auto-generated GraphQL schema and uploaded test files stay there. Nest logging is disabled because the existing no-provider SMS/mail fallbacks log verification codes. The existing product startup sold-count recalculation runs only against the new fixture database.

The JavaScript network guard rejects outbound TCP/fetch targets outside loopback, and HTTP `/payments` routes are blocked before application handlers. Installed Prisma engines are used; engine downloads point to a closed loopback port. These are local development safeguards, not an OS-level network sandbox.

Runtime outputs include SQLite data/journals, `src/schema.gql`, optional fake uploads, temp files, and the integration report. They remain inside the git-ignored `.local` directory for inspection. No cleanup command runs automatically. Stop the process before removing a session folder and verify the resolved target is inside `Wardrobe/.local/dev`.

The API binds to loopback intentionally. Android/iOS emulators and physical devices may require a separately reviewed host-access arrangement; this script does not expose the service on the LAN.

## What this does not validate

Real provider authentication, external SMS/email delivery, Telegram polling, payment callbacks, production volumes, deployment, historical migration replay, device networking, and native push delivery require their own credentials and controlled validation. Passing these local checks does not establish production readiness.