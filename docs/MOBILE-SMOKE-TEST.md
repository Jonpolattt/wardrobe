# Mobile smoke test matrix

No Android emulator, iOS simulator, or physical device has been observed during this work. The matrix below is a manual validation plan; its device results are pending. Do not infer native behavior from TypeScript checks or JavaScript exports.

## Local automated evidence

The isolated backend integration run reported 13/13 passing checks against a new fake SQLite database. These cover login/refresh, cart pricing/ownership, checkout server totals, order ownership, stock transitions, local OTP flows, and outbound-network isolation. See `docs/LOCAL-DEVELOPMENT.md` for the reproducible command and session report location.

The combined mobile unit command passed 20/20 tests: fourteen storage/auth session tests using controlled substitutes and six pure navigation test groups. Mobile `tsc --noEmit` also passed after the link/auth contracts were wired. These establish parser, mocked session, and compile-time behavior; they do not establish native launch, rendering, keyboard, actual device SecureStore, device networking, or app-store readiness.

## Controlled device setup

1. Use a development build with its provisional development identity and scheme. Install only on a test device. Native identity registrations, signing, and store publishing are separate work.
2. Start `node scripts/local-server.cjs --run` from Wardrobe in a dedicated shell. It creates only a new `.local/dev/<session>` database and binds the API to `127.0.0.1:15411`. Never load production credentials or select an existing database.
3. Configure the mobile development build with the public test API address. It must include `/graphql`, for example `EXPO_PUBLIC_API_URL=http://127.0.0.1:15411/graphql` when the device has reviewed access to that host address. A phone’s localhost normally refers to the phone.
4. Optional USB Android access uses `adb reverse tcp:15411 tcp:15411`, allowing that test device to reach the loopback API without exposing it on the LAN. This manual command was not executed. Remove the mapping after testing with `adb reverse --remove tcp:15411`.
5. For iOS, use a reviewed simulator/test-host connection. Do not change the backend bind address or expose it publicly just to complete this matrix.
6. Use only the public fake fixture accounts documented in `LOCAL-DEVELOPMENT.md`. Read local registration/reset codes privately from the disposable database if needed; do not print or copy OTPs/tokens into reports. Telegram/SMS/email/payment providers stay disabled.
7. The default fixture has one 10ml/clear variant. Cases requiring multiple variants, unavailable products, promos, or images need additional approved fake test fixtures; they must not reuse production data or uploads.

Record platform/build identifier, test date, API session directory, result, and a concise sanitized symptom for each row. Screenshots must exclude credentials, OTPs, reset tokens, addresses, and private account/order details.

## Manual matrix

