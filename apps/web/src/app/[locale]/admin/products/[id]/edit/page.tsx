'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, gql } from '@apollo/client';
import { AlertCircle } from 'lucide-react';
import { UPDATE_PRODUCT } from '@/lib/graphql/mutations';
import { ProductForm, type ProductFormValues } from '@/components/admin/ProductForm';
import { getFriendlyErrorMessage } from '@/lib/utils/graphql-error';
import type { Locale } from '@/i18n/config';
import uzDict from '@/i18n/dictionaries/uz.json';
import ruDict from '@/i18n/dictionaries/ru.json';

// Products are fetched by slug on the public schema; for the admin edit
// screen we look the product up client-side from the already-loaded list.
export default function EditProductPage({ params }: { params: { locale: Locale; id: string } }) {
  const { locale, id } = params;
  const dict = locale === 'ru' ? ruDict : uzDict;
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { data, loading } = useQuery(
    gql`
      query AdminProductsForEdit {
        products(filter: { page: 1, limit: 200, sort: NEWEST }) {
          list {
            id
            title
            titleRu
            description
            descriptionRu
            sku
            price
            oldPrice
            discountPercent
            stock
            sizes
            colors
            images
            colorImages {
              color
              images
            }
            variants {
              size
              color
              stock
            }
            isFeatured
            categoryId
            brandId
            storeId
            genderId
          }
        }
      }
    `,
  );

  const [updateProduct] = useMutation(UPDATE_PRODUCT);

  const product = data?.products?.list?.find((p: any) => p.id === id);

  async function handleSubmit(values: ProductFormValues) {
    setSubmitting(true);
    setErrorMessage(null);
    try {
      await updateProduct({ variables: { id, input: values } });
      router.push(`/${locale}/admin/products`);
    } catch (error) {
      setErrorMessage(getFriendlyErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink-900/10 border-t-ink-950" />
      </div>
    );
  }

  if (!product) return <p className="text-sm text-ink-900/50">{dict.product.noResults}</p>;

  return (
    <div className="space-y-6">
      <h1 className="section-title">{dict.admin.editProduct}</h1>

      {errorMessage && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <ProductForm
        dict={dict}
        defaultValues={{
          title: product.title,
          titleRu: product.titleRu,
          description: product.description,
          descriptionRu: product.descriptionRu,
          sku: product.sku,
          price: Number(product.price),
          oldPrice: product.oldPrice ? Number(product.oldPrice) : undefined,
          discountPercent: product.discountPercent,
          stock: product.stock,
          sizes: product.sizes ?? [],
          colors: product.colors ?? [],
          images: product.images ?? [],
          colorImages: (product.colorImages ?? []).map((ci: any) => ({ color: ci.color, images: ci.images ?? [] })),
          variants: (product.variants ?? []).map((v: any) => ({ size: v.size, color: v.color, stock: v.stock })),
          categoryId: product.categoryId,
          brandId: product.brandId,
          storeId: product.storeId,
          isFeatured: product.isFeatured,
          genderId: product.genderId,
        }}
        onSubmit={handleSubmit}
        submitting={submitting}
      />
    </div>
  );
}
