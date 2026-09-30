import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { formatDate, formatPrice } from '@wardrobe/utils';
import { RequireAuth } from '../../components/RequireAuth';
import { Body, Button, Card, Screen, Skeleton, StateView, Title } from '../../components/ui';
import { useTheme } from '../../hooks/useTheme';
import { mobileApi } from '../../services/api';
import { useAuth } from '../../store/auth';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function telegramContact(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (/^@?[a-zA-Z0-9_]{5,32}$/.test(trimmed)) return 'https://t.me/' + trimmed.replace(/^@/, '');
  try {
    const url = new URL(trimmed);
    return url.protocol === 'https:' && url.hostname === 't.me' && !url.username && !url.password && /^\/[a-zA-Z0-9_]{5,32}\/?$/.test(url.pathname) ? url.toString() : undefined;
  } catch { return undefined; }
}
export function OrderDetail({ id, returned = false }: { id?: string; returned?: boolean }) {
  const { t, i18n } = useTranslation('commerce');
  const locale = i18n.language === 'ru' ? 'ru' : 'uz';
  const { colors } = useTheme();
  const router = useRouter();
  const sessionKey = useAuth(state => state.sessionKey);
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(AppState.currentState === 'active');
  const [linkFailed, setLinkFailed] = useState(false);
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => setActive(state === 'active'));
    return () => subscription.remove();
  }, []);
  const valid = typeof id === 'string' && UUID.test(id);
  const orderQuery = useQuery({
    queryKey: ['private', sessionKey, 'order', id],
    queryFn: ({ signal }) => mobileApi.order(id!, signal),
    enabled: valid && focused,
    staleTime: 0,
    refetchInterval: query => active && focused && query.state.data?.paymentStatus === 'PENDING' && query.state.data?.status !== 'CANCELLED' ? 10000 : false,
    refetchIntervalInBackground: false,
  });
  const settings = useQuery({ queryKey: ['public', 'siteSettings'], queryFn: ({ signal }) => mobileApi.siteSettings(signal), enabled: valid });
  const order = orderQuery.data;
  async function open(url: string) {
    setLinkFailed(false);
    try { await Linking.openURL(url); } catch { setLinkFailed(true); }
  }
  if (!valid) return <Screen><StateView kind="error" title={t('invalidOrder')} /><Button title={t('orders')} onPress={() => router.replace('/orders')} /></Screen>;
  if (orderQuery.isPending) return <Screen><Title>{t('orderDetails')}</Title><Skeleton /><Skeleton /><Skeleton /></Screen>;
  if (orderQuery.isError && !order) return <Screen><StateView kind="error" title={t('orderNotAvailable')} onRetry={() => void orderQuery.refetch()} /><Button title={t('orders')} variant="secondary" onPress={() => router.replace('/orders')} /></Screen>;
  if (!order) return null;
  const username = process.env.EXPO_PUBLIC_TELEGRAM_BOT_USERNAME?.trim().replace(/^@/, '');
  const receiptUrl = username && /^[a-zA-Z0-9_]{5,32}$/.test(username) ? 'https://t.me/' + username + '?start=' + encodeURIComponent('order_' + order.id) : undefined;
  const contactUrl = telegramContact(settings.data?.contactTelegram || settings.data?.socialTelegram);
  const storePhone = settings.data?.contactPhone?.trim();
  const phoneUrl = storePhone && /^\+?[0-9][0-9 ()-]{5,24}$/.test(storePhone) ? 'tel:' + storePhone.replace(/[ ()-]/g, '') : undefined;
  const canPay = order.paymentStatus !== 'PAID' && order.status !== 'CANCELLED';
  const paymentColor = order.paymentStatus === 'PAID' ? colors.success : order.paymentStatus === 'FAILED' ? colors.danger : colors.warning;
  return <Screen>
    <Title>{t('orderNumber', { number: order.orderNumber })}</Title>
    {returned && <Body style={{ color: colors.mutedText }}>{t('returnNotice')}</Body>}
    {orderQuery.isError && <Body style={{ color: colors.danger }}>{t('requestError')}</Body>}
    <Card><View style={{ gap: 8 }}><Body>{t('created')}: {formatDate(order.createdAt, locale)}</Body><Body>{t('status_' + order.status)}</Body><Body style={{ color: paymentColor, fontWeight: '600' }}>{t('payment_' + order.paymentStatus)}</Body><Title>{formatPrice(order.totalAmount, locale)}</Title>{!!order.discountAmount && <Body>{t('discount')}: {formatPrice(order.discountAmount, locale)}</Body>}{order.promoCode && <Body>{t('promo')}: {order.promoCode}</Body>}</View></Card>
    {order.status === 'CANCELLED' && <Body>{t('cancelledHint')}</Body>}
    {order.items.map(item => <Card key={item.id}><View style={{ gap: 6 }}><Body style={{ fontWeight: '600' }}>{item.title}</Body><Body style={{ color: colors.mutedText }}>{[item.size, item.color].filter(Boolean).join(' · ')} · {item.quantity}</Body><Body>{formatPrice(item.price * item.quantity, locale)}</Body></View></Card>)}
    <Card><View style={{ gap: 8 }}><Body style={{ fontWeight: '600' }}>{t('delivery')}</Body><Body>{order.deliveryAddress}</Body>{order.deliveryCity && <Body>{order.deliveryCity}</Body>}<Body>{order.phone}</Body>{order.note && <Body>{order.note}</Body>}</View></Card>
    {canPay && <Card><View style={{ gap: 12 }}><Body style={{ fontWeight: '600' }}>{t(order.paymentStatus === 'FAILED' ? 'paymentFailed' : 'paymentWaiting')}</Body><Body>{t(order.paymentStatus === 'FAILED' ? 'paymentRejectedHint' : 'paymentWaitingHint')}</Body>{order.paymentStatus !== 'FAILED' && settings.data?.paymentCardNumber && <View style={{ gap: 6 }}><Body style={{ color: colors.mutedText }}>{t('cardNumber')}</Body><Body selectable style={{ fontWeight: '600' }}>{settings.data.paymentCardNumber}</Body>{settings.data.paymentCardHolder && <Body>{t('cardHolder')}: {settings.data.paymentCardHolder}</Body>}</View>}{(!settings.data?.paymentCardNumber || !receiptUrl) && <Body style={{ color: colors.mutedText }}>{t('missingPaymentDetails')}</Body>}{order.paymentStatus !== 'FAILED' && receiptUrl && <Button title={t('sendReceipt')} onPress={() => void open(receiptUrl)} />}{contactUrl && <Button title={t('contactStore')} variant="secondary" onPress={() => void open(contactUrl)} />}{!contactUrl && phoneUrl && <Button title={t('contactStore')} variant="secondary" onPress={() => void open(phoneUrl)} />}{!contactUrl && !phoneUrl && <Button title={t('contactStore')} variant="secondary" onPress={() => router.push('/support')} />}</View></Card>}
    {linkFailed && <Body style={{ color: colors.danger }}>{t('openLinkError')}</Body>}
    <Button title={t('refresh')} variant="secondary" loading={orderQuery.isRefetching} onPress={() => void orderQuery.refetch()} />
    <Button title={t('orders')} variant="secondary" onPress={() => router.replace('/orders')} />
  </Screen>;
}
export default function OrderScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  return <RequireAuth><OrderDetail id={id} /></RequireAuth>;
}