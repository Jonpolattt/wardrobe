# Shared package candidates and remaining local architecture work

Read-only inspection baseline: Git root `C:/Users/Shokhjahon/Desktop/wardrobe`, branch `main`, clean working tree at commit `c36059c` (`Step 3 done`). The preceding commit is `311f8af` (`Wardrobe web&server on monorepo`). All findings concern the Wardrobe copies. No original project or home Git repository was accessed or changed during this follow-up.

## Smallest useful extraction

Start with two framework-free packages that can have real consumers in web, server, and mobile:

| Package | Extract now | Existing consumers and mobile use | Boundary |
|---|---|---|---|
| `@wardrobe/types` | Pure Role, OrderStatus, PaymentMethod and PaymentStatus values; small public contract interfaces; Locale/Theme types as needed | Nest enum adapters; web auth/order/checkout types; mobile auth/order/checkout | No Nest decorators, Prisma types, React UI, secrets, or Date objects in wire contracts |
| `@wardrobe/utils` | The identical `parseMl` function; keep other additions tied to actual use | Web variant-price display helper, server order/promo pricing helper, mobile product variant display | No fetch side effects, DOM, storage APIs, or server infrastructure |

Use existing local enum files as adapters: import/re-export the pure enum from the shared package and retain `registerEnumType` inside the server application. That keeps GraphQL enum names and values stable and preserves existing internal imports. Existing web role values are string unions; a shared wire union must accept the existing literal `ADMIN` and `USER` values rather than unexpectedly tightening them to enum-only assignments.

The identical `parseMl` implementation accepts positive whole-number ml labels, optional whitespace, case-insensitive `ml`, and returns null for zero/non-volume input. Extracting exactly this function is a behavior-preserving first step. Keep frontend/backend wrapper exports in their current locations to minimize import changes.

## Pricing logic is similar but not identical

Do not merge the complete web and backend pricing helpers as one function during the initial extraction:

- Web `baseVolumeMl` considers `product.sizes` and variant sizes. Server `baseVolumeMl` considers variant sizes only.
- The web accepts a missing product and returns zero from display helpers. The server requires a product and accepts a numeric value or an object with `toString()` for the database price.
- Web helpers expose findVariant, minimum price and variable-price display helpers that the server does not require.
- Backend order and promo-code services recompute prices from stored products; they must remain authoritative for charge amounts.

For example, a product with sizes 10ml/20ml but only a 20ml variant can produce a different inferred base volume on web and server. This existing distinction needs deliberate behavior tests before any later pricing consolidation. Sharing the pure parser preserves each wrapper's current behavior.

## Other useful candidates

- `@wardrobe/theme`: extract existing raw color tokens from web Tailwind configuration for web and mobile. Keep the ink/cream/gold token names and exact values stable. The backend has no useful theme consumer; do not add one artificially. Font loading, Tailwind classes, CSS animations and React Native styles remain platform-specific.
- `@wardrobe/api-client`: useful for web/mobile query documents, public operation types and a small injectable fetch transport. Do not transplant the browser Apollo client wholesale: it owns localStorage, web authentication redirects, browser upload behavior and error handling. The SSR client also uses a private internal GraphQL URL. Mobile must use a device-reachable public API URL and secure platform token storage.
- Phone validation: backend UZ_PHONE_REGEX is a good pure shape rule for later mobile validation. Its existing normalizePhoneValue intentionally passes non-string input through to validator handling; do not silently change that behavior in an extraction. Web forms work with nine-digit tails plus a fixed +998 prefix, so their UI handling remains separate.
- Formatting/regions: existing deterministic web money/date formatting and Uzbekistan region data can be reused by mobile. Backend Telegram formatting currently differs and should not change merely to create a third consumer.
- No need to create every proposed package name immediately. Avoid an empty config package or adding validation libraries solely to fill the target tree.

## Package runtime strategy

The backend compiles to CommonJS and executes with Node. A shared runtime package must expose a compiled CommonJS-compatible entry and declaration files; pointing Node directly at TypeScript source will not work. Keep the package free of server-only dependencies so Next and Metro can consume it. Existing TypeScript 5.9.3 can build these packages without introducing a new compiler.

Use explicit `workspace:*` dependencies. Turborepo already uses `dependsOn: ["^build"]`, so app builds can wait for shared builds. Local development must also ensure shared output exists or watch the package builds before starting apps. Next may require transpilePackages for workspace TypeScript, depending on the chosen package export model; Metro needs workspace-aware resolution. Verify both instead of assuming a symlink alone is sufficient.

## Proven backend startup mismatch

Observed compiled entry: `apps/server/dist/src/main.js`.

The build tsconfig has no rootDir/include constraint and only excludes prisma/seed.ts. Parsing it through the installed TypeScript compiler confirms that prisma/export-data.ts and prisma/import-data.ts are included alongside src. Their common source root is the server application directory, so src/main.ts emits to dist/src/main.js. Those helpers also emit beneath dist/prisma.

Smallest safe script correction: set start:prod to `node dist/src/main.js`. This follows the already verified build layout without changing compiler inclusion, deleting migration helpers, renaming internal files, or executing the application. Setting rootDir to src would instead require changing the helper inclusion and emitted layout; it is unnecessary for this fix. Existing Compose already contains a dist/src/main.js fallback.

Never run the export/import helper files as a validation command: export connects to a database; import writes rows.

## Docker implications once shared packages are introduced

Current app-local Compose files mount only each app at /app, run npm install at startup, and use application-local environment files. They cannot resolve workspace:* links into packages outside that mount. Backend Compose also automatically runs prisma migrate deploy; it must not be used for local validation or started during this work.

A future workspace-aware container must include the monorepo root package manifest, workspace file, pnpm lock, required package manifests/source/output and app files. Run pnpm 10.33.4 with the frozen workspace lock and build required shared packages before the app. Preserve the server working directory at apps/server because upload paths and GraphQL schema generation are relative to process.cwd().

Keep persisted SQLite/uploads outside image layers and preserve their existing paths or explicitly map them. Separate Linux pnpm store/node_modules from Windows installs. Preserve backend/frontend network aliases and ports when adapting Compose. Do not copy live .env files, private keys or uploads into Docker contexts. Keep migrations as an explicit operator action rather than allowing a new local Compose start to mutate a database automatically.

Legacy app Compose files and production deployment documents require a reviewed adaptation; do not start Docker to discover whether their production paths happen to work.

## Validation boundaries

No application, Telegram bot, Docker container, Prisma migration/seed, production connection or install was performed for this inspection. Source/package configuration edits remain separate reviewable implementation steps. Validate shared parser and enum behavior, then compile packages/server and check web/mobile imports before proceeding to local application execution.