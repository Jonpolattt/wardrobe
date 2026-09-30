'use client';

import Link from 'next/link';
import { useQuery, useMutation } from '@apollo/client';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { GET_PRODUCTS_ADMIN } from '@/lib/graphql/queries';
import { REMOVE_PRODUCT, HARD_DELETE_PRODUCT } from '@/lib/graphql/mutations';
import { formatPrice } from '@/lib/utils/format';
import type { Locale } from '@/i18n/config';
import uzDict from '@/i18n/dictionaries/uz.json';
import ruDict from '@/i18n/dictionaries/ru.json';

export default function AdminProductsPage({ params }: { params: { locale: Locale } }) {
  const { locale } = params;
  const dict = locale === 'ru' ? ruDict : uzDict;

  const { data, loading, refetch } = useQuery(GET_PRODUCTS_ADMIN, {
    variables: { filter: { page: 1, limit: 100, sort: 'NEWEST' } },
    // Yangi tovar qo'shib qaytganda ro'yxat o'zi yangilansin (F5siz).
    fetchPolicy: 'cache-and-network',
  });
  const [removeProduct] = useMutation(REMOVE_PRODUCT);
  const [hardDeleteProduct] = useMutation(HARD_DELETE_PRODUCT);

  const products = data?.productsAdmin?.list ?? [];

  // Yashirish (soft) — tovar bazada qoladi, faqat saytdan ko'rinmay qoladi.
  async function handleHide(id: string) {
    if (!confirm(dict.admin.hideProductConfirm)) return;
    await removeProduct({ variables: { id } });
    refetch();
  }

  // Butunlay o'chirish — faqat allaqachon yashirilgan tovarlar uchun
  // ko'rsatiladigan tugma (masalan magazin o'chirilganda avtomatik
  // yashiringan tovarlarni admin shu yerdan yakuniy tozalashi uchun).
  async function handleHardDelete(id: string) {
    if (!confirm(dict.admin.permanentlyDeleteConfirm)) return;
    try {
      await hardDeleteProduct({ variables: { id } });
      refetch();
    } catch {
      alert(dict.admin.permanentlyDeleteFailed);
    }
  }

  // Only block on the very first load (no data yet) — once the list has
  // loaded once, a delete's refetch flips `loading` true again but the old
  // rows should keep showing instead of the table blanking out.
  if (!data && loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink-900/10 border-t-ink-950" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="section-title">{dict.admin.products}</h1>
        <Link href={`/${locale}/admin/products/new`} className="btn-primary">
          <Plus size={16} />
          {dict.admin.addProduct}
        </Link>
      </div>

      <div className="card-surface overflow-x-auto p-0">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-ink-900/10 text-left text-xs uppercase tracking-wider text-ink-900/40">
              <th className="px-5 py-4">{dict.admin.productName}</th>
              <th className="px-5 py-4">{dict.product.category}</th>
              <th className="px-5 py-4">{dict.admin.storeLabel}</th>
              <th className="px-5 py-4">{dict.admin.price}</th>
              <th className="px-5 py-4">{dict.admin.stock}</th>
              <th className="px-5 py-4" />
            </tr>
          </thead>
          <tbody>
            {products.map((p: any) => (
                <tr key={p.id} className={`border-b border-ink-900/5 last:border-0 ${p.isActive === false ? 'opacity-50' : ''}`}>
                  <td className="max-w-[220px] truncate px-5 py-4 font-medium">
                    <div className="flex items-center gap-2">
                      <span className="truncate">{p.title}</span>
                      {p.isActive === false && (
                        <span className="shrink-0 rounded-full bg-ink-900/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-900/50">
                          {dict.admin.hiddenProduct}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-ink-900/60">{p.category?.name}</td>
                  <td className="px-5 py-4">
                    {p.store?.name ? (
                      <span className="rounded-full bg-ink-900/5 px-2.5 py-1 text-xs font-semibold text-ink-900/70">
                        {p.store.name}
                      </span>
                    ) : (
                      <span className="text-xs text-ink-900/30">—</span>
                    )}
                  </td>
                  <td className="px-5 py-4 font-semibold">{formatPrice(p.price, locale)}</td>
                  <td className="px-5 py-4">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${p.stock <= 5 ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-700'}`}>
                      {p.stock}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/${locale}/admin/products/${p.id}/edit`}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-ink-900/10 hover:border-ink-950"
                      >
                        <Pencil size={14} />
                      </Link>
                      {p.isActive === false ? (
                        // Yashirilgan tovar — endi faqat yakuniy, butunlay
                        // o'chirish tugmasi ko'rsatiladi (yashirish tugmasi
                        // shu tovar uchun ma'nosiz, chunki allaqachon yashirilgan).
                        <button
                          onClick={() => handleHardDelete(p.id)}
                          title={dict.admin.permanentlyDelete}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-300 text-red-600 hover:bg-red-50"
                        >
                          <Trash2 size={14} />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleHide(p.id)}
                          title={dict.admin.hideProduct}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-ink-900/10 text-red-500 hover:border-red-500"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
        {!loading && products.length === 0 && <p className="p-8 text-center text-sm text-ink-900/40">{dict.product.noResults}</p>}
      </div>
    </div>
  );
}
