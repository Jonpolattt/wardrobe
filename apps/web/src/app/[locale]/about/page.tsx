import { Sparkles, Truck, RotateCcw, ShieldCheck } from 'lucide-react';
import { getDictionary } from '@/i18n/get-dictionary';
import type { Locale } from '@/i18n/config';
import { Reveal } from '@/components/ui/Reveal';

import { pageSeo } from '@/lib/seo/site';
import type { Metadata } from 'next';

const ICONS = [Sparkles, Truck, RotateCcw, ShieldCheck];

export async function generateMetadata({ params }: { params: { locale: Locale } }): Promise<Metadata> {
  const dict = await getDictionary(params.locale);
  return pageSeo({
    locale: params.locale,
    path: '/about',
    title: dict.about.title,
    description: dict.about.subtitle,
  });
}

export default async function AboutPage({ params }: { params: { locale: Locale } }) {
  const { locale } = params;
  const dict = await getDictionary(locale);

  return (
    <div>
      <section className="bg-ink-950 py-24 text-cream">
        <div className="container-app">
          <Reveal>
            <h1 className="font-display text-4xl font-medium sm:text-5xl">{dict.about.title}</h1>
            <p className="mt-4 max-w-xl text-cream/60">{dict.about.subtitle}</p>
          </Reveal>
        </div>
      </section>

      <section className="container-app py-16">
        <Reveal>
          <p className="max-w-3xl text-sm leading-relaxed text-ink-900/70">
            {dict.home.heroSubtitle} {dict.home.heroSubtitle}
          </p>
        </Reveal>

        <div className="mt-14 grid grid-cols-2 gap-8 lg:grid-cols-4">
          {dict.home.whyUsItems.map((item, i) => {
            const Icon = ICONS[i % ICONS.length];
            return (
              <Reveal
                key={item.title}
                delay={i * 0.08}
                className="rounded-2xl border border-ink-900/5 bg-white p-6 shadow-soft dark:border-cream/10 dark:bg-ink-800"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-ink-950 text-gold-400 dark:bg-cream/10">
                  <Icon size={18} />
                </div>
                <h3 className="mt-4 text-sm font-semibold dark:text-cream">{item.title}</h3>
                <p className="mt-1 text-xs text-ink-900/50">{item.desc}</p>
              </Reveal>
            );
          })}
        </div>
      </section>
    </div>
  );
}
