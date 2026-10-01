# Responsive web → mobile comparison

Reference date: 2026-10-01. Comparison completed before mobile edits.
All seven supplied screenshots are canonical visual references; screenshots 1–3 cover Home/Shop/cards, 4 Cart, 5–6 Categories, and 7 Profile.

| Area | Verified web reference | Initial mobile mismatch | Intended native alignment |
|---|---|---|---|
| Header | Header.tsx, HeaderGate.tsx | Native navigation header fixed logo/controls | Logo + segmented UZ/RU + Lucide sun/moon scroll away; profile hides storefront header |
| Search | MobileSearchBar.tsx | Separate Shop field, no sticky global row | Safe-area-aware sticky search + heart badge; submit to existing Shop search |
| Navigation | MobileBottomNav.tsx | Edge-to-edge bar, Favorites tab, drawn/Unicode icons | Home/Shop/Cart/Categories/Profile, floating pill, canonical SVG shapes, native glass fallback and spring capsule |
| Home | page.tsx, BannerCarousel.tsx | Intro/CTA, first banner only, category thumbnails before products | Banner carousel, best sellers, category showcase and remaining product sections |
| Shop | shop/page.tsx | Duplicate search, filter/count mixed, sorting buried | Web title/filter/count/sort hierarchy, 2-column grid gap20 |
| Product cards | components/ui/ProductCard.tsx | Borderless image/title/price | Radius12, 3:4 photo, discount/heart/dots, category/price/title/stock, product-selection CTA |
| Product detail | product/[slug]/page.tsx, ProductGallery, ProductActions | Wrong image ratio and metadata/action order | Gallery/thumbnails, category/brand/title/price, bordered actions, compact quantity/variant controls |
| Categories | categories/page.tsx, CategoryShowcase | Small image tiles | Full-width radius24 showcase cards, centered title, decorative accent shapes |
| Profile | profile/page.tsx | Large action buttons/inline settings | Three divided menu groups, nested preferences and logout confirmation |
| Cart | cart/page.tsx | Independent cards, square controls, unboxed summary | Divided rows, compact pill steppers, separate summary panel |
| Forms/orders/checkout | Existing matching web routes | Inconsistent spacing and hierarchy | Canonical panel/field/row typography; preserve mutations and session/order guards |

Measurements are from responsive implementation: gutter16, grid gap20, product radius12, panel16, showcase24, input/header controls10, buttons5. Inter is UI font; Playfair Display only wordmark. Existing shared web palette is retained.

UI verification must distinguish JS/type/config checks from actual iPhone/Android screenshots. No live mutations, payments, SMS or database changes are permitted by this alignment task. Web direct-buy uses a different checkout entry flow; keep current mobile product-selection/cart flow instead of changing order contracts.

# RESPONSIVE WEB → MOBILE UI/UX ALIGNMENT REPORT

Completed local implementation: 2026-10-01. Device screenshot acceptance remains pending.

## 1. Screens updated

Home, Shop, Product Detail, Categories, Favorites, Cart, Profile, profile details/edit, Orders, Order Detail, Checkout, Login, Registration, SMS verification, Forgot Password and Reset Password. Shared screen containers, buttons, inputs, search, loading/error/empty states and navigation were aligned. Support and fallback screens inherit the shared component styling.

Removed the temporary “API diagnostics · catalog-v2” panel and tracing wrapper. Deleted only its component, service and two obsolete diagnostic tests. The remaining 26 tests are retained and pass.

## 2. Responsive web references

All seven supplied screenshots were inspected before edits. The source comparison above records the original mismatches.

Canonical sources under apps/web/src:

- components/layout/Header.tsx, HeaderGate.tsx, MobileSearchBar.tsx, HeaderSearch.tsx, MobileBottomNav.tsx, LanguageSwitcher.tsx and ThemeToggle.tsx.
- app/[locale]/page.tsx and components/home/BannerCarousel.tsx.
- app/[locale]/shop/page.tsx and components/ui/ProductCard.tsx.
- app/[locale]/product/[slug]/page.tsx and components/product/ProductGallery.tsx, ProductActions.tsx.
- app/[locale]/categories/page.tsx, profile/page.tsx, cart/page.tsx, checkout/page.tsx and orders routes.
- Existing web authentication forms and loading/empty-state conventions.

