import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { formatDate, formatPrice } from '@wardrobe/utils';
import { spacing, typography } from '@wardrobe/theme';
import { RequireAuth } from '../../components/RequireAuth';
import { Body, Button, Card, Screen, Skeleton, StateView, Title } from '../../components/ui';
import { StorefrontList } from '../../components/StorefrontShell';
import { Icon } from '../../components/Icon';
import { useTheme } from '../../hooks/useTheme';
import { imageUrl, mobileApi } from '../../services/api';
import { useAuth } from '../../store/auth';

function OrdersContent() {
  const { t, i18n } = useTranslation('commerce');
  const locale = i18n.language === 'ru' ? 'ru' : 'uz';
  const { colors } = useTheme();
  const router = useRouter();
  const sessionKey = useAuth(state => state.sessionKey);
  const [filter, setFilter] = useState<'all' | 'paid' | 'unpaid'>('all');
  const orders = useQuery({ queryKey: ['private', sessionKey, 'orders'], queryFn: ({ signal }) => mobileApi.orders(signal) });
  const visibleOrders = (orders.data ?? []).filter(order => filter === 'all' || (filter === 'paid' ? order.paymentStatus === 'PAID' : order.paymentStatus !== 'PAID'));
  if (orders.isPending) return <Screen><Title>{t('orders')}</Title><Skeleton height={180} /><Skeleton height={180} /></Screen>;
  if (orders.isError && !orders.data) return <Screen><StateView kind="error" title={t('loadError')} onRetry={() => void orders.refetch()} /></Screen>;
  return <Screen scroll={false}>
    <StorefrontList data={visibleOrders} keyExtractor={order => order.id} contentContainerStyle={{ gap: spacing.md }}
      ListHeaderComponent={<View style={{ gap: spacing.xxl, marginBottom: spacing.sm }}>
        <Title>{t('orders')}</Title>
        <View style={[styles.filters, { borderColor: colors.border }]}>{(['all', 'paid', 'unpaid'] as const).map(choice =>
          <Pressable key={choice} accessibilityRole="tab" accessibilityState={{ selected: choice === filter }} onPress={() => setFilter(choice)}
            style={[styles.filterButton, { borderBottomColor: choice === filter ? colors.accent : 'transparent' }]}>
            <Body style={[styles.filterText, { color: choice === filter ? colors.accentText : colors.mutedText }]}>{t(choice + 'Orders')}</Body>
          </Pressable>)}</View>
        {orders.isError && <Body style={{ color: colors.danger }}>{t('requestError')}</Body>}
      </View>}
      ListEmptyComponent={<View style={{ gap: spacing.lg }}><Card><StateView kind="empty" title={t('ordersEmpty')} message={t('ordersEmptyBody')} /></Card><Button title={t('shop')} onPress={() => router.push('/(tabs)/shop')} /></View>}
      refreshing={orders.isRefetching} onRefresh={() => void orders.refetch()}
      renderItem={({ item: order }) => {
        const paymentColor = order.paymentStatus === 'PAID' ? colors.success : order.paymentStatus === 'FAILED' ? colors.danger : colors.warning;
        return <Pressable accessibilityRole="button" accessibilityLabel={t('orderNumber', { number: order.orderNumber })}
          onPress={() => router.push({ pathname: '/orders/[id]', params: { id: order.id } })} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
          <Card style={{ gap: spacing.md }}>
            <View style={styles.orderHeading}><Body style={styles.orderNumber}>№ {order.orderNumber}</Body>
              <View style={[styles.paymentBadge, { backgroundColor: colors.input }]}>
                <Icon name={order.paymentStatus === 'PAID' ? 'check' : order.paymentStatus === 'FAILED' ? 'x' : 'package'} size={13} color={paymentColor} />
                <Body style={[styles.paymentText, { color: paymentColor }]}>{t('payment_' + order.paymentStatus)}</Body>
              </View>
            </View>
            <Body style={[styles.date, { color: colors.mutedText }]}>{formatDate(order.createdAt, locale)} · {t('status_' + order.status)}</Body>
            {order.items.map(item => {
              const image = item.product?.colorImages?.find(group => group.color === item.color)?.images[0] || item.product?.images[0];
              return <View key={item.id} style={styles.item}>
                <Image source={imageUrl(image)} style={[styles.image, { backgroundColor: colors.input }]} contentFit="cover" />
                <View style={{ flex: 1, minWidth: 0, gap: spacing.xs }}><Body numberOfLines={2} style={styles.itemTitle}>{item.title} × {item.quantity}</Body>
                  <Body style={[styles.variant, { color: colors.mutedText }]}>{[item.size, formatPrice(item.price, locale)].filter(Boolean).join(' · ')}</Body></View>
              </View>;
            })}
            <View style={styles.footer}><Body style={styles.total}>{formatPrice(order.totalAmount, locale)}</Body>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}><Body style={[styles.details, { color: colors.accentText }]}>{t('orderDetails')}</Body><Icon name="chevronRight" size={14} color={colors.accentText} /></View>
            </View>
          </Card>
        </Pressable>;
      }}
    />
  </Screen>;
}
export default function OrdersScreen() { return <RequireAuth><OrdersContent /></RequireAuth>; }
const styles = StyleSheet.create({
  filters: { flexDirection: 'row', gap: spacing.xxl, borderBottomWidth: 1 },
  filterButton: { borderBottomWidth: 2, minHeight: 44, paddingTop: spacing.sm, paddingBottom: 10 },
  filterText: { fontFamily: typography.semibold, fontSize: 13 },
  orderHeading: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md },
  orderNumber: { flex: 1, fontFamily: typography.bold, fontSize: 16 },
  paymentBadge: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderRadius: 8, paddingHorizontal: 10, paddingVertical: spacing.xs },
  paymentText: { fontFamily: typography.bold, fontSize: 11, lineHeight: 16 }, date: { fontSize: 12, lineHeight: 18 },
  item: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  image: { width: 80, height: 80, borderRadius: 12 }, itemTitle: { fontFamily: typography.semibold, fontSize: 14 },
  variant: { fontSize: 12, lineHeight: 18 }, footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  total: { fontFamily: typography.bold, fontSize: 16 }, details: { fontFamily: typography.semibold, fontSize: 12 },
});
