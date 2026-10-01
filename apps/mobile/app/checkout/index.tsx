import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { spacing, typography } from '@wardrobe/theme';
import { Icon } from '../../components/Icon';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { PaymentMethod, type CartItem, type PromoPreview } from '@wardrobe/types';
import { formatPrice } from '@wardrobe/utils';
import { isAddress, isUzPhone, normalizeUzPhone } from '@wardrobe/validation';
import { RequireAuth } from '../../components/RequireAuth';
import { Body, Button, Card, Field, Screen, Skeleton, StateView, Title } from '../../components/ui';
import { useTheme } from '../../hooks/useTheme';
import { imageUrl, mobileApi } from '../../services/api';
import { queryClient } from '../../services/query-client';
import { useAuth } from '../../store/auth';
import { productTitle, selectedStock } from '../../features/catalog/model';

type DeliveryForm = { address: string; city: string; phone: string; note: string };
function available(item: CartItem): number {
  if (!item.product?.isActive) return 0;
  return Math.max(0, selectedStock(item.product, item.size ?? undefined, item.color ?? undefined));
}
function CheckoutContent() {
  const { t, i18n } = useTranslation('commerce');
  const locale = i18n.language === 'ru' ? 'ru' : 'uz';
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ items?: string | string[] }>();
  const rawItems = Array.isArray(params.items) ? params.items[0] : params.items;
  const itemIds = rawItems === undefined ? undefined : rawItems.split(',').filter(Boolean);
  const sessionKey = useAuth(state => state.sessionKey);
  const user = useAuth(state => state.user);
  const cart = useQuery({ queryKey: ['private', sessionKey, 'cart'], queryFn: ({ signal }) => mobileApi.cart(signal) });
  const items = (cart.data ?? []).filter(item => itemIds === undefined || itemIds.includes(item.id));
  const selectedSignature = items.map(item => item.id + ':' + item.quantity + ':' + item.unitPrice).join('|');
  const total = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const invalidStock = items.some(item => !item.product || item.quantity > available(item));
  const [saveAddress, setSaveAddress] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [promoPreview, setPromoPreview] = useState<PromoPreview | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [profileFailed, setProfileFailed] = useState(false);
  const submitting = useRef(false);
  const form = useForm<DeliveryForm>({ defaultValues: { address: user?.address ?? '', city: '', phone: user?.phone ?? '', note: '' } });
  const phone = form.watch('phone');
  useEffect(() => {
    const current = useAuth.getState().user;
    form.reset({ address: current?.address ?? '', city: '', phone: current?.phone ?? '', note: '' });
    setSaveAddress(false); setPromoCode(''); setPromoPreview(null);
    setUncertain(false); setCreatedId(null); setProfileFailed(false);
  }, [sessionKey, form]);
  useEffect(() => {
    if (!form.getFieldState('address').isDirty && user?.address) form.setValue('address', user.address);
    if (!form.getFieldState('phone').isDirty && user?.phone) form.setValue('phone', user.phone);
  }, [user?.address, user?.phone, form]);
  useEffect(() => { setPromoPreview(null); }, [promoCode, phone, selectedSignature]);
  const promo = useMutation({
    mutationFn: async (input: { code: string; phone: string; ids: string[]; signature: string }) => {
      if (!isUzPhone(input.phone)) { form.setError('phone', { message: t('invalidPhone') }); return null; }
      return { preview: await mobileApi.checkPromo({ code: input.code, phone: normalizeUzPhone(input.phone), itemIds: input.ids }), input };
    },
    onSuccess: result => {
      if (useAuth.getState().sessionKey === sessionKey && result
        && result.input.code === promoCode.trim() && normalizeUzPhone(result.input.phone) === normalizeUzPhone(form.getValues('phone'))
        && result.input.signature === selectedSignature) setPromoPreview(result.preview);
    },
  });
  const create = useMutation({
    retry: false,
    mutationFn: async (values: DeliveryForm) => {
      if (submitting.current || uncertain || createdId || items.length === 0 || invalidStock) return null;
      submitting.current = true;
      setProfileFailed(false);
      let attemptedOrder = false;
      try {
        if (saveAddress) {
          await mobileApi.updateProfile({ address: values.address.trim() });
          if (useAuth.getState().sessionKey !== sessionKey) return null;
          await useAuth.getState().reloadProfile();
        }
        attemptedOrder = true;
        const order = await mobileApi.createOrder({
          deliveryAddress: values.address.trim(), deliveryCity: values.city.trim() || undefined,
          phone: normalizeUzPhone(values.phone), note: values.note.trim() || undefined,
          paymentMethod: PaymentMethod.CASH, itemIds: items.map(item => item.id),
          promoCode: promoCode.trim() || undefined,
        });
        if (useAuth.getState().sessionKey !== sessionKey) return null;
        setCreatedId(order.id);
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['private', sessionKey, 'cart'] }),
          queryClient.invalidateQueries({ queryKey: ['private', sessionKey, 'orders'] }),
        ]);
        queryClient.setQueryData(['private', sessionKey, 'order', order.id], order);
        return order;
      } catch (error) {
        // With no server idempotency key, a missing/partial response cannot prove
        // that creation failed. This screen never automatically resubmits it.
        if (useAuth.getState().sessionKey === sessionKey) {
          if (attemptedOrder) setUncertain(true);
          else setProfileFailed(true);
        }
        throw error;
      } finally { submitting.current = false; }
    },
    onSuccess: order => {
      if (order && useAuth.getState().sessionKey === sessionKey) router.replace({ pathname: '/orders/[id]', params: { id: order.id } });
    },
  });
  const locked = create.isPending || uncertain || !!createdId;
  if (cart.isPending) return <Screen><Title>{t('checkout')}</Title><Skeleton /><Skeleton /></Screen>;
  if (cart.isError && !cart.data) return <Screen><StateView kind="error" title={t('loadError')} onRetry={() => void cart.refetch()} /></Screen>;
  if (createdId) return <Screen><StateView kind="empty" title={t('submitted')} /><Button title={t('orderDetails')} onPress={() => router.replace({ pathname: '/orders/[id]', params: { id: createdId } })} /></Screen>;
  if (uncertain) return <Screen><StateView kind="error" title={t('uncertainTitle')} message={t('uncertainBody')} /><Button title={t('verifyOrders')} onPress={() => router.replace('/orders')} /></Screen>;
  if (items.length === 0) return <Screen><StateView kind="empty" title={t('cartEmpty')} message={t('noSelectedItems')} /><Button title={t('cart')} onPress={() => router.replace('/(tabs)/cart')} /></Screen>;
  return <Screen>
    <Title>{t('checkout')}</Title>
    {invalidStock && <Body style={{ color: colors.danger }}>{t('stockWarning')}</Body>}
    <Card style={{ padding: spacing.xxl, gap: spacing.xl }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}><Icon name="truck" size={18} color={colors.mutedText} /><Body style={{ fontFamily: typography.bold, fontSize: 14, letterSpacing: 0.5 }}>{t('deliveryInfo').toLocaleUpperCase(locale)}</Body></View>
      <Controller control={form.control} name="address" rules={{ validate: value => isAddress(value) || t('invalidAddress') }} render={({ field, fieldState }) => <Field label={t('address')} placeholder={t('addressPlaceholder')} value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={fieldState.error?.message} editable={!locked} autoComplete="street-address" multiline />} />
      <Controller control={form.control} name="city" render={({ field }) => <Field label={t('city')} value={field.value} onChangeText={field.onChange} editable={!locked} textContentType="addressCity" />} />
      <Controller control={form.control} name="phone" rules={{ validate: value => isUzPhone(value) || t('invalidPhone') }} render={({ field, fieldState }) => <Field label={t('phone')} value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={fieldState.error?.message} editable={!locked} keyboardType="phone-pad" autoComplete="tel" />} />
      <Controller control={form.control} name="note" render={({ field }) => <Field label={t('note')} placeholder={t('notePlaceholder')} value={field.value} onChangeText={field.onChange} editable={!locked} multiline />} />
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: saveAddress }} disabled={locked} onPress={() => setSaveAddress(value => !value)}
        style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, paddingVertical: spacing.sm }}>
        <View style={{ width: 20, height: 20, borderWidth: 1, borderColor: saveAddress ? colors.accent : colors.border,
          backgroundColor: saveAddress ? colors.accent : colors.input, borderRadius: 4, justifyContent: 'center', alignItems: 'center' }}>
          {saveAddress && <Icon name="check" size={14} color={colors.onAccent} />}
        </View><View style={{ flex: 1, gap: spacing.xs }}><Body>{t('saveAddress')}</Body><Body style={{ color: colors.mutedText, fontSize: 12 }}>{t('savedAddressHint')}</Body></View>
      </Pressable>
    </Card>
    {profileFailed && <Body style={{ color: colors.danger }}>{t('profileSaveError')}</Body>}
    <Card style={{ padding: spacing.xxl, gap: spacing.lg }}>
      <Body style={{ fontFamily: typography.bold, fontSize: 14, letterSpacing: 0.5 }}>{t('orderSummary').toLocaleUpperCase(locale)}</Body>
      {items.map(item => <View key={item.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Image source={imageUrl(item.product?.images[0])} contentFit="cover" style={{ width: 56, height: 64, borderRadius: 8, backgroundColor: colors.input }} />
        <View style={{ flex: 1, minWidth: 0, gap: spacing.xs }}><Body numberOfLines={2} style={{ fontFamily: typography.semibold }}>{item.product ? productTitle(item.product, locale) : t('unavailable')}</Body>
          <Body style={{ color: colors.mutedText, fontSize: 12 }}>{[item.size, item.color].filter(Boolean).join(' · ')} · {item.quantity}</Body></View>
        <Body style={{ fontSize: 12, fontFamily: typography.semibold, textAlign: 'right', maxWidth: 90 }}>{formatPrice(item.unitPrice * item.quantity, locale)}</Body>
      </View>)}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }}><Body>{t('subtotal')}</Body><Body>{formatPrice(total, locale)}</Body></View>
      <View style={{ borderTopWidth: 1, borderColor: colors.border, paddingTop: spacing.lg, gap: spacing.sm }}>
        <Body style={{ fontSize: 12, fontFamily: typography.semibold, color: colors.mutedText }}>{t('promo')}</Body>
        <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-end' }}>
          <View style={{ flex: 1 }}><Field accessibilityLabel={t('promo')} placeholder={t('promoPlaceholder')} value={promoCode} onChangeText={value => { setPromoCode(value); promo.reset(); }} editable={!locked && !promo.isPending} autoCapitalize="characters" /></View>
          <Button title={t('applyPromo')} variant="secondary" loading={promo.isPending} disabled={locked || !promoCode.trim() || !items.length}
            onPress={() => promo.mutate({ code: promoCode.trim(), phone, ids: items.map(item => item.id), signature: selectedSignature })} style={{ paddingHorizontal: spacing.md }} />
        </View>
        {promo.isError && <Body style={{ color: colors.danger }}>{t('requestError')}</Body>}
        {promoPreview && <Body style={{ color: promoPreview.valid ? colors.success : colors.danger }}>{t(promoPreview.valid ? 'promoValid' : 'promoInvalid')}</Body>}
        {promoPreview?.valid && <Body>{t('discount')}: {formatPrice(promoPreview.discount, locale)}</Body>}
      </View>
      <View style={{ borderTopWidth: 1, borderColor: colors.border, paddingTop: spacing.lg, flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.sm }}>
        <Body style={{ fontFamily: typography.bold, fontSize: 16 }}>{t('total')}</Body><Body style={{ fontFamily: typography.bold, fontSize: 16 }}>{formatPrice(promoPreview?.valid ? promoPreview.total : total, locale)}</Body>
      </View>
      <Body style={{ color: colors.mutedText, fontSize: 12 }}>{t('estimateHint')}</Body>
      <Button title={t('placeOrder')} loading={create.isPending} disabled={locked || invalidStock || cart.isFetching || promo.isPending} onPress={() => void form.handleSubmit(values => create.mutate(values))()} />
      <View style={{ gap: spacing.sm }}><Body style={{ fontFamily: typography.semibold }}>{t('manualPayment')}</Body><Body style={{ color: colors.mutedText, fontSize: 12 }}>{t('manualPaymentHint')}</Body></View>
    </Card>
  </Screen>;
}
export default function CheckoutScreen() { return <RequireAuth><CheckoutContent /></RequireAuth>; }
