import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AccessibilityInfo, Animated, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { Product } from '@wardrobe/types';
import { formatPrice } from '@wardrobe/utils';
import { radius, spacing, storefront, webColors, typography, motion } from '@wardrobe/theme';
import { usePreferences } from '../store/preferences';
import { useAuth } from '../store/auth';
import { useTheme } from '../hooks/useTheme';
import { localizedName, productTitle } from '../features/catalog/model';
import { mobileApi } from '../services/api';
import { Body } from './ui';
import { Icon } from './Icon';
import { ProductImage } from './ProductImage';

interface ProductCardProps {
  product: Product; onPress?: () => void;
  favoriteSelected?: boolean; onFavoritePress?: () => void; favoriteBusy?: boolean;
}

export function ProductCard({ product, onPress, favoriteSelected, onFavoritePress, favoriteBusy }: ProductCardProps) {
  const { t } = useTranslation('catalog');
  const locale = usePreferences((state) => state.locale);
  const { colors, isDark } = useTheme();
  const hasSession = useAuth((state) => state.hasSession);
  const sessionKey = useAuth((state) => state.sessionKey);
  const cache = useQueryClient();
  const [width, setWidth] = useState(160);
  const [imageIndex, setImageIndex] = useState(0);
  const [actionError, setActionError] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;
  const reduceMotion = useRef(true);
  const title = productTitle(product, locale);
  const price = product.unitPrice ?? product.price;
  const discount = !!product.oldPrice && product.oldPrice > price;
  const images = product.images.length ? product.images : [undefined];
  const favorites = useQuery({
    queryKey: ['private', sessionKey, 'wishlist'],
    queryFn: ({ signal }) => mobileApi.wishlist(signal),
    enabled: hasSession,
  });
  const liked = favoriteSelected ?? (favorites.data?.some((item) => item.productId === product.id) ?? false);
  const favorite = useMutation({
    mutationFn: (_input: { sessionKey: string }) => mobileApi.toggleWishlist(product.id),
    onSuccess: (_result, input) => {
      const current = useAuth.getState();
      if (current.hasSession && current.sessionKey === input.sessionKey) {
        setActionError(false);
        void cache.invalidateQueries({ queryKey: ['private', input.sessionKey, 'wishlist'] });
      }
    },
    onError: (_error, input) => {
      if (useAuth.getState().sessionKey === input.sessionKey) setActionError(true);
    },
  });
  useEffect(() => {
    let current = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (current) reduceMotion.current = value; }).catch(() => undefined);
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => { reduceMotion.current = value; });
    return () => { current = false; listener.remove(); };
  }, []);
  useEffect(() => { setActionError(false); favorite.reset(); }, [sessionKey, favorite.reset]);
  const busy = favoriteBusy ?? favorite.isPending;
  const open = onPress ?? (() => router.push({ pathname: '/product/[slug]', params: { slug: product.slug } }));
  function press(active: boolean) {
    if (reduceMotion.current) return;
    Animated.spring(scale, { toValue: active ? 0.985 : 1, ...motion.pressSpring, useNativeDriver: true }).start();
  }

  return <Animated.View style={[styles.card, { backgroundColor: isDark ? webColors.ink[900] : colors.surface, borderColor: colors.border, transform: [{ scale }] }]}>
    <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={open}
      onPressIn={() => press(true)} onPressOut={() => press(false)}>
      <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={styles.gallery}>
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(event) => setImageIndex(Math.round(event.nativeEvent.contentOffset.x / width))}>
          {images.map((src, index) => <ProductImage key={`${src ?? 'fallback'}-${index}`} src={src}
            label={title} style={{ width, borderRadius: 0 }} />)}
        </ScrollView>
        {discount && <View style={[styles.discount, { backgroundColor: colors.accent }]}>
          <Body style={[styles.discountLabel, { color: colors.onAccent }]}>
            -{Math.round(100 - price / product.oldPrice! * 100)}%
          </Body>
        </View>}
        {images.length > 1 && <View pointerEvents="none" style={styles.dots}>
          {images.map((_src, index) => <View key={index} style={[styles.dot, {
            backgroundColor: index === imageIndex ? colors.accent : colors.onAccent,
            opacity: index === imageIndex ? 1 : 0.55,
            transform: [{ scale: index === imageIndex ? 1.2 : 1 }],
          }]} />)}
        </View>}
      </View>
      <View style={styles.info}>
        {!!product.category && <Body numberOfLines={1} style={[styles.category, { color: colors.mutedText }]}>
          {localizedName(product.category, locale)}
        </Body>}
        <View style={styles.prices}>
          <Body style={[styles.price, { color: colors.accentText }]}>{formatPrice(price, locale)}</Body>
          {discount && <Body style={[styles.oldPrice, { color: colors.mutedText }]}>{formatPrice(product.oldPrice!, locale)}</Body>}
        </View>
        <Body numberOfLines={1} style={styles.title}>{title}</Body>
        <Body style={[styles.stock, { color: product.stock === 0 ? colors.danger : product.stock <= 5 ? colors.warning : colors.mutedText }]}>
          {product.stock === 0 ? t('outOfStock') : t('stockLeft', { count: product.stock })}
        </Body>
        <View style={[styles.rating, { opacity: product.rating > 0 ? 1 : 0 }]}>
          <Icon name="star" size={12} color={colors.warning} filled />
          <Body numberOfLines={1} style={[styles.ratingLabel, { color: colors.mutedText }]}>
            {(product.rating ?? 0).toFixed(1)} ({product.reviewsCount ?? 0})
          </Body>
        </View>
      </View>
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel={t(liked ? 'removeFavorite' : 'favorite')}
      accessibilityState={{ selected: liked, busy }} disabled={busy}
      hitSlop={8} onPress={onFavoritePress ?? (() => hasSession ? favorite.mutate({ sessionKey }) : router.push({
        pathname: '/auth/login', params: { returnTo: `/product/${encodeURIComponent(product.slug)}` },
      }))}
      style={({ pressed }) => [styles.heart, { backgroundColor: colors.surface, opacity: pressed ? 0.8 : 0.88 }]}>
      <Icon name="heart" size={16} color={liked ? colors.danger : colors.text} filled={liked} />
    </Pressable>
    <View style={styles.footer}>
      <Pressable accessibilityRole="button" onPress={open} disabled={product.stock === 0}
        style={({ pressed }) => [styles.quickBuy, { backgroundColor: colors.accent, opacity: product.stock === 0 ? 0.4 : pressed ? 0.82 : 1 }]}>
        <Icon name="cart" size={12} color={colors.onAccent} />
        <Body numberOfLines={1} style={[styles.quickBuyLabel, { color: colors.onAccent }]}>{t('quickBuy')}</Body>
      </Pressable>
      {actionError && <Body accessibilityRole="alert" style={[styles.error, { color: colors.danger }]}>{t('actionError')}</Body>}
    </View>
  </Animated.View>;
}
const styles = StyleSheet.create({
  card: { flex: 1, minWidth: 0, overflow: 'hidden', borderWidth: 1, borderRadius: storefront.productRadius },
  gallery: { aspectRatio: 0.75, overflow: 'hidden' },
  heart: { position: 'absolute', top: spacing.md, right: spacing.md, width: 32, height: 32,
    borderRadius: radius.button, justifyContent: 'center', alignItems: 'center' },
  discount: { position: 'absolute', left: spacing.md, top: spacing.md, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: spacing.xs },
  discountLabel: { fontSize: 11, lineHeight: 18, fontFamily: typography.bold },
  dots: { position: 'absolute', left: 8, right: 8, bottom: 8, flexDirection: 'row', gap: 6, justifyContent: 'center' },
  dot: { height: 6, width: 6, borderRadius: 3 },
  info: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.xs },
  category: { fontSize: 11, lineHeight: 16, textTransform: 'uppercase', letterSpacing: 0.7 },
  prices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, alignItems: 'baseline' },
  price: { fontFamily: typography.bold, fontSize: 15, lineHeight: 20 },
  oldPrice: { fontSize: 10, lineHeight: 14, textDecorationLine: 'line-through' },
  title: { fontFamily: typography.semibold, fontSize: 14, lineHeight: 20 },
  stock: { fontFamily: typography.semibold, fontSize: 11, lineHeight: 17 },
  rating: { flexDirection: 'row', gap: spacing.xs, alignItems: 'center', minHeight: 18 },
  ratingLabel: { fontSize: 11, lineHeight: 16 },
  footer: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, paddingTop: 6 },
  quickBuy: { minHeight: 32, borderRadius: radius.button, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: spacing.xs, paddingHorizontal: 6 },
  quickBuyLabel: { fontSize: 10, lineHeight: 16, fontFamily: typography.semibold },
  error: { fontSize: 10, lineHeight: 15, marginTop: spacing.sm },
});