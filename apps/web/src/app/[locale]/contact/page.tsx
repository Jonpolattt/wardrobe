'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery } from '@apollo/client';
import { Mail, MapPin, Phone, Send } from 'lucide-react';
import { Reveal } from '@/components/ui/Reveal';
import { GET_SITE_SETTINGS } from '@/lib/graphql/queries';
import { SEND_CONTACT_MESSAGE } from '@/lib/graphql/mutations';
import type { Locale } from '@/i18n/config';
import uzDict from '@/i18n/dictionaries/uz.json';
import ruDict from '@/i18n/dictionaries/ru.json';

interface ContactForm {
  name: string;
  contact: string;
  message: string;
}

// Original hardcoded values — used until an admin sets real ones from the
// admin panel (Sozlamalar → Kontakt ma'lumotlari), so nothing breaks before
// that's ever been filled in.
const DEFAULT_ADDRESS = "Jizzax shahar, Madaniyat mahallasi, Ogahiy ko'chasi, 2-uy";
const DEFAULT_PHONE = '+998 (97) 521-31-30';
const DEFAULT_TELEGRAM = '@MZ0526';
const DEFAULT_EMAIL = 'hello@wardrobe.uz';

export default function ContactPage({ params }: { params: { locale: Locale } }) {
  const { locale } = params;
  const dict = locale === 'ru' ? ruDict : uzDict;
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState(false);

  const { data } = useQuery(GET_SITE_SETTINGS);
  const settings = data?.siteSettings;
  const address = settings?.contactAddress || DEFAULT_ADDRESS;
  const phone = settings?.contactPhone || DEFAULT_PHONE;
  const telegram = settings?.contactTelegram || DEFAULT_TELEGRAM;
  const email = settings?.contactEmail || DEFAULT_EMAIL;
  const phoneHref = `tel:${phone.replace(/[^\d+]/g, '')}`;
  const telegramHref = `https://t.me/${telegram.replace(/^@/, '')}`;

  const [sendContactMessage, { loading: sending }] = useMutation(SEND_CONTACT_MESSAGE);

  const { register, handleSubmit, reset } = useForm<ContactForm>();

  async function onSubmit(values: ContactForm) {
    setSendError(false);
    try {
      await sendContactMessage({ variables: { input: values } });
      setSent(true);
      reset();
      setTimeout(() => setSent(false), 4000);
    } catch {
      setSendError(true);
    }
  }

  return (
    <div className="container-app py-16">
      <Reveal>
        <h1 className="section-title">{dict.contact.title}</h1>
        <p className="mt-3 max-w-lg text-sm text-ink-900/60">{dict.contact.subtitle}</p>
      </Reveal>

      <div className="mt-12 grid gap-10 lg:grid-cols-3">
        <Reveal delay={0.1} className="space-y-6">
          {[
            { icon: MapPin, label: address, href: undefined },
            { icon: Phone, label: phone, href: phoneHref },
            { icon: Send, label: `${telegram} (Telegram)`, href: telegramHref },
            { icon: Mail, label: email, href: `mailto:${email}` },
          ].map((item) =>
            item.href ? (
              <a
                key={item.label}
                href={item.href}
                target={item.href.startsWith('http') ? '_blank' : undefined}
                rel={item.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                className="flex items-center gap-3 hover:text-gold-600"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink-950 text-gold-400">
                  <item.icon size={16} />
                </div>
                <span className="text-sm">{item.label}</span>
              </a>
            ) : (
              <div key={item.label} className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink-950 text-gold-400">
                  <item.icon size={16} />
                </div>
                <span className="text-sm">{item.label}</span>
              </div>
            ),
          )}
        </Reveal>

        <Reveal delay={0.15} className="lg:col-span-2">
          <form onSubmit={handleSubmit(onSubmit)} className="card-surface space-y-4 p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <input
                {...register('name', { required: true })}
                placeholder={dict.contact.name}
                className="rounded-xl border border-ink-900/15 px-4 py-3 text-sm outline-none focus:border-ink-950"
              />
              <input
                {...register('contact', { required: true })}
                placeholder={dict.contact.contactPlaceholder}
                className="rounded-xl border border-ink-900/15 px-4 py-3 text-sm outline-none focus:border-ink-950"
              />
            </div>
            <textarea
              {...register('message', { required: true })}
              rows={5}
              placeholder={dict.contact.message}
              className="w-full rounded-xl border border-ink-900/15 px-4 py-3 text-sm outline-none focus:border-ink-950"
            />
            <button type="submit" disabled={sending} className="btn-primary disabled:opacity-50">
              {sending ? dict.contact.sending : dict.contact.send}
            </button>
            {sent && <p className="text-xs font-semibold text-emerald-600">{dict.contact.sentSuccess}</p>}
            {sendError && <p className="text-xs font-semibold text-red-500">{dict.contact.sendError}</p>}
          </form>
        </Reveal>
      </div>
    </div>
  );
}
