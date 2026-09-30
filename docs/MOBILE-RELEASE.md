# Mobile release preparation

The native app is one Expo Router / React Native / TypeScript project in `apps/mobile`, supporting Android and iOS. It reuses the existing GraphQL backend and shared public contracts. Web React 18 and mobile React 19 stay in their own package dependency graphs.

## Local configuration

Copy `apps/mobile/.env.example` to a local, ignored environment file only when a reviewed test API is available.

| Variable | Purpose |
| --- | --- |
| `EXPO_PUBLIC_API_URL` | Public GraphQL endpoint; no implicit production fallback |
| `EXPO_PUBLIC_TELEGRAM_BOT_USERNAME` | Optional public payment/support bot username for existing receipt handoff |
| `WARDROBE_APP_VARIANT` | `development`, `preview`, or `production` build identity |
| `WARDROBE_ANDROID_PACKAGE` | Reviewed Android application identifier override |
| `WARDROBE_IOS_BUNDLE_IDENTIFIER` | Reviewed iOS bundle identifier override |
| `WARDROBE_APP_SCHEME` | Reviewed custom deep-link scheme override |
| `WARDROBE_EAS_PROJECT_ID` | Real Expo project UUID after the owner creates/links the project |

Values prefixed `EXPO_PUBLIC_` are compiled into the app and are public. Database credentials, merchant keys, JWT secrets, webhook secrets and bot tokens belong only on the server. Authentication tokens are stored in Expo SecureStore; AsyncStorage stores language/theme preferences only.

A physical phone's `localhost` is the phone, not the development computer. Use a reviewed LAN/test HTTPS endpoint reachable from the device. Production configuration requires HTTPS for every API URL, including loopback. Image URLs reuse the configured API origin for relative uploads.

## Identity and assets

No existing native identifier, Expo owner/project ID, signing credentials, App Store Connect entry, or Play Console application was found in the source. These defaults are explicitly provisional and unregistered:

| Profile | Android / iOS default | Custom scheme |
| --- | --- | --- |
| development | `uz.wardrobestore.app.dev` | `wardrobe-development` |
| preview | `uz.wardrobestore.app.preview` | `wardrobe-preview` |
| production | `uz.wardrobestore.app` | `wardrobe` |

Confirm domain/organization ownership and store availability before fixing production identity. Changing an identifier after store release creates a different application.

The mobile PNGs faithfully convert the existing `apps/web/public/logo.svg`, with its original black tile and serif W:
- `assets/icon.png`: 1024×1024, opaque for iOS.
- `assets/adaptive-icon.png`: 1024×1024 transparent canvas; original mark centered inside Android's safe foreground area.
- `assets/splash.png`: 512×512 original mark; displayed at 112 points on the shared light/dark background.

The existing SVG remains unchanged. Inter and Playfair Display are bundled font assets from the selected 0.4.2 packages; no runtime font download is required.

## Local validation

Run from the monorepo root after the reviewed frozen workspace install and shared-package builds:

```powershell
pnpm --filter @wardrobe/mobile typecheck
pnpm --filter @wardrobe/mobile check:expo
pnpm --filter @wardrobe/mobile build
```

The mobile build script exports Android and iOS JavaScript/assets into `dist/android` and `dist/ios`. A successful export proves bundling, not a signed native build, device behavior, an `.aab`, or an `.ipa`. The root architecture report records the actual validation results.

