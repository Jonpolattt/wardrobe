import type { Metadata } from 'next';
import { getDictionary } from '@/i18n/get-dictionary';
import type { Locale } from '@/i18n/config';
import { pageSeo } from '@/lib/seo/site';

// "Yordam" (Contact) sahifasining o'zi client component ('use client') —
// forma holati, yuborish tugmasi va h.k. brauzerda ishlaydi. Client
// componentdan `generateMetadata` eksport qilib bo'lmaydi (Next.js buni
// taqiqlaydi), shuning uchun metadata sahifaning YONIDAGI shu layout
// orqali beriladi. Bu Next.js'ning standart yechimi; sahifaning o'ziga
// umuman tegilmaydi, dizayn ham o'zgarmaydi.
export async function generateMetadata({ params }: { params: { locale: Locale } }): Promise<Metadata> {
  const dict = await getDictionary(params.locale);
  return pageSeo({
    locale: params.locale,
    path: '/contact',
    title: dict.contact.title,
    description: dict.contact.subtitle,
  });
}

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
