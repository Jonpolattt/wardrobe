import { FlatList, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { formatDate, formatPrice } from '@wardrobe/utils';
import { RequireAuth } from '../../components/RequireAuth';
import { Body, Button, Card, Screen, Skeleton, StateView, Title } from '../../components/ui';
import { useTheme } from '../../hooks/useTheme';
import { mobileApi } from '../../services/api';
import { useAuth } from '../../store/auth';

function OrdersContent() {
  const { t, i18n } = useTranslation('commerce');
  const locale = i18n.language === 'ru' ? 'ru' : 'uz';
  const { colors } = useTheme();
  const router = useRouter();
  const sessionKey = useAuth(state => state.sessionKey);
  const orders = useQuery({ queryKey: ['private', sessionKey, 'orders'], queryFn: ({ signal }) => mobileApi.orders(signal) });
  if (orders.isPending) return <Screen><Title>{t('orders')}</Title><Skeleton /><Skeleton /><Skeleton /></Screen>;
  if (orders.isError && !orders.data) return <Screen><StateView kind="error" title={t('loadError')} onRetry={() => void orders.refetch()} /></Screen>;
  return <Screen scroll={false}>
    <FlatList data={orders.data ?? []} keyExtractor={order => order.id} contentContainerStyle={{ gap: 14, paddingBottom: 28 }}
      ListHeaderComponent={<View style={{ gap: 12 }}><Title>{t('orders')}</Title>{orders.isError && <Body style={{ color: colors.danger }}>{t('requestError')}</Body>}</View>}
      ListEmptyComponent={<View style={{ gap: 16 }}><StateView kind="empty" title={t('ordersEmpty')} message={t('ordersEmptyBody')} /><Button title={t('shop')} onPress={() => router.push('/(tabs)/shop')} /></View>}
      refreshing={orders.isRefetching} onRefresh={() => void orders.refetch()}
      renderItem={({ item: order }) => <Pressable accessibilityRole="button" accessibilityLabel={t('orderNumber', { number: order.orderNumber })} onPress={() => router.push({ pathname: '/orders/[id]', params: { id: order.id } })}><Card><View style={{ gap: 8 }}><Body style={{ fontWeight: '600' }}>{t('orderNumber', { number: order.orderNumber })}</Body><Body style={{ color: colors.mutedText }}>{formatDate(order.createdAt, locale)} · {t('status_' + order.status)}</Body><Body style={{ color: order.paymentStatus === 'PAID' ? colors.success : order.paymentStatus === 'FAILED' ? colors.danger : colors.warning }}>{t('payment_' + order.paymentStatus)}</Body><Body>{formatPrice(order.totalAmount, locale)}</Body><Body style={{ color: colors.accentText }}>{t('orderDetails')} →</Body></View></Card></Pressable>}
    />
  </Screen>;
}
export default function OrdersScreen() { return <RequireAuth><OrdersContent /></RequireAuth>; }