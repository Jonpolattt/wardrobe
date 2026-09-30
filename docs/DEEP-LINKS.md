# Mobile deep links

The Expo Router application has local routes and a custom scheme configuration. The native application IDs remain provisional, and website domain associations have not been configured or deployed. Passing local tests does not establish that a physical device opens these links.

## Current custom scheme routes

The default development scheme is `wardrobe-development`; preview uses `wardrobe-preview` and production uses `wardrobe`. `WARDROBE_APP_SCHEME` can override the scheme in `apps/mobile/app.config.ts`. Choose and register final native identities before production builds.

Examples below use a fake order UUID:

| Intent | Development link |
| --- | --- |
| Home | `wardrobe-development://` |
| Shop | `wardrobe-development://shop` |
| Categories | `wardrobe-development://categories` |
| Product | `wardrobe-development://product/local-test-perfume` |
| Cart | `wardrobe-development://cart` |
| Favorites | `wardrobe-development://favorites` |
| Checkout selection | `wardrobe-development://checkout?items=20000000-0000-4000-8000-000000000001` |
| Orders | `wardrobe-development://orders` |
| Order detail | `wardrobe-development://orders/20000000-0000-4000-8000-000000000001` |
| Payment return | `wardrobe-development://payment-return?orderId=20000000-0000-4000-8000-000000000001` |
| Email password reset | `wardrobe-development://auth/reset-password?token=<64-character-hex-token>` |
| Existing reset path alias | `wardrobe-development://reset-password?token=<64-character-hex-token>` |

The reset placeholder is not a usable credential. Real reset tokens must never be copied into committed files, diagnostics, screenshots, or command history.

Adding or changing a custom scheme requires a new development/native build. Expo Go has a different URL format and does not establish custom-scheme registration. Expo Router handles matching incoming routes automatically. [Expo linking guide](https://docs.expo.dev/linking/into-your-app/)

## Input and continuation rules

`features/links/deep-links.ts` is framework-free navigation parsing; it performs no API calls or storage writes.

- Payment return accepts one UUID in `orderId`, or the compatibility alias `id`. Both may be present only if they identify the same order. Repeated or malformed values are rejected.
- Fields such as `paid`, `status`, `amount`, `token`, and `transactionId` never influence payment state or reach a payment mutation.
- The authenticated owner-scoped `order` query supplies the actual payment state. It refreshes on foreground focus and polls only while a visible order is awaiting confirmation.
- Guest users continue through login with a canonical internal destination. Payment return keeps its validated order ID; checkout keeps only a bounded list of UUID cart item IDs. The backend still verifies ownership and computes prices.
- Login continuations allow known customer routes and bounded product slugs. External URLs, protocol-relative URLs, traversal, unknown routes, fragments, repeated parameters, and authentication-token routes fall back to the profile.
- Email reset accepts one 64-character hexadecimal token, matching the existing backend generator. Repeated/malformed email link parameters do not fall back to an unrelated stored SMS recovery flow. The server checks expiration and account association when the user submits the new password.
- A deep link never automatically places an order, sends a code, signs into an account, or marks payment complete.

Opening a Telegram receipt link remains the existing manual confirmation flow. Its public username comes from `EXPO_PUBLIC_TELEGRAM_BOT_USERNAME`; safe public `t.me` contact links can come from site settings. No bot token belongs in the mobile application.

## Existing web URL compatibility

The current backend sends email reset links to `<configured web origin>/reset-password?token=...`. Mobile provides both `/auth/reset-password` and a `/reset-password` alias that reuses the same screen and validation. Mail generation has been preserved. Website association remains pending. Before enabling it, map existing web locale prefixes and product paths to their corresponding native routes rather than assuming every production web URL matches mobile.

Expo Router supports incoming URL rewriting through `+native-intent` when routing contracts differ. No provider SDK or rewrite hook was added in this local change. [Expo native intent documentation](https://docs.expo.dev/router/advanced/native-intent/)

## iOS Universal Links prerequisites

For the chosen HTTPS domain and registered application, confirm the Apple team/application identifier and bundle identifier. Add the Associated Domains capability and `applinks:<domain>` entitlement to a reviewed native build. Host `/.well-known/apple-app-site-association` with matching application identifiers and narrowly scoped routes. Apple requires HTTPS with a valid certificate and no redirects; each associated subdomain requires its own entry and association file. [Apple associated domains documentation](https://developer.apple.com/documentation/xcode/supporting-associated-domains)

After these are approved, configure the equivalent Expo `ios.associatedDomains` field, create a fresh signed build, and verify both installed-app and browser fallback behavior. No Apple account, entitlement, website file, or production server was changed by this work.

## Android App Links prerequisites

Confirm the registered package name and the certificate fingerprint for the actual distributed build. Publish `https://<domain>/.well-known/assetlinks.json` with `delegate_permission/common.handle_all_urls`, that package, and its SHA-256 signing-certificate fingerprints. With Play App Signing, use the app signing certificate used on users’ devices rather than assuming the local upload key matches. [Android website association documentation](https://developer.android.com/training/app-links/configure-assetlinks)

Add reviewed HTTPS intent filters with `autoVerify`, exact hosts, and selected paths to the native build/Expo configuration. Verify associations on an installed signed build, including browser fallback when the app is absent. [Expo Android App Links documentation](https://docs.expo.dev/linking/android-app-links/)

No domain ownership, Android signing key, verified intent filter, store registration, or production deployment was changed.

## Local validation

From `apps/mobile`:

```powershell
node --test features/links/tests/deep-links.test.cjs
node node_modules/typescript/bin/tsc --noEmit --pretty false
```

Six pure test groups cover UUID ambiguity, payment parameter stripping, known internal destinations, bounded/decoded product slugs, checkout selections, and malicious continuations. Tests use the already installed TypeScript compiler and make no network/database calls.

On an already installed development build, this optional Android device command opens only the public fake product link:

```powershell
adb shell am start -W -a android.intent.action.VIEW -d "wardrobe-development://product/local-test-perfume"
```

It is a manual test command, not executed by this work. The fixture product exists only while the disposable local API is running and the device has a separately reviewed API address. Device testing must also cover cold/warm launches, logged-out continuation, another user’s order, unavailable products, invalid IDs, expired reset credentials, and payment-return links carrying forged status flags.