import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { radius, spacing, typography } from '@wardrobe/theme';
import { useTranslation } from 'react-i18next';
import { formatDate, formatPrice } from '@wardrobe/utils';
import { mobileApi } from '../../services/api';
import { usePreferences } from '../../store/preferences';
import { useAuth } from '../../store/auth';
import { useTheme } from '../../hooks/useTheme';
import {
  productDescription, productImages, productTitle, selectedStock,
} from '../../features/catalog/model';
import { Screen, Title, Body, Button, Card, Field, Skeleton, StateView } from '../../components/ui';
import { Choice } from '../../components/Choice';
import { ProductImage } from '../../components/ProductImage';
import { Icon } from '../../components/Icon';
import { localizedName } from '../../features/catalog/model';
import { swatchColor } from '../../features/catalog/color-swatch';
import { translateColorName } from '../../features/catalog/color-names';

interface ProductAction {
  sessionKey: string;
  productId: string;
}
interface CartAction extends ProductAction {
  size?: string;
  color?: string;
  quantity: number;
}
interface ReviewAction extends ProductAction {
  rating: number;
  comment: string;
}

export default function ProductScreen() {
  const params = useLocalSearchParams<{ slug: string }>();
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  const { t } = useTranslation('catalog');
  const locale = usePreferences((state) => state.locale);
  const { colors } = useTheme();
  const hasSession = useAuth((state) => state.hasSession);
  const sessionKey = useAuth((state) => state.sessionKey);
  const cache = useQueryClient();

  const [size, setSize] = useState('');
  const [color, setColor] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [action, setAction] = useState('');
  const [galleryWidth, setGalleryWidth] = useState(320);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const galleryRef = useRef<ScrollView>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');

  const productQuery = useQuery({
    queryKey: ['product', slug],
    queryFn: ({ signal }) => mobileApi.product(slug, signal),
    enabled: !!slug,
  });
  const product = productQuery.data;
  const activeProduct = useRef<string | undefined>(product?.id);
  activeProduct.current = product?.id;

  useEffect(() => {
    if (!product) return;
    const first = product.variants.find((variant) => variant.stock > 0) ?? product.variants[0];
    setSize(first?.size ?? product.sizes[0] ?? '');
    setColor(first?.color ?? product.colors[0] ?? '');
    setQuantity(1);
    setAction('');
    setRating(5);
    setComment('');
    // Preserve the user's selected variant when the same product is refreshed.
  }, [product?.id]);

  useEffect(() => {
    setGalleryIndex(0);
    galleryRef.current?.scrollTo({ x: 0, animated: false });
  }, [color, product?.id]);

  const quote = useQuery({
    queryKey: ['product-quote', product?.id, size, color],
    queryFn: ({ signal }) => mobileApi.quote(
      product!.id, size || undefined, color || undefined, signal,
    ),
    enabled: !!product?.id,
  });
  const favorites = useQuery({
    queryKey: ['private', sessionKey, 'wishlist'],
    queryFn: ({ signal }) => mobileApi.wishlist(signal),
    enabled: hasSession,
  });
  const reviews = useQuery({
    queryKey: ['reviews', product?.id],
    queryFn: ({ signal }) => mobileApi.reviews(product!.id, signal),
    enabled: !!product?.id,
  });
  const eligible = useQuery({
    queryKey: ['private', sessionKey, 'can-review', product?.id],
    queryFn: ({ signal }) => mobileApi.canReview(product!.id, signal),
    enabled: hasSession && !!product?.id,
  });

  function isCurrentAction(input: ProductAction) {
    const current = useAuth.getState();
    return current.hasSession
      && current.sessionKey === input.sessionKey
      && activeProduct.current === input.productId;
  }

  const add = useMutation({
    mutationFn: ({ productId, size, color, quantity }: CartAction) => (
      mobileApi.addCart({ productId, size, color, quantity })
    ),
    onSuccess: (_result, input) => {
      if (!isCurrentAction(input)) return;
      setAction(t('added'));
      void cache.invalidateQueries({ queryKey: ['private', input.sessionKey, 'cart'] });
    },
    onError: (_error, input) => {
      if (isCurrentAction(input)) setAction(t('actionError'));
    },
  });
  const favorite = useMutation({
    mutationFn: ({ productId }: ProductAction) => mobileApi.toggleWishlist(productId),
    onSuccess: (_result, input) => {
      if (isCurrentAction(input)) {
        void cache.invalidateQueries({ queryKey: ['private', input.sessionKey, 'wishlist'] });
      }
    },
    onError: (_error, input) => {
      if (isCurrentAction(input)) setAction(t('actionError'));
    },
  });
  const review = useMutation({
    mutationFn: ({ productId, rating, comment }: ReviewAction) => (
      mobileApi.createReview({ productId, rating, comment })
    ),
    onSuccess: (_result, input) => {
      if (!isCurrentAction(input)) return;
      setComment('');
      setAction(t('reviewSent'));
      void cache.invalidateQueries({ queryKey: ['reviews', input.productId] });
      void cache.invalidateQueries({ queryKey: ['product', slug] });
    },
    onError: (_error, input) => {
      if (isCurrentAction(input)) setAction(t('actionError'));
    },
  });

  useEffect(() => {
    // A replacement/logout must not inherit another account's review draft or feedback.
    setRating(5);
    setComment('');
    setAction('');
    add.reset();
    favorite.reset();
    review.reset();
  }, [sessionKey, add.reset, favorite.reset, review.reset]);

  function login() {
    router.push({
      pathname: '/auth/login',
      params: { returnTo: `/product/${encodeURIComponent(slug)}` },
    });
  }

  function chooseSize(next: string) {
    setSize(next);
    setQuantity(1);
    if (product!.variants.length && !product!.variants.some(
      (variant) => variant.size === next && variant.color === color && variant.stock > 0,
    )) {
      const first = product!.variants.find((variant) => variant.size === next && variant.stock > 0);
      if (first) setColor(first.color);
    }
  }

  function chooseColor(next: string) {
    setColor(next);
    setQuantity(1);
    if (product!.variants.length && !product!.variants.some(
      (variant) => variant.color === next && variant.size === size && variant.stock > 0,
    )) {
      const first = product!.variants.find((variant) => variant.color === next && variant.stock > 0);
      if (first) setSize(first.size);
    }
  }

  if (productQuery.isPending) {
    return <Screen><StateView kind="loading" /></Screen>;
  }
  if (productQuery.isError || !product) {
    return <Screen><StateView kind="error" onRetry={() => void productQuery.refetch()} /></Screen>;
  }
  if (!product.isActive) {
    return <Screen><StateView kind="empty" title={t('outOfStock')} /></Screen>;
  }

  const stock = selectedStock(product, size, color);
  const images = productImages(product, color);
  const title = productTitle(product, locale);
  const description = productDescription(product, locale);
  const liked = favorites.data?.some((item) => item.productId === product.id);

  const discount = !!product.oldPrice && quote.data !== undefined && product.oldPrice > quote.data;
  return (
    <Screen contentContainerStyle={styles.detailContent}>
      <View style={styles.galleryBlock}>
        <View style={styles.gallery} onLayout={(event) => setGalleryWidth(event.nativeEvent.layout.width)}>
          <ScrollView ref={galleryRef} horizontal pagingEnabled showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(event) => setGalleryIndex(Math.round(event.nativeEvent.contentOffset.x / galleryWidth))}>
            {(images.length ? images : [undefined]).map((src, index) => <ProductImage key={String(src ?? 'fallback') + index}
              src={src} label={title} aspectRatio={0.75} style={{ width: galleryWidth, borderRadius: 0 }} />)}
          </ScrollView>
          {images.length > 1 && <View style={styles.galleryIndicators}>
            {images.map((_src, index) => <Pressable key={index} accessibilityRole="button" accessibilityLabel={String(index + 1)}
              accessibilityState={{ selected: index === galleryIndex }} hitSlop={10}
              onPress={() => { setGalleryIndex(index); galleryRef.current?.scrollTo({ x: index * galleryWidth, animated: true }); }}
              style={[styles.galleryIndicator, { width: index === galleryIndex ? 20 : 6,
                backgroundColor: index === galleryIndex ? colors.accent : colors.onAccent, opacity: index === galleryIndex ? 1 : 0.55 }]} />)}
          </View>}
        </View>
        {images.length > 1 && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbnails}>
          {images.map((src, index) => <Pressable key={src + index} accessibilityRole="button" accessibilityLabel={title + ' ' + (index + 1)}
            accessibilityState={{ selected: index === galleryIndex }} onPress={() => { setGalleryIndex(index); galleryRef.current?.scrollTo({ x: index * galleryWidth, animated: true }); }}
            style={[styles.thumbnail, { borderColor: index === galleryIndex ? colors.accent : colors.border }]}>
            <ProductImage src={src} label={title} aspectRatio={1} style={styles.thumbnailImage} />
          </Pressable>)}
        </ScrollView>}
      </View>
      <View style={styles.productInfo}>
        {!!product.category && <Body style={[styles.category, { color: colors.mutedText }]}>
          {localizedName(product.category, locale)}{product.brand ? ' · ' + product.brand.name : ''}
        </Body>}
        <Title style={styles.productTitle}>{title}</Title>
        <View style={styles.priceRow}>
          {quote.isPending ? <Skeleton width={150} height={30} /> : quote.isError
            ? <StateView kind="error" onRetry={() => void quote.refetch()} />
            : <Title style={styles.currentPrice}>{formatPrice(quote.data, locale)}</Title>}
          {discount && <><Body style={[styles.oldPrice, { color: colors.mutedText }]}>{formatPrice(product.oldPrice!, locale)}</Body>
            <View style={[styles.discountBadge, { backgroundColor: colors.accent + '26' }]}><Body style={[styles.discountText, { color: colors.accentText }]}>
              -{Math.round(100 - quote.data! / product.oldPrice! * 100)}%
            </Body></View></>}
        </View>
        <Body style={[styles.metadata, { color: colors.mutedText }]}>
          {product.stock ? t('totalStock') + ' ' + t('stockLeft', { count: product.stock }) : t('outOfStock')}
          {' · '}{product.reviewsCount} {t('reviews')}
        </Body>
        <View style={[styles.productOptions, { borderTopColor: colors.border }]}>
          {!!product.sizes.length && <View style={styles.optionGroup}>
            <Body style={[styles.optionLabel, { color: colors.mutedText }]}>{t('size')}</Body>
            <View style={styles.variants}>{product.sizes.map((option) => <Choice key={option} title={option}
              selected={option === size} onPress={() => chooseSize(option)}
              disabled={product.variants.length > 0 && !product.variants.some((variant) => variant.size === option && variant.stock > 0)} />)}</View>
          </View>}
          {!!product.colors.length && <View style={styles.optionGroup}>
            <Body style={[styles.optionLabel, { color: colors.mutedText }]}>{t('color')}</Body>
            <View style={styles.variants}>{product.colors.map((option) => <Choice key={option} title={translateColorName(option, locale)}
              swatch={swatchColor(option)} selected={option === color} onPress={() => chooseColor(option)}
              disabled={product.variants.length > 0 && !product.variants.some((variant) => variant.color === option && variant.stock > 0)} />)}</View>
          </View>}
          <View style={styles.optionGroup}>
            <Body style={[styles.optionLabel, { color: colors.mutedText }]}>{t('quantity')}</Body>
            <View style={[styles.quantity, { borderColor: colors.border }]}>
              <Pressable accessibilityRole="button" accessibilityLabel={t('quantity') + ' −'} disabled={quantity <= 1}
                onPress={() => setQuantity((current) => current - 1)} style={styles.quantityControl}><Icon name="minus" size={14} color={quantity <= 1 ? colors.mutedText : colors.text} /></Pressable>
              <Body style={styles.quantityValue}>{quantity}</Body>
              <Pressable accessibilityRole="button" accessibilityLabel={t('quantity') + ' +'} disabled={quantity >= stock}
                onPress={() => setQuantity((current) => current + 1)} style={styles.quantityControl}><Icon name="plus" size={14} color={quantity >= stock ? colors.mutedText : colors.text} /></Pressable>
            </View>
            <Body style={[styles.stock, { color: stock === 0 ? colors.danger : stock <= 5 ? colors.warning : colors.mutedText }]}>
              {stock ? t('stockLeft', { count: stock }) : t('variantUnavailable')}
            </Body>
          </View>
          <View style={styles.actions}>
            <Button title={stock ? t('addCart') : t('outOfStock')} style={styles.addButton}
              icon={<Icon name="cart" size={16} color={colors.onAccent} />} loading={add.isPending}
              disabled={!stock || quantity > stock || quote.isPending || quote.isError}
              onPress={() => hasSession ? add.mutate({ sessionKey, productId: product.id, size: size || undefined,
                color: color || undefined, quantity }) : login()} />
            <Pressable accessibilityRole="button" accessibilityLabel={t(liked ? 'removeFavorite' : 'favorite')}
              accessibilityState={{ selected: !!liked, busy: favorite.isPending }} disabled={favorite.isPending}
              onPress={() => hasSession ? favorite.mutate({ sessionKey, productId: product.id }) : login()}
              style={({ pressed }) => [styles.favorite, { borderColor: liked ? colors.danger : colors.border,
                backgroundColor: liked ? colors.danger : 'transparent', opacity: pressed ? 0.75 : 1 }]}>
              <Icon name="heart" size={18} filled={!!liked} color={liked ? colors.onAccent : colors.text} />
            </Pressable>
          </View>
          {!!action && <View style={[styles.feedback, { backgroundColor: colors.input, borderColor: colors.border }]}>
            <Body accessibilityLiveRegion="polite" style={{ color: colors.accentText }}>{action}</Body>
          </View>}
        </View>
        {!!description && <View style={[styles.description, { borderTopColor: colors.border }]}>
          <Title style={styles.descriptionTitle}>{t('description')}</Title><Body style={{ color: colors.mutedText }}>{description}</Body>
        </View>}
      </View>
      <Title style={styles.reviewsTitle}>{t('reviews')}</Title>
      {reviews.isPending ? (
        <StateView kind="loading" />
      ) : reviews.isError ? (
        <StateView kind="error" onRetry={() => void reviews.refetch()} />
      ) : !reviews.data.length ? (
        <Body style={{ color: colors.mutedText }}>{t('noReviews')}</Body>
      ) : reviews.data.map((item) => (
        <Card key={item.id} style={styles.reviewCard}>
          <View style={styles.reviewHeader}>
            <Body style={styles.reviewAuthor}>
              {item.user?.firstName ?? 'Wardrobe'}
            </Body>
            <Body style={[styles.reviewDate, { color: colors.mutedText }]}>
              {formatDate(item.createdAt, locale)}
            </Body>
          </View>
          <View style={styles.reviewStars}>{[1, 2, 3, 4, 5].map((star) => <Icon key={star} name="star" size={13} filled={star <= item.rating} color={star <= item.rating ? colors.warning : colors.border} />)}</View>
          <Body style={{ color: colors.mutedText }}>{item.comment}</Body>
          {!!item.image && <ProductImage src={item.image} aspectRatio={1.5} />}
        </Card>
      ))}

      {hasSession && eligible.data && (
        <Card style={styles.reviewCard}>
          <Title style={styles.reviewFormTitle}>{t('writeReview')}</Title>
          <View style={styles.ratings}>
            {[1, 2, 3, 4, 5].map((option) => (
              <Pressable key={option} accessibilityRole="button" accessibilityLabel={String(option)} accessibilityState={{ selected: rating === option }}
                onPress={() => setRating(option)} style={styles.ratingControl}><Icon name="star" size={24} filled={option <= rating} color={option <= rating ? colors.warning : colors.border} /></Pressable>
            ))}
          </View>
          <Field
            label={t('reviewComment')}
            value={comment}
            onChangeText={setComment}
            multiline
            maxLength={1000}
          />
          <Button
            title={t('writeReview')}
            loading={review.isPending}
            disabled={!comment.trim()}
            onPress={() => review.mutate({
              sessionKey, productId: product.id, rating, comment: comment.trim(),
            })}
          />
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  detailContent: { gap: 0 }, galleryBlock: { marginTop: spacing.xxxl, marginBottom: spacing.section },
  gallery: { aspectRatio: 0.75, overflow: 'hidden', borderRadius: spacing.xxl },
  galleryIndicators: { position: 'absolute', bottom: 12, left: 0, right: 0, flexDirection: 'row', gap: 6, justifyContent: 'center' },
  galleryIndicator: { height: 6, borderRadius: radius.pill }, thumbnails: { gap: spacing.md, paddingTop: spacing.lg },
  thumbnail: { width: 64, height: 64, borderRadius: radius.button, borderWidth: 2, overflow: 'hidden' }, thumbnailImage: { borderRadius: 0 },
  productInfo: { gap: 8 }, category: { fontSize: 12, lineHeight: 18, fontFamily: typography.semibold, textTransform: 'uppercase', letterSpacing: 0.7 },
  productTitle: { fontFamily: typography.medium, fontSize: typography.pageTitle, lineHeight: 38 },
  priceRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: spacing.md, marginTop: spacing.sm },
  currentPrice: { fontFamily: typography.bold, fontSize: 24, lineHeight: 32 }, oldPrice: { fontSize: 16, textDecorationLine: 'line-through' },
  discountBadge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 }, discountText: { fontFamily: typography.bold, fontSize: 12, lineHeight: 18 },
  metadata: { fontSize: 12, lineHeight: 19 }, productOptions: { borderTopWidth: 1, paddingTop: spacing.xxxl, marginTop: spacing.xxl, gap: spacing.xxl },
  optionGroup: { gap: spacing.sm }, optionLabel: { fontSize: 12, lineHeight: 18, fontFamily: typography.semibold, textTransform: 'uppercase', letterSpacing: 0.6 },
  variants: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, quantity: { alignSelf: 'flex-start', flexDirection: 'row', borderWidth: 1, borderRadius: radius.pill, alignItems: 'center' },
  quantityControl: { width: 44, height: 40, alignItems: 'center', justifyContent: 'center' }, quantityValue: { width: 24, textAlign: 'center', fontFamily: typography.semibold },
  stock: { fontFamily: typography.semibold, fontSize: 12, lineHeight: 18 }, actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md }, addButton: { flex: 1 },
  favorite: { height: 48, width: 48, borderRadius: radius.button, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  feedback: { borderWidth: 1, borderRadius: radius.headerControl, padding: spacing.md }, description: { borderTopWidth: 1, marginTop: spacing.xxl, paddingTop: spacing.xxxl, gap: spacing.lg },
  descriptionTitle: { fontSize: 20, lineHeight: 28 }, reviewsTitle: { fontSize: 24, lineHeight: 32, marginTop: spacing.section, marginBottom: spacing.xxl },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }, reviewAuthor: { fontFamily: typography.semibold }, reviewDate: { fontSize: 11 },
  reviewCard: { marginBottom: spacing.lg }, reviewStars: { flexDirection: 'row', gap: 2 }, reviewFormTitle: { fontSize: 18 }, ratings: { flexDirection: 'row', gap: spacing.sm }, ratingControl: { minWidth: 40, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
