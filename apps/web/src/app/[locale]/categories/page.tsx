import Link from 'next/link';
import { getDictionary } from '@/i18n/get-dictionary';
import type { Locale } from '@/i18n/config';
import { serverFetchGraphQL } from '@/lib/graphql/server-fetch';
import { GET_CATEGORIES_STR } from '@/lib/graphql/server-queries';
import { Reveal } from '@/components/ui/Reveal';
import { pageSeo } from '@/lib/seo/site';
import type { Metadata } from 'next';

export async function generateMetadata({ params }: { params: { locale: Locale } }): Promise<Metadata> {
  const dict = await getDictionary(params.locale);
  return pageSeo({
    locale: params.locale,
    path: '/categories',
    title: dict.nav.categories,
    description: dict.home.heroSubtitle,
  });
}

export default async function CategoriesPage({ params }: { params: { locale: Locale } }) {
  const { locale } = params;
  const dict = await getDictionary(locale);

  const data = await serverFetchGraphQL<{ categories: any[] }>(GET_CATEGORIES_STR, undefined, 0).catch(() => ({
    categories: [],
  }));
  const categories = data.categories ?? [];

  return (
    <div className="container-app py-16">
      <Reveal>
        <h1 className="section-title">{dict.nav.categories}</h1>
      </Reveal>

      <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((cat, i) => (
          <Reveal key={cat.id} delay={i * 0.06}>
            <Link
              href={`/${locale}/shop?category=${cat.slug}`}
              className="group relative flex h-52 flex-col items-center justify-center overflow-hidden rounded-3xl bg-ink-950 text-cream shadow-soft"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-ink-950 via-ink-900 to-ink-950 opacity-90 transition-opacity group-hover:opacity-100" />
              {/* blur-2xl removed (heavy-CSS cleanup, per request) — same
                  soft accent circle, just without the filter:blur() cost. */}
              <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-gold-500/10 transition-transform duration-500 group-hover:scale-125" />
              <span className="relative font-display text-3xl font-medium">
                {locale === 'ru' && cat.nameRu ? cat.nameRu : cat.name}
              </span>
              {cat.description && (
                <p className="relative mt-2 max-w-xs px-6 text-center text-xs text-cream/60">{cat.description}</p>
              )}
            </Link>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
