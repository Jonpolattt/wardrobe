import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { spacing } from '@wardrobe/theme';
import { RequireAuth } from '../../components/RequireAuth';
import { ProductCard } from '../../components/ProductCard';
import { StorefrontList } from '../../components/StorefrontShell';
import { Body, Button, Card, Screen, Skeleton, StateView, Title } from '../../components/ui';
import { useTheme } from '../../hooks/useTheme';
import { mobileApi } from '../../services/api';
import { queryClient } from '../../services/query-client';
import { useAuth } from '../../store/auth';

function FavoritesContent() {
  const { t } = useTranslation('commerce');
  const router = useRouter();
  const { colors } = useTheme();
  const sessionKey = useAuth(state => state.sessionKey);
  const wishlist = useQuery({ queryKey: ['private', sessionKey, 'wishlist'], queryFn: ({ signal }) => mobileApi.wishlist(signal) });
  const remove = useMutation({
    mutationFn: (id: string) => mobileApi.removeWishlist(id),
    onSuccess: async () => {
      if (useAuth.getState().sessionKey === sessionKey) await queryClient.invalidateQueries({ queryKey: ['private', sessionKey, 'wishlist'] });
    },
  });
  if (wishlist.isPending) return <Screen><Title>{t('favorites')}</Title><View style={{ flexDirection: 'row', gap: spacing.lg }}><Skeleton height={260} style={{ flex: 1 }} /><Skeleton height={260} style={{ flex: 1 }} /></View></Screen>;
  if (wishlist.isError && !wishlist.data) return <Screen><StateView kind="error" title={t('loadError')} onRetry={() => void wishlist.refetch()} /></Screen>;
  return <Screen scroll={false}>
    <StorefrontList data={wishlist.data ?? []} keyExtractor={item => item.id} numColumns={2}
      columnWrapperStyle={{ gap: spacing.lg }} contentContainerStyle={{ gap: spacing.xxl }}
      ListHeaderComponent={<View style={{ gap: spacing.md }}><Title>{t('favorites')}</Title>{(wishlist.isError || remove.isError) && <Body style={{ color: colors.danger }}>{t('requestError')}</Body>}</View>}
      ListEmptyComponent={<View style={{ gap: spacing.lg }}><StateView kind="empty" title={t('favoritesEmpty')} message={t('favoritesEmptyBody')} /><Button title={t('shop')} onPress={() => router.push('/(tabs)/shop')} /></View>}
      refreshing={wishlist.isRefetching} onRefresh={() => { remove.reset(); void wishlist.refetch(); }}
      renderItem={({ item }) => <View style={{ width: '47.5%', gap: spacing.sm }}>
        {item.product ? <ProductCard product={item.product} favoriteSelected favoriteBusy={remove.isPending}
          onFavoritePress={() => remove.mutate(item.id)}
          onPress={() => router.push({ pathname: '/product/[slug]', params: { slug: item.product!.slug } })} /> :
          <Card><Body>{t('unavailable')}</Body><Button title={t('remove')} variant="secondary" disabled={remove.isPending} onPress={() => remove.mutate(item.id)} /></Card>}
      </View>}
    />
  </Screen>;
}
export default function FavoritesScreen() { return <RequireAuth><FavoritesContent /></RequireAuth>; }