Web files were inspected but not edited. Native components remain inside apps/mobile; shared theme values remain in packages/theme.

## 3. Header behavior

Storefront screens use the same two-level composition: a 64-point brand/language/theme header and a 60-point search row. Native scroll offset moves the brand header away over its own height, then clamps the search row at the safe-area boundary. ScrollView and FlatList share the scroll mechanism. Initial content padding reserves both rows; bottom padding reserves the floating navigation.

Profile intentionally hides the storefront header/search, matching HeaderGate and screenshot 7. Native stack screens retain their back controls without adding a second safe-area top inset. Actual notch/status-bar and rapid-scroll behavior still needs device acceptance.

## 4. Search + Favorites

Search uses the web input surface, border, radius, icon and focus treatment. The adjacent heart opens Favorites and displays the authenticated user's wishlist count. Favorites is absent from the five navigation items.

Search suggestions follow the web's 200ms debounce, Unicode/apostrophe normalization, prefix matching, first six suggestions and existing 40-item NEWEST preview request. Results include image/title/price, categories, no-results/retry feedback, and six local recent searches. Submitting uses the existing Shop search flow. Dropdown and keyboard reachability require small-device review.

## 5. Bottom navigation

Order: Home → Shop → Cart → Categories → Profile, with existing RU/UZ labels. Categories is a dedicated tab; the old categories route redirects to it.

The rounded floating container has 12-point side gaps, a 12-point gap above the bottom safe area, 64-point height and maximum width 448. Content reserves additional bottom space. Cart retains its session-scoped quantity badge. Navigation remains visible on customer detail/orders/checkout screens and hides during authentication/payment-return and while the keyboard is shown.

Supported iOS devices use native GlassView. Other iOS devices use BlurView; Android uses a translucent surface, border and elevation. Light/dark glass values come from shared theme tokens. The selection capsule glides with a spring; tab presses scale softly and return. Reduced Motion and Reduced Transparency are honored. Native rendering/performance is not established by JS exports alone.

## 6. Home

Aligned the composition to banner carousel, best sellers, category showcase and remaining product/promotional content. Banner is 16:9 with rounded corners, page dots and the web's three-second rotation; reduced-motion/background behavior is respected. Section typography, grid rhythm and trust blocks follow web references. Existing API payload sizes are preserved.

## 7. Shop/Product cards

Restored web title → Filters/Clear → count/sort → two-column grid hierarchy. Grid gap is 20; product image ratio is 3:4 and card radius is 12. Cards include gallery dots, discount badge, top-right heart, category, price/old price, title, stock and compact purchase CTA. Existing favorite handlers, query variables, pagination, variant/stock guards and price helpers remain in use.

Filtering/sorting uses native sheets with web colors, type and spacing. RANDOM is available; the existing mobile NEWEST default is retained. Purchase CTA opens product selection before the existing mobile cart/checkout flow.

## 8. Product Detail

Aligned gallery, thumbnails, metadata order, pricing, discount, variant choices, stock, quantity controls, favorite/primary CTA and description/reviews. Colors use the existing web color naming/swatch mapping. Query, session, variant-selection and action handlers were preserved; no backend pricing/stock logic changed.

## 9. Categories

Dedicated Categories page uses the screenshot's full-width decorative cards: 208-point height, radius 24, centered 30-point title and offset accent circle. Selection navigates to the existing category-filtered Shop route. Home's larger category showcase remains separate, as on web.

## 10. Profile

Rebuilt the three grouped panels from screenshot 7: name/orders/details/favorites; language/theme; authorized admin entry/logout. Rows use canonical icons, separators, typography and chevrons. Language and theme open nested views with back navigation. Logout uses a designed confirmation. The admin entry opens the existing website for authorized users; no new native admin or backend behavior was introduced.