| Area | Exact check | Expected behavior | Device result |
| --- | --- | --- | --- |
| Cold launch | Close the app process and open the installed development build. Repeat while offline. | Splash ends; navigation appears; failure has a localized retry path and does not expose diagnostics or tokens. | Pending |
| Home/catalog | Open Home, banners, categories, and Shop using fake data; open a product from a card. | Correct product/category destination; loading, empty, error, and missing-image states are usable. | Pending |
| Search | Search a fake product title; clear search; search a nonexistent title; interrupt a pending search with another query. | Latest query wins; no stale result replaces it; empty state appears and can be cleared. | Pending |
| Filters/sort | Apply category, brand, gender, color, and price filters; switch sort; clear them. | Displayed chips/inputs match results; page resets appropriately; only supported API values are sent. | Pending; richer fixtures needed |
| Product gallery | Swipe images and switch colors on a fake product with color-specific images. | Gallery index resets to a valid image; missing media has a stable fallback. | Pending; media fixtures needed |
| Size/color/price | Select each fake variant, including zero stock; select quantity at its maximum. | Unavailable combinations are disabled; displayed price comes from the API; quantity stays within the available hint. | Pending; richer fixtures needed |
| Guest actions | Attempt favorite, add to cart, checkout, and an order deep link while signed out. | Login prompt appears. Product/order/payment-return and selected checkout continuation survive login through the internal allowlist. | Pending |
| Login/refresh | Login as fake owner; background and foreground the app; repeat after a test access token expires. | Profile belongs to the same account; refresh does not replace another session or replay an uncertain mutation. | Pending |
| Registration | Request an OTP for a new fake phone; try a wrong code, then the correct local code; register. | Cooldown and errors work; verified account signs in once; no SMS is sent by this fixture environment. | Pending |
| Recovery | Request a phone reset, test wrong/expired code, then a valid local code. Open a fake email-token link through both reset routes. | Server validates codes; malformed/repeated tokens show recovery guidance and never enter an unrelated SMS flow. | Pending |
| Logout | Logout, relaunch, and open Cart/Orders. | Secure session is removed; private query data disappears; login is required. | Pending |
| Account switch race | Delay owner’s cart/profile/order query, logout, login as fake other user, then release the old response. | No owner profile/cart/order reappears in the other account. | Pending |
| Auth navigation race | Delay login/reset response; leave its screen or replace the current account; release response. | Abandoned response cannot sign in or redirect the new screen/session. | Pending |
| Cart/selection | Add quantity two, adjust within stock, remove a row, select a subset, and enter checkout. | Server unit prices and selected totals display; selected item IDs survive guest login; unavailable items block the local submit hint. | Pending |
| Favorites | Add/remove a favorite; switch accounts; open the saved product. | Wishlist belongs to the current session; no duplicate toggle causes silent replay; removed/unavailable product is handled. | Pending |
| Address/promo | Prefill profile address; edit it without checking save; repeat with explicit save. Validate a fake promo, then change phone/selection before its response. | Single profile address is saved only on explicit opt-in; stale promo results are discarded; server decides final discount. | Pending; promo fixture needed |
| Checkout duplicate tap | Tap submit rapidly using fake items. | One in-flight creation; controls lock; final order total comes from the server. | Pending |
| Checkout uncertain response | Interrupt connectivity after submission; return online; open My Orders before attempting another checkout. | No automatic retry or duplicate submit; the screen directs the user to verify existing orders. | Pending |
| Order ownership | As fake other user, open the owner’s order UUID. | Server denies access; no private details render. | Pending |
| Manual payment | Open a pending fake order with empty public payment settings. Repeat using approved fake public card/contact settings. | No hardcoded real card fallback; guidance uses settings; no provider callback or client-paid mutation runs. | Pending |
| Payment return | Open `payment-return?orderId=<fake order>&paid=true&status=PAID`; try repeated/conflicting IDs; test signed-out cold launch. | Forged flags are ignored; actual owner-scoped server status displays; bad IDs are rejected; login retains the valid order ID. | Pending |
| Foreground polling | Leave a pending order open, background the app, then return; leave the detail screen; use local admin confirmation on fake data. | Polling stops while backgrounded/unfocused and after final payment/cancellation; foreground refresh shows server status. | Pending |
| Product/order links | Open public product and owned order scheme links in cold and warm app states; try external `returnTo` and traversal. | Known routes resolve; guest order prompts login; untrusted continuation falls back internally. | Pending |
| Languages | Switch Uzbek/Russian across catalog, auth, checkout, validation, order status, and deep-link error screens; relaunch. | Locale persists; translated text and dates fit the UI; no untranslated error key appears. | Pending |
| Themes/accessibility | Switch light/dark/system; relaunch; change system theme and font scale; test keyboard, safe areas, screen reader, and touch targets. | Preferences persist; readable contrast, keyboard-safe forms, logical labels, and accessible controls. | Pending |
| Offline/retry | Disable network on each query screen and on mutations; restore it and use Retry/refresh. | Loading ends in localized error or usable cached state; retry is explicit for uncertain checkout, and secrets never enter errors. | Pending |

## Reporting and production boundary

Use one flat result row per platform/check. Mark blocked cases with the missing fake fixture or device capability; do not call them passed. Keep Android and iOS outcomes separate.

Website Universal/App Links remain pending until native identifiers, certificates, associated-domain files, and route mappings are approved and verified. See `DEEP-LINKS.md`. This matrix does not authorize production requests, real SMS/email, Telegram polling, payment callbacks, migrations, signing-key export, or deployment.