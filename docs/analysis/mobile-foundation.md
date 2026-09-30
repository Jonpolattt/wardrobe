# Mobile foundation analysis

Inspected on 2026-09-30. Scope: the dedicated repository at `C:/Users/Shokhjahon/Desktop/wardrobe/`. This document records source evidence and a proposed dependency baseline. It does not claim that mobile source, an EAS project, native binaries, or store accounts exist. No application or production service was started during this review.

## Existing brand, design, and language evidence

| Evidence | Current behavior | Mobile implication |
| --- | --- | --- |
| `apps/web/src/lib/seo/site.ts` | Public name is **Wardrobe Store**; the source default canonical URL is `https://wardrobestore.uz`. | Reuse the public brand. The source default is not proof of domain ownership or a confirmed production API URL. |
| `apps/web/public/logo.svg` | Serif “W” inside a dark rounded square; fills are `#0a0a0c` and `#f7f5f2`. | Preserve the mark. Native launcher icons need suitable raster assets; the existing SVG is not a complete Android/iOS icon set. |
| `apps/web/tailwind.config.ts` | The historical token named `gold` is now blue: 400 `#61C4FF`, 500 `#465FFF`, 600 `#354DE6`. | Use semantic mobile names such as accent/accentText; retain the actual existing colors. Do not rename existing web class names. |
| Tailwind colors | `ink.950=#07111C`, `ink.900=#111827`, `ink.800=#0D1826`, `ink.700=#101C2A`, `cream=#F8FAFC`. | These plain values can become platform-independent theme tokens after a deliberate extraction. |
| `apps/web/src/app/globals.css` | Light border/header/panel/input: `#e2e8f0/#ffffff/#ffffff/#f1f5f9`; dark: `rgba(148,163,184,.18)/#07111c/#0d1826/#101c2a`. | Native surfaces should preserve these roles. CSS selectors and browser variables stay in web. |
| `apps/web/src/app/[locale]/layout.tsx` | Inter is the UI font with Latin/Cyrillic support; Playfair Display is the brand wordmark font. | Native text needs native-compatible font files or a reviewed font package; Next font loaders and generated WOFF2 assets are not mobile modules. |
| `apps/web/src/i18n/config.ts` | Supported locales are `uz` and `ru`; default is `uz`. | Keep Uzbek fallback and offer Russian. Persist the user's explicit choice separately from device locale. |
| `apps/web/src/i18n/dictionaries/{uz,ru}.json` | Both contain 460 leaf keys with identical key sets; no brace interpolation was found in the inspected Uzbek dictionary. | Plain translations are safe data candidates. Mobile navigation, permissions, offline, and notification copy will need additional mobile keys. |
| `apps/web/src/lib/store/theme-store.ts` | Light/dark Zustand store uses browser persistence and `document.documentElement`. | Share theme values, not this store implementation. Mobile needs its own persistence adapter and native appearance integration. |
| `apps/web/src/lib/utils/format.ts` | Price/date formatting is deterministic and browser-independent; current price output uses `so'm` in both locales. | Preserve behavior when reusing it; any changed Russian currency wording is a separate product decision. |

The repository currently has web and server applications. No `apps/mobile`, Expo app configuration, EAS configuration, existing Android package, iOS bundle identifier, registered app scheme, associated-domain file, or push-token identifier was found by the focused source scan. Existing responsive web components named “Mobile…” remain browser UI.

## Compatible SDK baseline

