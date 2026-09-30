'use client';

import Link from 'next/link';
import { useQuery, useMutation } from '@apollo/client';
import { Heart } from 'lucide-react';
import { GET_MY_WISHLIST } from '@/lib/graphql/queries';
import { REMOVE_WISHLIST_ITEM } from '@/lib/graphql/mutations';
import { ProductCard } from '@/components/ui/ProductCard';
import { Reveal } from '@/components/ui/Reveal';
import { useAuthStore } from '@/lib/store/auth-store';
import type { Locale } from '@/i18n/config';
import uzDict from '@/i18n/dictionaries/uz.json';
import ruDict from '@/i18n/dictionaries/ru.json';

export default function WishlistPage({ params }: { params: { locale: Locale } }) {
  const { locale } = params;
  const dict = locale === 'ru' ? ruDict : uzDict;
  const user = useAuthStore((s) => s.user);

  const { data, loading } = useQuery(GET_MY_WISHLIST, { skip: !user });
  const [removeItem] = useMutation(REMOVE_WISHLIST_ITEM, { refetchQueries: [{ query: GET_MY_WISHLIST }] });

  const items = data?.myWishlist ?? [];

  if (!user) {
    return (
      <div className="container-app flex flex-col items-center py-32 text-center">
        <Heart size={40} className="text-ink-900/20" />
        <p className="mt-4 text-sm text-ink-900/50">{dict.wishlist.empty}</p>
        <Link href={`/${locale}/login`} className="btn-primary mt-6">
          {dict.nav.login}
        </Link>
      </div>
    );
  }

  // First load only — avoids the empty grid that used to flash for a moment
  // between "logged in" and "wishlist data arrived".
  if (loading && !data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink-900/10 border-t-ink-950" />
      </div>
    );
  }

  return (
    <div className="container-app py-12">
      <Reveal>
        <h1 className="section-title">{dict.wishlist.title}</h1>
      </Reveal>

      {!loading && items.length === 0 && (
        <div className="mt-16 flex flex-col items-center py-20 text-center">
          <Heart size={40} className="text-ink-900/20" />
          <p className="mt-4 text-sm text-ink-900/50">{dict.wishlist.empty}</p>
          <Link href={`/${locale}/shop`} className="btn-primary mt-6">
            {dict.cart.continueShopping}
          </Link>
        </div>
      )}

      <div className="mt-10 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item: any, i: number) => (
          <Reveal key={item.id} delay={i * 0.05} className="relative">
            <ProductCard product={item.product} locale={locale} dict={dict as any} />
            <button
              onClick={() => removeItem({ variables: { id: item.id } })}
              className="mt-2 w-full rounded-full border border-ink-900/10 py-2 text-xs font-semibold text-ink-900/60 hover:border-ink-950 hover:text-ink-950"
            >
              {dict.cart.remove}
            </button>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
