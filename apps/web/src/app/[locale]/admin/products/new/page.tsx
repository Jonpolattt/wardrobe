'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@apollo/client';
import { AlertCircle } from 'lucide-react';
import { CREATE_PRODUCT } from '@/lib/graphql/mutations';
import { ProductForm, type ProductFormValues } from '@/components/admin/ProductForm';
import { getFriendlyErrorMessage } from '@/lib/utils/graphql-error';
import type { Locale } from '@/i18n/config';
import uzDict from '@/i18n/dictionaries/uz.json';
import ruDict from '@/i18n/dictionaries/ru.json';

export default function NewProductPage({
  params,
  searchParams,
}: {
  params: { locale: Locale };
  // Magazin sahifasidagi "Mahsulot qo'shish" tugmasi ?store=<id> bilan
  // keladi — forma o'sha magazin oldindan tanlangan holda ochiladi.
  searchParams?: { store?: string };
}) {
  const { locale } = params;
  const dict = locale === 'ru' ? ruDict : uzDict;
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [createProduct] = useMutation(CREATE_PRODUCT);

  async function handleSubmit(values: ProductFormValues) {
    setSubmitting(true);
    setErrorMessage(null);
    try {
      await createProduct({ variables: { input: values } });
      // Magazin sahifasidan kelgan bo'lsa — o'sha magazinga qaytamiz
      // (yangi tovar darhol ro'yxatda ko'rinadi), aks holda umumiy
      // tovarlar ro'yxatiga.
      router.push(
        searchParams?.store
          ? `/${locale}/admin/stores/${searchParams.store}`
          : `/${locale}/admin/products`,
      );
    } catch (error) {
      // Show a friendly Uzbek message instead of letting the raw
      // ApolloError crash the whole page with Next.js's error overlay.
      setErrorMessage(getFriendlyErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="section-title">{dict.admin.addProduct}</h1>

      {errorMessage && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <ProductForm
        dict={dict}
        defaultValues={searchParams?.store ? { storeId: searchParams.store } : undefined}
        onSubmit={handleSubmit}
        submitting={submitting}
      />
    </div>
  );
}