The current stable Expo release family is SDK 57. Its latest stable package observed in the public registry is **expo 57.0.26**. This is a fresh application baseline, not an upgrade of either existing application. SDK 57 uses React Native 0.86 and React 19.2.3 and requires Node 22.13.x or newer in that line. SDK 57 patch releases include fixes for earlier Hermes regressions. Sources: [Expo SDK matrix](https://docs.expo.dev/versions/latest/), [SDK 57 release notes](https://expo.dev/changelog/sdk-57), [pinned Expo metadata](https://registry.npmjs.org/expo/57.0.26).

The compatibility map inside the published `expo@57.0.26` tarball specifies **React Native 0.86.3** and **React 19.2.3**. Use those exact versions, rather than the registry's unrelated latest React Native 0.87.1.

The local Node **22.15.1** satisfies the inspected critical engine requirements:

| Package/version | Published Node requirement |
| --- | --- |
| `react-native@0.86.3`, `@react-native/dev-middleware@0.86.3` | `^20.19.4 || ^22.13.0 || ^24.3.0 || >=25.0.0` |
| Metro/config/runtime/file-map/resolver/transform-worker **0.84.5** | Same range |
| `glob@13.0.0`, used by Expo tooling | `20 || >=22` |
| `expo-server@57.0.3` | `>=20.16.0` |
| `eas-cli@24.8.0`, if later needed | `^20.18.3 || >=22.0.0` |

Expo 57.0.26 depends on `@expo/metro@56.0.2`, whose Metro packages are exactly 0.84.5. Sources: [React Native metadata](https://registry.npmjs.org/react-native/0.86.3), [Expo Metro metadata](https://registry.npmjs.org/@expo%2fmetro/56.0.2), [Metro engine metadata](https://registry.npmjs.org/metro/0.84.5), [EAS CLI metadata](https://registry.npmjs.org/eas-cli/24.8.0).

This is not a claim that every future resolved transitive dependency has been audited. Before installation, resolve a candidate lock and check all its package engines against the actual Node runtime. Keep the existing Node 20 backend/web Docker configuration unchanged; a future mobile/cloud build uses its own reviewed Node environment.

## Proposed exact direct versions

Use exact manifest pins for the first mobile baseline; the SDK compatibility map's recommended `~` ranges are the source of these version choices. The workspace lock will pin all transitive versions. A later intentional SDK patch update can be reviewed separately.

| Dependency | Proposed exact version | Why |
| --- | --- | --- |
| `expo` | 57.0.26 | SDK and application tooling |
| `react` | 19.2.3 | Required SDK/RN renderer version; scoped to mobile |
| `react-native` | 0.86.3 | SDK-supported native runtime |
| `expo-router` | 57.0.24 | Native navigation and routing |
| `expo-constants` | 57.0.20 | Router and runtime configuration |
| `expo-linking` | 57.0.11 | Router URL handling |
| `expo-status-bar` | 57.0.1 | Native status bar |
| `expo-splash-screen` | 57.0.9 | Controlled initial loading |
| `expo-font` | 57.0.4 | Native typography |
| `react-native-safe-area-context` | 5.7.0 | Insets around notches and system bars |
| `react-native-screens` | 4.26.0 | Router native screens |
| `expo-secure-store` | 57.0.4 | Token storage on device |
| `expo-image` | 57.0.5 | Product image loading and caching |
| `expo-localization` | 57.0.2 | Device language and native locale configuration |
| `@react-native-async-storage/async-storage` | 2.2.0 | Non-secret language/theme preferences |
| `@tanstack/react-query` | 5.101.2 | Existing locked web version; server-data cache |
| `zustand` | 4.5.7 | Existing locked web version; local UI/preferences |
| `react-hook-form` | 7.80.0 | Existing locked web version; native form state |
| `i18next` | 26.4.2 | Translation lookup/fallback |
| `react-i18next` | 17.0.15 | Native React translation integration |
| `typescript` (development) | 5.9.3 | Existing locked workspace compiler version |
| `@types/react` (development) | 19.2.14 | React 19 types isolated from web React 18 types |

The registry peers for the reused Query/RHF/Zustand versions accept React 19; i18next/react-i18next accept TypeScript 5. Source metadata: [Query 5.101.2](https://registry.npmjs.org/@tanstack%2freact-query/5.101.2), [Zustand 4.5.7](https://registry.npmjs.org/zustand/4.5.7), [RHF 7.80.0](https://registry.npmjs.org/react-hook-form/7.80.0), [i18next 26.4.2](https://registry.npmjs.org/i18next/26.4.2), [react-i18next 17.0.15](https://registry.npmjs.org/react-i18next/17.0.15).

The implementation uses the shared pure validation package and typed fetch client, so Zod/resolvers/Axios were not installed. Only install libraries when the authorized implementation or its verified peer graph needs them. Do not add Apollo alongside Query for the same mobile request layer without a concrete requirement; the existing GraphQL API can be called with a small platform-independent fetch transport.

Additional SDK-aligned packages selected after the isolated peer audit (the final selection supersedes the research-only optional classification):

| Package | SDK-compatible exact version | Final decision |
| --- | --- | --- |
| `react-native-gesture-handler` | 2.32.0 | Installed SDK peer to preserve native graph compatibility |
| `react-native-reanimated` | 4.5.1 | Installed SDK peer; skeleton animation itself uses core Animated |
| `react-native-worklets` | 0.10.1 | Installed compatible Reanimated peer |
| `expo-notifications` | 57.0.21 | Push design, device testing, and credentials are ready |
| `expo-device` | 57.0.2 | Device-specific notification setup |
| `expo-dev-client` | 57.0.19 | Installed for the development-client EAS profile |
| `@expo-google-fonts/inter` | 0.4.2 | Installed bundled brand font assets |
| `@expo-google-fonts/playfair-display` | 0.4.2 | Installed bundled wordmark font assets |
| `react-dom` | 19.2.3 | Installed explicit mobile peer; prevents Router resolving web React DOM 18 through shared hoisting |
| `@types/react-dom` (development) | 19.2.3 | Isolated matching renderer types |
| `@react-native/metro-config` (development) | 0.86.3 | Matching React Native Metro peer/configuration |
| `react-native-web` | 0.21.0 | Mobile-web target is explicitly required |

Expo Router 57.0.24 marks React DOM, React Native Web, Reanimated, Gesture Handler, React Server DOM Webpack, and the testing-library peer as optional. Some are optional in Router metadata, but the final isolated workspace peer audit required explicit compatible pins to avoid inherited incompatible web renderer/native contexts. React Native Web remains absent; no mobile-web platform is configured. Router already brings its required Metro runtime/log-box dependencies; do not promote every transitive package into the mobile manifest. Source: [Router metadata](https://registry.npmjs.org/expo-router/57.0.24), [Router installation](https://docs.expo.dev/router/installation/).

Firebase client/admin libraries are not required to reuse this project's GraphQL backend. Do not add them just to prepare mobile or Expo push. If later introduced, audit their exact graph then: the observed `firebase-admin@14.5.0` requires Node `>=22`, while `@firebase/component@0.7.5` requires `>=20`; that does not establish compatibility for every Firebase transitive package.

## React 18/19 and pnpm isolation

Keep web's current React/React DOM **18.3.1** and React types **18.3.31**. Mobile needs React **19.2.3** and its own React types. Do not add a workspace-wide React override or deduplicate the two applications onto one renderer.

Expo supports pnpm workspaces and isolated dependencies from SDK 54 onward. Current Metro configuration is automatic when using `expo/metro-config`; avoid copying obsolete manual watch-folder or hoist recipes. Only one React Native version and one set of native module versions may enter a native app build. Each app must resolve one React runtime. Source: [Expo monorepo guidance](https://docs.expo.dev/guides/monorepos/).

Before installation and native bundling:

1. Compare both existing web/server importer versions and dependency edges against their accepted baseline.
2. Verify mobile React resolves to 19.2.3 and web React resolves to 18.3.1.
3. Check React-dependent shared packages use compatible peers rather than importing a fixed renderer from the root.
4. Keep shared types, validation, utilities, tokens, and fetch transport free of React/DOM/native runtime dependencies.
5. Audit optional peers that can become visible through shared private hoisting. In particular, mobile Router must not accidentally bundle web's React DOM 18 renderer.
6. Verify Metro's resolved modules and Expo autolinking agree; do not use a global `nodeLinker: hoisted` change as the first response to a resolution problem.

## Proposed commands — not executed by this review

Use the already prepared **pnpm 10.33.4** executable. The bundled pnpm 11 wrapper is not the requested package-manager version. These commands assume a reviewed new manifest named `@wardrobe/mobile` exists and that its dependencies are needed by the implementation.

First create/review the candidate lock, with lifecycle scripts disabled:

```powershell
pnpm --filter @wardrobe/mobile add --save-exact --lockfile-only --ignore-scripts expo@57.0.26 react@19.2.3 react-native@0.86.3 expo-router@57.0.24 expo-constants@57.0.20 expo-linking@57.0.11 expo-status-bar@57.0.1 expo-splash-screen@57.0.9 expo-font@57.0.4 react-native-safe-area-context@5.7.0 react-native-screens@4.26.0 expo-secure-store@57.0.4 expo-image@57.0.5 expo-localization@57.0.2 @react-native-async-storage/async-storage@2.2.0 @tanstack/react-query@5.101.2 zustand@4.5.7 react-hook-form@7.80.0 i18next@26.4.2 react-i18next@17.0.15 expo-dev-client@57.0.19 @expo-google-fonts/inter@0.4.2 @expo-google-fonts/playfair-display@0.4.2 react-dom@19.2.3 react-native-worklets@0.10.1 react-native-reanimated@4.5.1 react-native-gesture-handler@2.32.0
pnpm --filter @wardrobe/mobile add --save-dev --save-exact --lockfile-only --ignore-scripts typescript@5.9.3 @types/react@19.2.14 @types/react-dom@19.2.3 @react-native/metro-config@0.86.3
```

Expected changes: new mobile manifest, workspace lockfile, and no existing application manifest changes. Candidate preparation can add new mobile transitive packages and peer contexts, so inspect the lock before installation. Any changed existing application resolution, unmet engine, or unresolved React peer is a reason to investigate rather than upgrade/force existing packages.

After the lock passes those checks:

```powershell
pnpm install --frozen-lockfile --ignore-scripts
pnpm --filter @wardrobe/mobile exec tsc --noEmit
pnpm --filter @wardrobe/mobile exec expo install --check
```

Expected installation changes are generated `node_modules`/pnpm links and metadata. A frozen install must leave the accepted lock unchanged. Expo's check is a validation step, not `--fix`. Any lifecycle/native generation step needs a separately reviewed necessity; backend postinstall must not run accidentally.

The exact executable prefix and final consumed dependency subset should be shown to the user before the real installation. This document is a proposed baseline, not evidence that any listed command has run.

## Storage, environment, and backend reuse

Mobile public configuration should contain only reviewed public API/upload URLs and non-secret app metadata. A physical device cannot reach the development computer through that computer's `localhost`; Android emulators and local devices need documented development URLs. Do not silently default mobile traffic to the source's production website.

Store tokens with SecureStore and clear them on logout/revocation; keep language/theme preferences in non-secret storage. SecureStore uses Android Keystore-backed storage and iOS Keychain; iOS uninstall/reinstall persistence is not guaranteed, so server-side token validity remains authoritative. Source: [SecureStore documentation](https://docs.expo.dev/versions/latest/sdk/securestore/).

Reuse the existing backend API. Browser cookies, DOM/localStorage helpers, Next rewrites, and browser-only authentication stores need platform adapters, not direct mobile imports. Payment secrets, merchant credentials, bot tokens, database credentials, and webhook secrets remain server-only.

Localization should recognize device `uz/ru`, fall back to Uzbek for unsupported locales, and honor the user's saved choice. Declare supported locales through the native localization plugin when generating native configuration. Source: [Expo localization](https://docs.expo.dev/guides/localization/).

## App identity, linking, notifications, and cloud readiness

No registered application identity was found. A local placeholder such as `com.example.wardrobe` or a development scheme may be used for a scaffold, but it must be labeled provisional and never treated as an approved store identity. A production reverse-domain identifier based on `wardrobestore.uz` requires confirmation of ownership and existing store registrations before a signed/public build. Do not invent Expo owner, EAS project ID, Apple team ID, Android signing key, or Firebase project credentials.

A custom development scheme can support local navigation. Production Android App Links and iOS Universal Links require controlled-domain association files plus final application identifiers. Do not publish association files or payment redirects from this analysis. Source: [Expo linking overview](https://docs.expo.dev/linking/overview/).

Push readiness requires a backend device-token registration/revocation contract, user consent behavior, physical-device testing, and provider credentials. Installing a notifications package alone does not make delivery operational.

EAS can build Android/iOS binaries in cloud environments. Actual readiness cannot be inferred from these files: it needs a real Expo account/project, final identity, credentials, and the required store memberships for distribution. Windows does not provide a local iOS/Xcode build environment. A reviewed `eas.json` may become configuration-ready without claiming that signed Android/iOS builds passed. Sources: [EAS Build](https://docs.expo.dev/build/introduction/), [build setup and signing](https://docs.expo.dev/build/setup/).

Do not log in, upload source, create cloud projects, generate external signing credentials, build in EAS, submit, or deploy as part of this read-only foundation review.

## Acceptance evidence required later

A stable mobile foundation needs a reviewed frozen lock, unchanged existing web/server versions, safe type checks, Android/iOS JavaScript bundle validation, verified native module resolution, confirmed environment separation, and documented failures. Device and signed-cloud-build results remain separate evidence; they must be reported as pending until actually performed.

## Implemented foundation

The native foundation now loads bundled Inter/Playfair fonts, supplies shared light/dark/system tokens, persists Uzbek/Russian and theme preferences, hydrates SecureStore-backed auth, provides query foreground focus, and defines five localized tabs plus native stack routes. It uses only `EXPO_PUBLIC_API_URL` and optional `EXPO_PUBLIC_TELEGRAM_BOT_USERNAME` as public runtime configuration. EAS identities remain provisional and supplied project UUID/scheme syntax are validated. Release/account/native-artifact limits are recorded in [MOBILE-RELEASE.md](../MOBILE-RELEASE.md); push and Telegram designs are separate documents.
