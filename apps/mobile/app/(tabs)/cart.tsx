import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { CartItem } from '@wardrobe/types';
import { formatPrice } from '@wardrobe/utils';
import { spacing, radius, typography } from '@wardrobe/theme';
import { Icon } from '../../components/Icon';
import { StorefrontList } from '../../components/StorefrontShell';
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
    <StorefrontList
      data={items}
      keyExtractor={item => item.id}
      ListHeaderComponent={<View style={{ gap: 12, marginBottom: 24 }}>
        <Title>{t('cart')}</Title>
        {items.length > 0 && <Pressable accessibilityRole="button" onPress={() => setSelectedIds(null)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 }}>
          <Icon name="check" size={18} color={colors.accentText} /><Body>{t('selectAll')}</Body>
        </Pressable>}
        {(cart.isError || change.isError) && <Body style={{ color: colors.danger }}>{t('requestError')}</Body>}
      </View>}
      ListEmptyComponent={<View style={{ gap: 16 }}><StateView kind="empty" title={t('cartEmpty')} message={t('cartEmptyBody')} /><Button title={t('shop')} onPress={() => router.push('/(tabs)/shop')} /></View>}
      refreshing={cart.isRefetching}
      onRefresh={() => { change.reset(); void cart.refetch(); }}
      renderItem={({ item, index }) => {
        const checked = selected.some(value => value.id === item.id);
        const stock = available(item);
        return <View style={[styles.itemRow, { borderColor: colors.border, backgroundColor: colors.surface },
          index === 0 && styles.firstRow, index === items.length - 1 && styles.lastRow]}>
          <View style={styles.itemContent}>
            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} accessibilityLabel={t('select')}
              onPress={() => toggle(item.id)} style={styles.checkboxTarget}>
              <View style={[styles.checkbox, { borderColor: checked ? colors.accent : colors.border,
                backgroundColor: checked ? colors.accent : colors.input }]}>
                {checked && <Icon name="check" size={13} color={colors.onAccent} />}
              </View>
            </Pressable>
            <Pressable disabled={!item.product} onPress={() => item.product && router.push({ pathname: '/product/[slug]', params: { slug: item.product.slug } })} style={styles.productLink}>
              {item.product?.images[0] && <Image source={imageUrl(item.product.images[0])} style={[styles.image, { backgroundColor: colors.input }]} contentFit="cover" />}
              <View style={styles.productText}>
                <Body numberOfLines={2} style={styles.itemTitle}>{item.product ? productTitle(item.product, locale) : t('unavailable')}</Body>
                <Body numberOfLines={1} style={[styles.variant, { color: colors.accentText }]}>{[item.size, item.color].filter(Boolean).join(' · ')}</Body>
              </View>
            </Pressable>
            <Body numberOfLines={2} style={styles.lineTotal}>{formatPrice(item.unitPrice * item.quantity, locale)}</Body>
          </View>
          <View style={styles.actions}>
            <View style={[styles.stepper, { borderColor: colors.border }]}>
              <Pressable accessibilityRole="button" accessibilityLabel={t('decrease')} disabled={change.isPending || item.quantity <= 1}
                onPress={() => change.mutate({ id: item.id, quantity: item.quantity - 1 })}
                style={[styles.stepperButton, { opacity: change.isPending || item.quantity <= 1 ? 0.4 : 1 }]}><Icon name="minus" size={13} color={colors.text} /></Pressable>
              <Body accessibilityLabel={t('quantity')} style={styles.quantity}>{item.quantity}</Body>
              <Pressable accessibilityRole="button" accessibilityLabel={t('increase')} disabled={change.isPending || item.quantity >= stock}
                onPress={() => change.mutate({ id: item.id, quantity: item.quantity + 1 })}
                style={[styles.stepperButton, { opacity: change.isPending || item.quantity >= stock ? 0.4 : 1 }]}><Icon name="plus" size={13} color={colors.text} /></Pressable>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={t('remove')} disabled={change.isPending}
              onPress={() => change.mutate({ id: item.id })} style={styles.remove}><Icon name="trash" size={18} color={colors.text} /></Pressable>
          </View>
          {(!item.product || stock === 0 || item.quantity > stock) && <Body style={{ color: colors.danger }}>{t(stock === 0 ? 'unavailable' : 'stockWarning')}</Body>}
        </View>;
      }}
      ListFooterComponent={items.length > 0 ? <Card style={styles.summary}>
        <Body style={styles.summaryTitle}>{t('orderSummary').toLocaleUpperCase(locale)}</Body>
        <View style={styles.summaryRow}><Body>{t('selectedProducts')}</Body><Body style={styles.bold}>{selected.length} / {items.length}</Body></View>
        <View style={styles.summaryRow}><Body>{t('subtotal')}</Body><Body>{formatPrice(total, locale)}</Body></View>
        <View style={[styles.totalRow, { borderColor: colors.border }]}><Body style={styles.totalLabel}>{t('total')}</Body><Body style={styles.totalLabel}>{formatPrice(total, locale)}</Body></View>
        <Body style={{ color: colors.mutedText, fontSize: 12 }}>{t('stockHint')}</Body>
        <Button title={t('checkout')} disabled={selected.length === 0 || invalidSelection || change.isPending || cart.isFetching}
          onPress={() => router.push({ pathname: '/checkout', params: { items: selected.map(item => item.id).join(',') } })} />
      </Card> : null}
    />
  </Screen>;
}
export default function CartScreen() { return <RequireAuth><CartContent /></RequireAuth>; }
const styles = StyleSheet.create({
  itemRow: { borderWidth: 1, borderTopWidth: 0, padding: spacing.lg },
  firstRow: { borderTopWidth: 1, borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card },
  lastRow: { borderBottomLeftRadius: radius.card, borderBottomRightRadius: radius.card },
  itemContent: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  checkboxTarget: { width: 26, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  productLink: { flex: 1, minWidth: 0, flexDirection: 'row', gap: spacing.md },
  image: { width: 72, height: 80, borderRadius: 12 }, productText: { flex: 1, minWidth: 0, gap: spacing.xs },
  itemTitle: { fontFamily: typography.semibold, fontSize: 14, lineHeight: 20 }, variant: { fontSize: 12, lineHeight: 18 },
  lineTotal: { width: 90, fontFamily: typography.bold, fontSize: 13, textAlign: 'right', lineHeight: 20 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginLeft: 106, marginTop: spacing.sm },
  stepper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: radius.pill },
  stepperButton: { minWidth: 28, minHeight: 36, alignItems: 'center', justifyContent: 'center' },
  quantity: { minWidth: 20, textAlign: 'center', fontSize: 12, fontFamily: typography.semibold },
  remove: { minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'flex-end' },
  summary: { marginTop: 40, padding: spacing.xxl, gap: spacing.lg },
  summaryTitle: { fontFamily: typography.bold, fontSize: 14, letterSpacing: 0.5 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  bold: { fontFamily: typography.semibold }, totalRow: { borderTopWidth: 1, paddingTop: spacing.lg, flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.sm },
  totalLabel: { fontFamily: typography.bold, fontSize: 16, lineHeight: 24 },
});
