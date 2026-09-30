'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { UploadCloud, Check } from 'lucide-react';
import Image from 'next/image';
import { GET_SITE_SETTINGS } from '@/lib/graphql/queries';
import { UPDATE_SITE_SETTINGS } from '@/lib/graphql/mutations';
import { useAuthStore } from '@/lib/store/auth-store';
import type { Locale } from '@/i18n/config';
import uzDict from '@/i18n/dictionaries/uz.json';
import ruDict from '@/i18n/dictionaries/ru.json';

// Note: the "clear all data" danger-zone control lives on the Dashboard page
// (admin/page.tsx) instead of here, next to the stat cards it actually
// affects — that's where an admin can see the numbers reset in place.

export default function AdminSettingsPage({ params }: { params: { locale: Locale } }) {
  const { locale } = params;
  const dict = locale === 'ru' ? ruDict : uzDict;
  const accessToken = useAuthStore((s) => s.accessToken);

  const { data, loading } = useQuery(GET_SITE_SETTINGS);
  const [updateSiteSettings] = useMutation(UPDATE_SITE_SETTINGS);

  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const heroImage: string | undefined = data?.siteSettings?.heroImage;
  const previewSrc = heroImage || '/placeholder-product.svg';

  // Contact info form — separate save button/state from the hero banner
  // above, since they're logically unrelated. Local state is seeded from
  // the query once it loads (empty string, not the fallback default, so
  // the placeholder shows the default instead of the field looking "filled"
  // with something the admin never typed).
  const [contactForm, setContactForm] = useState({
    contactAddress: '',
    contactPhone: '',
    contactTelegram: '',
    contactEmail: '',
    // Footer ikonkalari uchun to'liq havola. contactTelegram'dan farqi:
    // u "Yordam" sahifasidagi @username, bu esa bosiladigan manzil.
    socialTelegram: '',
    socialInstagram: '',
    socialTiktok: '',
  });

  // To'lov kartasi — alohida forma va alohida "Saqlash" tugmasi:
  // kontakt ma'lumoti bilan aloqasi yo'q va noto'g'ri tegib ketish
  // xavfi bo'lmasligi kerak (bu pul boradigan joy).
  const [cardForm, setCardForm] = useState({ paymentCardNumber: '', paymentCardHolder: '' });
  const [savingCard, setSavingCard] = useState(false);
  const [cardSaved, setCardSaved] = useState(false);
  const [contactSeeded, setContactSeeded] = useState(false);
  const [savingContact, setSavingContact] = useState(false);
  const [contactSaved, setContactSaved] = useState(false);

  useEffect(() => {
    if (!contactSeeded && data?.siteSettings) {
      setContactForm({
        contactAddress: data.siteSettings.contactAddress ?? '',
        contactPhone: data.siteSettings.contactPhone ?? '',
        contactTelegram: data.siteSettings.contactTelegram ?? '',
        contactEmail: data.siteSettings.contactEmail ?? '',
        socialTelegram: data.siteSettings.socialTelegram ?? '',
        socialInstagram: data.siteSettings.socialInstagram ?? '',
        socialTiktok: data.siteSettings.socialTiktok ?? '',
      });
      setCardForm({
        paymentCardNumber: data.siteSettings.paymentCardNumber ?? '',
        paymentCardHolder: data.siteSettings.paymentCardHolder ?? '',
      });
      setContactSeeded(true);
    }
  }, [contactSeeded, data]);

  async function handleSaveContact() {
    setSavingContact(true);
    setContactSaved(false);
    try {
      await updateSiteSettings({
        variables: { input: contactForm },
        refetchQueries: [{ query: GET_SITE_SETTINGS }],
      });
      setContactSaved(true);
      setTimeout(() => setContactSaved(false), 3000);
    } finally {
      setSavingContact(false);
    }
  }

  async function handleSaveCard() {
    setSavingCard(true);
    setCardSaved(false);
    try {
      await updateSiteSettings({
        variables: { input: cardForm },
        // Refetch — to'lov ekrani (OrderPaymentPanel) xuddi shu so'rovni
        // `cache-first` bilan o'qiydi, shuning uchun kesh yangilanmasa
        // eski karta ko'rinib turardi.
        refetchQueries: [{ query: GET_SITE_SETTINGS }],
      });
      setCardSaved(true);
      setTimeout(() => setCardSaved(false), 3000);
    } finally {
      setSavingCard(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setSaved(false);
    try {
      // Reuses the same generic admin-only upload endpoint the product form
      // uses — it just needs an image file, the destination folder name
      // ("products") doesn't matter functionally for a banner image.
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/upload/product-image', {
        method: 'POST',
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
        body: formData,
      });
      if (!res.ok) throw new Error('Upload failed');
      const { url } = await res.json();

      await updateSiteSettings({
        variables: { input: { heroImage: url } },
        // Refetch so the preview above reflects the just-saved image
        // immediately instead of waiting for a manual page reload.
        refetchQueries: [{ query: GET_SITE_SETTINGS }],
      });
      setSaved(true);
    } catch {
      // eslint-disable-next-line no-alert
      alert(dict.admin.uploadError);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="section-title">{dict.admin.settings}</h1>

      <div className="card-surface max-w-xl space-y-4 p-6">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider">{dict.admin.heroBannerTitle}</h2>
          <p className="mt-1 text-xs text-ink-900/50">{dict.admin.heroBannerHint}</p>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold text-ink-900/60">{dict.admin.currentImage}</p>
          <div className="relative aspect-[4/3] w-full max-w-sm overflow-hidden rounded-2xl bg-ink-900/5">
            {!loading && <Image src={previewSrc} alt="" fill className="object-cover" />}
          </div>
          {!loading && !heroImage && <p className="mt-2 text-xs text-ink-900/40">{dict.admin.noImage}</p>}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          className="hidden"
          id="hero-image-upload"
        />
        <label
          htmlFor="hero-image-upload"
          className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-ink-900/15 py-6 text-sm font-semibold text-ink-900/60 transition-colors hover:border-ink-950 hover:text-ink-950"
        >
          <UploadCloud size={18} />
          {uploading ? dict.admin.uploading : dict.admin.uploadFromComputer}
        </label>

        {saved && !uploading && (
          <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
            <Check size={14} /> {dict.admin.savedSuccess}
          </p>
        )}
      </div>

      <div className="card-surface max-w-xl space-y-4 p-6">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider">{dict.admin.contactInfoTitle}</h2>
          <p className="mt-1 text-xs text-ink-900/50">{dict.admin.contactInfoHint}</p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-ink-900/60">{dict.admin.contactAddressLabel}</label>
            <input
              value={contactForm.contactAddress}
              onChange={(e) => setContactForm((f) => ({ ...f, contactAddress: e.target.value }))}
              placeholder="Jizzax shahar, Madaniyat mahallasi, Ogahiy ko'chasi, 2-uy"
              className="w-full rounded-xl border border-ink-900/15 px-4 py-3 text-sm outline-none focus:border-ink-950"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-ink-900/60">{dict.admin.contactPhoneLabel}</label>
            <input
              value={contactForm.contactPhone}
              onChange={(e) => setContactForm((f) => ({ ...f, contactPhone: e.target.value }))}
              placeholder="+998 (97) 521-31-30"
              className="w-full rounded-xl border border-ink-900/15 px-4 py-3 text-sm outline-none focus:border-ink-950"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-ink-900/60">{dict.admin.contactTelegramLabel}</label>
            <input
              value={contactForm.contactTelegram}
              onChange={(e) => setContactForm((f) => ({ ...f, contactTelegram: e.target.value }))}
              placeholder="@MZ0526"
              className="w-full rounded-xl border border-ink-900/15 px-4 py-3 text-sm outline-none focus:border-ink-950"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-ink-900/60">{dict.admin.contactEmailLabel}</label>
            <input
              value={contactForm.contactEmail}
              onChange={(e) => setContactForm((f) => ({ ...f, contactEmail: e.target.value }))}
              placeholder="hello@wardrobe.uz"
              className="w-full rounded-xl border border-ink-900/15 px-4 py-3 text-sm outline-none focus:border-ink-950"
            />
          </div>

          {/* Saytning eng pastidagi (footer) ikonkalar. Facebook olib
              tashlangan — faqat Telegram va Instagram qoldi. To'liq
              havola yoziladi; bo'sh qoldirilsa standart havola
              ishlatiladi. */}
          <div className="border-t border-ink-900/10 pt-3">
            <label className="mb-1.5 block text-xs font-semibold text-ink-900/60">{dict.admin.socialTelegramLabel}</label>
            <input
              value={contactForm.socialTelegram}
              onChange={(e) => setContactForm((f) => ({ ...f, socialTelegram: e.target.value }))}
              placeholder="https://t.me/wardrobestore"
              className="w-full rounded-xl border border-ink-900/15 px-4 py-3 text-sm outline-none focus:border-ink-950"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-ink-900/60">{dict.admin.socialInstagramLabel}</label>
            <input
              value={contactForm.socialInstagram}
              onChange={(e) => setContactForm((f) => ({ ...f, socialInstagram: e.target.value }))}
              placeholder="https://www.instagram.com/wardrobe.uzbekistan/"
              className="w-full rounded-xl border border-ink-900/15 px-4 py-3 text-sm outline-none focus:border-ink-950"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-ink-900/60">{dict.admin.socialTiktokLabel}</label>
            <input
              value={contactForm.socialTiktok}
              onChange={(e) => setContactForm((f) => ({ ...f, socialTiktok: e.target.value }))}
              placeholder="https://www.tiktok.com/@wardrobestore"
              className="w-full rounded-xl border border-ink-900/15 px-4 py-3 text-sm outline-none focus:border-ink-950"
            />
            {/* TikTok ikonkasi footer'da faqat shu maydon to'ldirilgandan
                keyin paydo bo'ladi — bo'sh bo'lsa umuman chizilmaydi. */}
            <p className="mt-1 text-xs text-ink-900/40">{dict.admin.socialTiktokHint}</p>
          </div>
        </div>

        <button onClick={handleSaveContact} disabled={savingContact} className="btn-primary disabled:opacity-50">
          {savingContact ? dict.admin.saving : dict.admin.save}
        </button>

        {contactSaved && (
          <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
            <Check size={14} /> {dict.admin.savedSuccess}
          </p>
        )}
      </div>

      {/* ── To'lov kartasi ── */}
      <div className="card-surface max-w-xl space-y-4 p-6">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider">{dict.admin.paymentCardTitle}</h2>
          <p className="mt-1 text-xs text-ink-900/50">{dict.admin.paymentCardHint}</p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-ink-900/60">{dict.admin.paymentCardNumberLabel}</label>
            <input
              value={cardForm.paymentCardNumber}
              onChange={(e) => setCardForm((f) => ({ ...f, paymentCardNumber: e.target.value }))}
              inputMode="numeric"
              placeholder="8600 1234 5678 9012"
              className="w-full rounded-xl border border-ink-900/15 px-4 py-3 text-sm tracking-wider outline-none focus:border-ink-950"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-ink-900/60">{dict.admin.paymentCardHolderLabel}</label>
            <input
              value={cardForm.paymentCardHolder}
              onChange={(e) => setCardForm((f) => ({ ...f, paymentCardHolder: e.target.value }))}
              placeholder="Muhammadjon Zoirov"
              className="w-full rounded-xl border border-ink-900/15 px-4 py-3 text-sm outline-none focus:border-ink-950"
            />
          </div>
        </div>

        <button onClick={handleSaveCard} disabled={savingCard} className="btn-primary disabled:opacity-50">
          {savingCard ? dict.admin.saving : dict.admin.save}
        </button>

        {cardSaved && (
          <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
            <Check size={14} /> {dict.admin.savedSuccess}
          </p>
        )}
      </div>
    </div>
  );
}
