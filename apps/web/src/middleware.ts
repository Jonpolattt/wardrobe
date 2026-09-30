import { NextRequest, NextResponse } from 'next/server';
import { locales, defaultLocale } from './i18n/config';
import { isPrivatePath } from './lib/seo/site';

function getLocaleFromPath(pathname: string) {
  return locales.find((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`));
}

// Tizimga kirish talab qiladigan sahifalar (profil, savat, to'lov,
// buyurtmalar, admin, kirish/ro'yxatdan o'tish) qidiruv natijalarida
// UMUMAN chiqmasligi kerak: ular hech kimga foyda bermaydi, saytning
// "sifatli sahifalar" ulushini pasaytiradi va ba'zan shaxsiy ma'lumot
// sarlavhalari indeksga tushib qolishi mumkin.
//
// Buning uchun javobga `X-Robots-Tag: noindex` sarlavhasi qo'yiladi —
// Google uchun bu HTML ichidagi <meta name="robots" content="noindex">
// bilan bir xil kuchga ega. Sarlavha usuli tanlandi, chunki bu
// sahifalarning KO'PCHILIGI client component ('use client') va ulardan
// metadata eksport qilib bo'lmaydi; sarlavha esa bittagina joyda,
// hamma yopiq sahifa uchun birdan ishlaydi. Ro'yxatning o'zi
// lib/seo/site.ts dagi PRIVATE_PATH_PREFIXES da — robots.txt va
// sitemap.xml ham AYNAN o'sha ro'yxatdan o'qiydi, shuning uchun uchalasi
// hech qachon bir-biridan farq qilib qolmaydi.
function withRobotsHeader(response: NextResponse, pathname: string) {
  if (isPrivatePath(pathname)) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  }
  return response;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    // GraphQL/upload/uploads/presence are backend endpoints proxied by
    // next.config.js rewrites, not locale-prefixed pages — without this
    // exclusion this middleware redirected e.g. POST /graphql to
    // /ru/graphql (no page there, no matching rewrite either), which
    // 404'd every GraphQL request, breaking login and everything else on
    // the site. /presence hit this exact same bug: it was added to
    // next.config.js's rewrites later but never added here, so every
    // heartbeat/online-count call was redirected to /uz/presence/... or
    // /ru/presence/... — which no rewrite matches — and 404'd.
    pathname.startsWith('/graphql') ||
    pathname.startsWith('/upload') ||
    pathname.startsWith('/presence') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  const existingLocale = getLocaleFromPath(pathname);
  if (existingLocale) return withRobotsHeader(NextResponse.next(), pathname);

  const acceptLanguage = request.headers.get('accept-language') ?? '';
  const preferred = acceptLanguage.toLowerCase().includes('ru') ? 'ru' : defaultLocale;

  const url = request.nextUrl.clone();
  url.pathname = `/${preferred}${pathname === '/' ? '' : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next|api|graphql|upload|presence|.*\\..*).*)'],
};