Profile edit retains the immutable phone field, existing editable fields and update payload. Cart rows, orders and checkout presentation follow the web's panels and visual hierarchy without changing their submit/payment handlers.

## 11. Icons

Lucide is canonical. Native Icon.tsx reproduces the existing web Lucide SVG geometry through react-native-svg, with the upstream ISC attribution. Search/heart/home/store/cart/grid/profile/theme/back/close/filter/order and row icons share consistent stroke/optical sizing. No second icon family was introduced.

## 12. Theme

Shared web light/dark palette retained: dark background #07111C, surface #0D1826, input #101C2A, primary #465FFF and dark accent #61C4FF. Inter is the UI font; Playfair Display is reserved for the WARDROBE wordmark. Added shared typography, storefront dimensions, motion and glass values. Web/native component implementations remain separate.

## 13. Language

UZ/RU segmented header controls, localized navigation, profile preference views and feedback follow web conventions. Existing persisted preference and i18n actions are preserved. Labels include Kategoriyalar and Sevimlilar; Russian equivalents are retained. Long labels and font scaling need device review.

## 14. Animations

Spring-based capsule movement and subtle tab/button press scaling use shared motion values. Tabs fade when motion is enabled. Banner motion and skeleton pulse remain restrained; reduced-motion settings disable optional motion. Search focus, pressed states, native stack navigation and native modal transitions retain platform behavior. Browser hover and DOM transitions are represented by native press feedback; they are not pixel-identical animations.

## 15. Remaining visual differences

- Post-change iPhone and Android screenshots have not been captured or compared; native glass, safe areas, small-screen keyboard overlap and long labels need manual acceptance.
- Native stack back controls and filter/sort sheets differ from browser dialogs.
- Mobile quick purchase opens Product Detail to preserve its existing variant/cart flow; web has a different direct-buy entry.
- Mobile retains six best sellers and its NEWEST default; changing API payload/order behavior was outside this UI task.
- Skeletons use the existing native pulse and spinners rather than browser CSS rendering.
- GlassView appearance depends on OS/Expo Go support; blur/translucent fallbacks are intentional.

Expo Go preview is running at exp://192.168.1.19:8081 on the same Wi-Fi. Reload before reviewing this bundle. Do not trigger SMS, payments or new orders for visual acceptance.

## 16. Regression validation

Automated/source checks pass; these results are not claims of fresh device end-to-end execution. The user's last successful device report is the pre-alignment baseline.

| Flow | Automated/source result | Post-change device result |
|---|---|---|
| Products and images/detail | PASS: schema, unchanged queries/adapters, TS/exports | Pending |
| Search | PASS: schema, existing search payload, source review | Pending |
| Categories | PASS: query contract and typed route | Pending |
| Filters | PASS: contract, existing payload and handlers | Pending |
| Login/SMS | PASS: session tests; submit/OTP contracts preserved | Pending; no SMS sent |
| Favorites | PASS: bearer/product/item-ID mock regression tests | Pending; no live mutation |
| Cart | PASS: payload, quantity, bearer and display-price mock tests | Pending; no live mutation |
| Profile | PASS: hydration tests; query/update handlers preserved | Pending |
| Orders/checkout | PASS: contracts, guarded handlers and deep-link tests | Pending; no order/payment created |
| Dark/light theme | PASS: shared-token/source/config validation | Pending |
| RU/UZ | PASS: translations/preferences source validation | Pending |

All 26 remaining mobile tests pass. All 31 used mobile GraphQL documents validate against cached public production introspection with zero errors; this validation sent no requests. Repository boundary scan checked 449 source inventory entries with zero findings. The scanner was executed read-only with missing deleted diagnostic paths filtered in memory and process-local Git safe.directory; its file was not changed.

## 17. Build validation

