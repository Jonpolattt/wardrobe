import type { Metadata } from 'next';
import { getDictionary } from '@/i18n/get-dictionary';
import type { Locale } from '@/i18n/config';
import { Reveal } from '@/components/ui/Reveal';
import { pageSeo } from '@/lib/seo/site';

// Ro'yxatdan o'tish formasidagi "Bizning politika" havolasi shu sahifaga
// olib boradi (yangi tabda ochiladi — register/page.tsx'ga qarang). Boshqa
// statik sahifalar (about/contact) bilan bir xil, oddiy server component
// naqshini takrorlaydi — interaktivlik kerak emas.
export async function generateMetadata({ params }: { params: { locale: Locale } }): Promise<Metadata> {
  const dict = await getDictionary(params.locale);
  return pageSeo({
    locale: params.locale,
    path: '/terms',
    title: dict.terms.title,
    description: dict.terms.subtitle,
  });
}

export default async function TermsPage({ params }: { params: { locale: Locale } }) {
  const { locale } = params;
  const dict = await getDictionary(locale);

  return (
    <div>
      <section className="bg-ink-950 py-24 text-cream">
        <div className="container-app">
          <Reveal>
            <h1 className="font-display text-4xl font-medium sm:text-5xl">{dict.terms.title}</h1>
            <p className="mt-4 max-w-xl text-cream/60">{dict.terms.subtitle}</p>
          </Reveal>
        </div>
      </section>

      <section className="container-app py-16">
        <Reveal>
          <div className="max-w-2xl space-y-6 text-sm leading-relaxed text-ink-900/70 dark:text-cream/70">
            {dict.terms.sections.map((section) => (
              <div key={section.heading}>
                <h2 className="mb-2 font-display text-lg font-medium text-ink-950 dark:text-cream">{section.heading}</h2>
                <p>{section.body}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </section>
    </div>
  );
}