Expo SDK 57 recommends TypeScript ~6.0.3. The workspace deliberately retains its existing 5.9.3 compiler, and mobile `expo.install.exclude` lists only TypeScript to record this exception. Actual TypeScript checks and Android/iOS exports pass with 5.9.3; no runtime native package is excluded. The initial compatibility failure is retained in the final report. [Expo version-check exclusions](https://docs.expo.dev/versions/latest/config/package-json/)

`expo-system-ui@57.0.4` was added from Expo's bundled SDK version map so Android automatic system appearance is supported. Native React DOM and its types are isolated at 19.2.3; matching Metro, Worklets, Reanimated and Gesture Handler peers are explicitly pinned to avoid resolving the web's React 18 peers. These are compatibility dependencies rather than new product services.

Production config introspection confirms iOS App Transport Security disallows arbitrary/local cleartext loads, with no Face ID or development local-network usage description. SecureStore still uses the platform key store without biometric prompts. Android external-storage permissions are removed in every profile, and production removes the development overlay permission; Internet and vibration remain. SecureStore backup exclusions are present. Actual signed manifests and runtime permissions still need device/build review; no native binary was generated. The local release-permissions plugin is build configuration, not a new application service.

Use a development client for device validation; `expo-dev-client` is installed for the development EAS profile. Physical-device QA must cover both languages, all theme modes, accessibility/font scaling, slow/offline API responses, authentication/session expiry, variants/stock, cart, checkout, orders, and external handoff. Use disposable test data; do not trigger real SMS/payment operations without the applicable approval.

## EAS profiles

`eas.json` pins CLI 24.8.0, pnpm 10.33.4 and Node 22.15.1:
- `development`: internal distribution with a development client.
- `preview`: internal distribution, Android APK.
- `production`: Android AAB; normal iOS archive workflow.

The following are future commands for an authorized account owner; they have not been run:

Before those commands, build shared packages from the repository root. Shared packages export compiled `dist`; `.easignore` excludes secrets/data/caches/application output while including those public compiled package artifacts for dynamic config. The conditional mobile `postinstall` hook rebuilds shared packages in EAS before native prebuild and does nothing on ordinary local installs. It never starts the server, migrates, seeds, or launches bots. Preserve root workspace manifests/lockfile in the archive; npm lockfiles remain on disk but are excluded from the mobile upload. Inspect the archive with the owner before the first authorized cloud upload. [EAS monorepo guidance](https://docs.expo.dev/build-reference/build-with-monorepos/), [EAS ignore rules](https://docs.expo.dev/build-reference/easignore/)

```powershell
Set-Location -LiteralPath 'C:/Users/Shokhjahon/Desktop/wardrobe/apps/mobile'
pnpm dlx eas-cli@24.8.0 login
pnpm dlx eas-cli@24.8.0 project:init
pnpm dlx eas-cli@24.8.0 build --platform android --profile development
pnpm dlx eas-cli@24.8.0 build --platform android --profile production
pnpm dlx eas-cli@24.8.0 build --platform ios --profile production
```

Cloud builds upload application source and require a real Expo project, account authorization and signing choices. iOS production builds require Apple Developer membership and provisioning; Android signing keys must be retained securely. EAS supports building iOS in the cloud from Windows, but account/credential readiness cannot be inferred from local source.

Expected native production artifacts are `.aab` for Android and `.ipa` for iOS. Neither has been generated here. There is no submit profile or automatic publishing command.

The Windows host's read-only inventory found no adb/Java/javac/Gradle on PATH, no default Android SDK directory and no configured Android SDK environment variables. No native SDK/JDK was installed. iOS Xcode compilation requires a Mac or the authorized EAS cloud workflow. Public config/introspection and bundle exports are the locally verified readiness evidence.

## Links, payments and notifications

Expo Router provides custom-scheme paths such as:
- `wardrobe-development://product/<slug>`
- `wardrobe-development://orders/<id>`
- `wardrobe-development://auth/reset-password?token=<one-time-token>`
- `wardrobe-development://payment-return?orderId=<id>`

Production uses the separately verified `wardrobe` scheme. Order pages still enforce the backend's authenticated ownership checks. Reset token URLs are sensitive and must never be logged.

The web's existing `/<locale>/product/<slug>` and reset-password routes remain unchanged. Android App Links / iOS Universal Links for `wardrobestore.uz` require reviewed locale/path mapping, domain ownership, hosted `assetlinks.json` / `apple-app-site-association`, app signing fingerprints and iOS associated-domain configuration. These public production changes have not been applied.

Current mobile checkout exposes only backend-supported cash and manual bank transfer. Telegram receipt handoff opens a public bot username when configured; it does not approve a payment. Payment-return screens refetch backend order state and never mark an order paid from a link parameter.

Push notifications are deferred because the backend has no device push-token lifecycle or delivery integration. Before implementation: agree on provider/project credentials, authenticated token registration/update/removal, logout cleanup, invalid-token cleanup, order-event delivery, and separate marketing consent. No notifications permission, push token registration, provider calls, or new production schema has been introduced.

## Store release checklist

Before a store submission:
1. Verify the permanent app identifiers, owner accounts, signing credentials, version/build numbers and production HTTPS API.
2. Complete physical Android and iOS QA and produce signed native artifacts.
3. Prepare screenshots, app description/category, support URL and privacy policy in the supported store languages.
4. Declare actual data collection, account creation, SMS, purchases, support/contact data and third-party SDK behavior.
5. Resolve account-deletion requirements against the backend before distributing an account-creating app; no unsupported deletion endpoint is invented. Apple requires in-app initiation, and Google Play requires an in-app path plus a discoverable web request resource. This app currently lacks that supported customer backend flow, so it is a store-release blocker. [Apple policy](https://developer.apple.com/support/offering-account-deletion-in-your-app/), [Google Play policy](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en)
6. Explain only permissions the app actually requests. Notifications and associated domains remain absent until their flows are implemented and verified.
7. Check current Play/App Store policies and complete reviewer access/demo-account instructions.
8. Obtain explicit approval before submission or publication. No remote push, deployment, cloud build, or store upload was performed.

Primary references: [Expo monorepos](https://docs.expo.dev/guides/monorepos/), [EAS setup](https://docs.expo.dev/build/setup/), [EAS introduction](https://docs.expo.dev/build/introduction/), [deep links](https://docs.expo.dev/linking/overview/), [SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/). Exact selected versions and runtime evidence are documented in [mobile-foundation.md](analysis/mobile-foundation.md).