| Check | Result |
|---|---|
| Shared theme build | PASS |
| Mobile TypeScript | PASS |
| Expo public configuration | PASS: iOS/Android, portrait, typed routes, existing development identifiers |
| Expo installed dependency check | PASS against offline SDK data; Expo notes offline validation is limited |
| Android JS export, final source | PASS: dist/android, Hermes bundle approximately 3.7 MB |
| iOS JS export, final source | PASS: dist/ios, Hermes bundle approximately 3.4 MB |
| Git whitespace check | PASS |

Validation commands (from Wardrobe root):

```powershell
node .tooling/pnpm/bin/pnpm.cjs --filter @wardrobe/theme build
node .tooling/pnpm/bin/pnpm.cjs --filter @wardrobe/mobile typecheck
node .tooling/pnpm/bin/pnpm.cjs --filter @wardrobe/mobile test
$env:EXPO_OFFLINE='1'
$env:EXPO_NO_DOTENV='1'
node .tooling/pnpm/bin/pnpm.cjs --filter @wardrobe/mobile exec expo install --check
node .tooling/pnpm/bin/pnpm.cjs --filter @wardrobe/mobile exec expo config --type public --json
$env:EXPO_PUBLIC_GRAPHQL_URL='https://wardrobestore.uz/graphql'
node .tooling/pnpm/bin/pnpm.cjs --filter @wardrobe/mobile exec expo export --platform android --output-dir dist/android
node .tooling/pnpm/bin/pnpm.cjs --filter @wardrobe/mobile exec expo export --platform ios --output-dir dist/ios
```

Only three exact mobile dependencies were added: expo-blur 57.0.3 for iOS blur fallback, expo-glass-effect 57.0.4 for supported native glass, and react-native-svg 15.15.4 for the web icon geometry. Existing dependency versions and baseline lock entries were preserved. Installation used the frozen lockfile, offline cache and ignored lifecycle scripts. No native binary/store build was performed.

Changed scope: apps/mobile UI/translations and diagnostics removal, packages/theme source, mobile manifest and pnpm-lock.yaml, and this analysis document. apps/web, apps/server, Prisma/schema, database, auth/API contracts, payment/order business logic and production configuration were not changed. Nothing was deployed, pushed or committed.

## Follow-up: Expo Go SVG dependency resolution

The device reported “Unable to resolve module react-native-svg” during visual acceptance. Investigation confirmed that apps/mobile/package.json and the mobile pnpm-lock importer already declared 15.15.4, the workspace junction existed, and Node resolved the installed package. Expo 57.0.26's bundledNativeModules.json recommends exactly 15.15.4. pnpm why reports one direct mobile dependency; the committed baseline lockfile did not previously include it.

Reused the local pnpm 10.33.4 executable and ran:

```powershell
node .tooling/pnpm/bin/pnpm.cjs install --frozen-lockfile --ignore-scripts --offline
node .tooling/pnpm/bin/pnpm.cjs --filter @wardrobe/mobile typecheck
node .tooling/pnpm/bin/pnpm.cjs --filter @wardrobe/mobile exec expo start --go --clear --port 8081 --offline
```

Frozen installation reported “Already up to date”; no further manifest, lockfile or Icon.tsx edits were needed. The existing Wardrobe Metro process was verified by its project path before stopping it. The fresh session loads the existing mobile .env.local, clears Metro's cache and advertises exp://192.168.1.19:8081. One attempted CLI invocation combined --lan and --offline, which Expo rejects; the corrected command above is running successfully.

Validation after restart: TypeScript PASS; local iOS manifest HTTP 200; development bundle HTTP 200 (7,173,012 bytes), SVG native code present, no SVG module-resolution error. The dependency itself was correctly installed; restarting the stale Metro session restored fresh bundle generation. No production request or app action was executed by this bundle check. Evidence is stored in ignored .local/ui-alignment/svg-resolution.json.

The device must reload the fresh bundle before screenshot acceptance; all post-change device flow statuses above remain pending. For this correction, only local dependency/cache state and this report were updated. Backend/schema, icon implementation, dependency versions and application logic were unchanged.
