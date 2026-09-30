# Fashion Marketplace — Frontend

Next.js 14 (App Router) + TypeScript + Tailwind CSS + Framer Motion storefront and admin panel for a premium fashion e-commerce marketplace.

This is a brand-new, independent project. It does not reuse or modify the existing "MyCar" project in any way.

## Stack
- Next.js 14 App Router, TypeScript
- Tailwind CSS (custom premium theme: ink/cream/gold palette)
- Apollo Client for GraphQL (auth, cart, wishlist, orders, admin data)
- React Query for lightweight client-side caching alongside Apollo
- Framer Motion for page/section animations
- react-hook-form for all forms
- recharts for the admin dashboard charts
- zustand for auth session + UI state (persisted to localStorage)
- Home-grown dictionary-based i18n for Uzbek (`uz`, default) and Russian (`ru`) — `/uz/...` and `/ru/...` URL prefixes, auto-detected via `Accept-Language` on first visit

## Getting started

```bash
npm install
cp .env.local.example .env.local
# point NEXT_PUBLIC_GRAPHQL_URL at the backend (default http://localhost:4000/graphql)
npm run dev
```

Visit http://localhost:3000 — you'll be redirected to `/uz` (or `/ru`).

Admin panel: http://localhost:3000/uz/admin (log in with an ADMIN account — see backend `prisma/seed.ts` for a seeded admin login).

## Pages

Home, Shop (with filters: category/size/color/price + sort), Categories, Product Detail, Wishlist,
Cart, Checkout (Cash / Click / Payme), Orders, Profile, Login, Register, Contact, About — all fully
responsive and animated.

Admin: Dashboard (live online-users via WebSocket, revenue, order-status pie chart, best sellers,
low stock, recent orders), Products (create/edit/delete with images/sizes/colors/category/brand/price/
discount/stock), Orders (status management), Categories & Brands.

## Data fetching strategy

SEO-critical pages (home, shop, product detail, categories, about) fetch data server-side (React
Server Components, `fetch` against the GraphQL endpoint) so crawlers and first paint get real content.
Authenticated/interactive data (cart, wishlist, orders, admin) uses Apollo Client on the client.
