import { useEffect, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { CartItem } from '@wardrobe/types';
import { formatPrice } from '@wardrobe/utils';
import { RequireAuth } from '../../components/RequireAuth';
import { Body, Button, Card, Screen, Skeleton, StateView, Title } from '../../components/ui';
import { useTheme } from '../../hooks/useTheme';
import { imageUrl, mobileApi } from '../../services/api';
import { queryClient } from '../../services/query-client';
import { useAuth } from '../../store/auth';
import { productTitle, selectedStock } from '../../features/catalog/model';

function available(item: CartItem): number {
  if (!item.product?.isActive) return 0;
  return Math.max(0, selectedStock(item.product, item.size ?? undefined, item.color ?? undefined));
}
function CartContent() {
  const { t, i18n } = useTranslation('commerce');
  const locale = i18n.language === 'ru' ? 'ru' : 'uz';
  const router = useRouter();
  const { colors } = useTheme();
  const sessionKey = useAuth(state => state.sessionKey);
  const [selectedIds, setSelectedIds] = useState<string[] | null>(null);
  const cart = useQuery({ queryKey: ['private', sessionKey, 'cart'], queryFn: ({ signal }) => mobileApi.cart(signal) });
  const items = cart.data ?? [];
  const selected = items.filter(item => selectedIds === null || selectedIds.includes(item.id));
  const change = useMutation({
    mutationFn: async (action: { id: string; quantity?: number }) => {
      if (action.quantity === undefined) await mobileApi.removeCart(action.id);
      else await mobileApi.updateCart({ id: action.id, quantity: action.quantity });
    },
    onSuccess: async () => {
      if (useAuth.getState().sessionKey === sessionKey) await queryClient.invalidateQueries({ queryKey: ['private', sessionKey, 'cart'] });
    },
  });
  useEffect(() => { setSelectedIds(null); }, [sessionKey]);
  const total = selected.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const invalidSelection = selected.some(item => !item.product || item.quantity > available(item));
  const toggle = (id: string) => {
    const current = selectedIds ?? items.map(item => item.id);
    setSelectedIds(current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
  };
  if (cart.isPending) return <Screen><Title>{t('cart')}</Title><Skeleton /><Skeleton /><Skeleton /></Screen>;
  if (cart.isError && !cart.data) return <Screen><StateView kind="error" title={t('loadError')} onRetry={() => void cart.refetch()} /></Screen>;
  return <Screen scroll={false}>
    <FlatList
      data={items}
      keyExtractor={item => item.id}
      contentContainerStyle={{ gap: 12, paddingBottom: 28 }}
      ListHeaderComponent={<View style={{ gap: 12 }}><Title>{t('cart')}</Title>{items.length > 0 && <Button title={t('selectAll')} variant="secondary" onPress={() => setSelectedIds(null)} />}{(cart.isError || change.isError) && <Body style={{ color: colors.danger }}>{t('requestError')}</Body>}</View>}
      ListEmptyComponent={<View style={{ gap: 16 }}><StateView kind="empty" title={t('cartEmpty')} message={t('cartEmptyBody')} /><Button title={t('shop')} onPress={() => router.push('/(tabs)/shop')} /></View>}
      refreshing={cart.isRefetching}
      onRefresh={() => { change.reset(); void cart.refetch(); }}
      renderItem={({ item }) => {
        const checked = selected.some(value => value.id === item.id);
        const stock = available(item);
        return <Card>
          <View style={{ gap: 12 }}>
            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} accessibilityLabel={t('select')} onPress={() => toggle(item.id)} style={{ paddingVertical: 8 }}>
              <Body style={{ color: checked ? colors.accentText : colors.mutedText }}>{checked ? '☑ ' : '☐ '}{t(checked ? 'selected' : 'select')}</Body>
            </Pressable>
            <Pressable disabled={!item.product} onPress={() => item.product && router.push({ pathname: '/product/[slug]', params: { slug: item.product.slug } })} style={{ flexDirection: 'row', gap: 12 }}>
              {item.product?.images[0] && <Image source={imageUrl(item.product.images[0])} style={{ width: 76, height: 92, borderRadius: 8, backgroundColor: colors.input }} contentFit="cover" />}
              <View style={{ flex: 1, gap: 5 }}>
                <Body style={{ fontWeight: '600' }}>{item.product ? productTitle(item.product, locale) : t('unavailable')}</Body>
                <Body style={{ color: colors.mutedText }}>{[item.size, item.color].filter(Boolean).join(' · ')}</Body>
                <Body>{formatPrice(item.unitPrice * item.quantity, locale)}</Body>
                <Body style={{ color: colors.mutedText }}>{t('unitPrice')}: {formatPrice(item.unitPrice, locale)}</Body>
              </View>
            </Pressable>
            {(!item.product || stock === 0 || item.quantity > stock) && <Body style={{ color: colors.danger }}>{t(stock === 0 ? 'unavailable' : 'stockWarning')}</Body>}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Pressable accessibilityRole="button" accessibilityLabel={t('decrease')} disabled={change.isPending || item.quantity <= 1} onPress={() => change.mutate({ id: item.id, quantity: item.quantity - 1 })} style={{ minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 8, opacity: change.isPending || item.quantity <= 1 ? 0.4 : 1 }}><Body>−</Body></Pressable>
              <Body accessibilityLabel={t('quantity')}>{item.quantity}</Body>
              <Pressable accessibilityRole="button" accessibilityLabel={t('increase')} disabled={change.isPending || item.quantity >= stock} onPress={() => change.mutate({ id: item.id, quantity: item.quantity + 1 })} style={{ minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 8, opacity: change.isPending || item.quantity >= stock ? 0.4 : 1 }}><Body>+</Body></Pressable>
              <View style={{ flex: 1 }} />
              <Button title={t('remove')} variant="secondary" disabled={change.isPending} onPress={() => change.mutate({ id: item.id })} />
            </View>
          </View>
        </Card>;
      }}
      ListFooterComponent={items.length > 0 ? <View style={{ gap: 14, paddingTop: 16 }}><Body>{t('selectedCount', { count: selected.length })}</Body><Title>{t('total')}: {formatPrice(total, locale)}</Title><Body style={{ color: colors.mutedText }}>{t('stockHint')}</Body><Button title={t('checkout')} disabled={selected.length === 0 || invalidSelection || change.isPending || cart.isFetching} onPress={() => router.push({ pathname: '/checkout', params: { items: selected.map(item => item.id).join(',') } })} /></View> : null}
    />
  </Screen>;
}
export default function CartScreen() { return <RequireAuth><CartContent /></RequireAuth>; }
