import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { formatDate, formatPrice } from '@wardrobe/utils';
import { mobileApi } from '../../services/api';
import { usePreferences } from '../../store/preferences';
import { useAuth } from '../../store/auth';
import { useTheme } from '../../hooks/useTheme';
import {
  productDescription, productImages, productTitle, selectedStock,
} from '../../features/catalog/model';
import { Screen, Title, Body, Button, Card, Field, StateView } from '../../components/ui';
import { Choice } from '../../components/Choice';
import { ProductImage } from '../../components/ProductImage';

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

  return (
    <Screen>
      <View onLayout={(event) => setGalleryWidth(event.nativeEvent.layout.width)}>
        <ScrollView
          ref={galleryRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(event) => setGalleryIndex(
            Math.round(event.nativeEvent.contentOffset.x / galleryWidth),
          )}
        >
          {(images.length ? images : [undefined]).map((src, index) => (
            <View key={`${src ?? 'fallback'}-${index}`} style={{ width: galleryWidth }}>
              <ProductImage src={src} label={title} aspectRatio={0.85} />
            </View>
          ))}
        </ScrollView>
        <View style={styles.galleryIndicators}>
          {images.map((_src, index) => (
            <View
              key={index}
              style={[
                styles.galleryIndicator,
                {
                  width: index === galleryIndex ? 18 : 5,
                  backgroundColor: index === galleryIndex ? colors.text : colors.border,
                },
              ]}
            />
          ))}
        </View>
      </View>

      <Title>{title}</Title>
      <Body style={[styles.metadata, { color: colors.mutedText }]}>
        ★ {product.rating.toFixed(1)} · {product.reviewsCount} {t('reviews')}
      </Body>
      {quote.isPending ? (
        <StateView kind="loading" />
      ) : quote.isError ? (
        <StateView kind="error" onRetry={() => void quote.refetch()} />
      ) : (
        <Title style={{ color: colors.accentText }}>{formatPrice(quote.data, locale)}</Title>
      )}
      {!!product.oldPrice && quote.data !== undefined && product.oldPrice > quote.data && (
        <Body style={[styles.oldPrice, { color: colors.mutedText }]}>
          {formatPrice(product.oldPrice, locale)}
        </Body>
      )}

      {!!product.sizes.length && (
        <>
          <Title style={styles.variantTitle}>{t('size')}</Title>
          <View style={styles.variants}>
            {product.sizes.map((option) => (
              <Choice
                key={option}
                title={option}
                selected={option === size}
                onPress={() => chooseSize(option)}
                disabled={product.variants.length > 0 && !product.variants.some(
                  (variant) => variant.size === option && variant.stock > 0,
                )}
              />
            ))}
          </View>
        </>
      )}
      {!!product.colors.length && (
        <>
          <Title style={styles.variantTitle}>{t('color')}</Title>
          <View style={styles.variants}>
            {product.colors.map((option) => (
              <Choice
                key={option}
                title={option}
                selected={option === color}
                onPress={() => chooseColor(option)}
                disabled={product.variants.length > 0 && !product.variants.some(
                  (variant) => variant.color === option && variant.stock > 0,
                )}
              />
            ))}
          </View>
        </>
      )}

      <Body style={{ color: stock ? colors.mutedText : colors.danger }}>
        {stock ? t('available', { count: stock }) : t('variantUnavailable')}
      </Body>
      <View style={styles.quantity}>
        <Body>{t('quantity')}</Body>
        <Button
          title="−"
          accessibilityLabel={`${t('quantity')} −`}
          variant="secondary"
          disabled={quantity <= 1}
          onPress={() => setQuantity((current) => current - 1)}
        />
        <Body>{quantity}</Body>
        <Button
          title="+"
          accessibilityLabel={`${t('quantity')} +`}
          variant="secondary"
          disabled={quantity >= stock}
          onPress={() => setQuantity((current) => current + 1)}
        />
      </View>
      <Button
        title={stock ? t('addCart') : t('outOfStock')}
        loading={add.isPending}
        disabled={!stock || quantity > stock || quote.isPending || quote.isError}
        onPress={() => hasSession ? add.mutate({
          sessionKey, productId: product.id, size: size || undefined,
          color: color || undefined, quantity,
        }) : login()}
      />
      <Button
        title={`${liked ? '♥' : '♡'} ${t('favorite')}`}
        variant="secondary"
        loading={favorite.isPending}
        onPress={() => hasSession
          ? favorite.mutate({ sessionKey, productId: product.id })
          : login()}
      />
      {!!action && (
        <Card><Body accessibilityLiveRegion="polite">{action}</Body></Card>
      )}
      <Body style={[styles.metadata, { color: colors.mutedText }]}>{t('stockHint')}</Body>
      {!!description && (
        <>
          <Title style={styles.descriptionTitle}>{t('description')}</Title>
          <Body>{description}</Body>
        </>
      )}

      <Title style={styles.reviewsTitle}>{t('reviews')}</Title>
      {reviews.isPending ? (
        <StateView kind="loading" />
      ) : reviews.isError ? (
        <StateView kind="error" onRetry={() => void reviews.refetch()} />
      ) : !reviews.data.length ? (
        <Body style={{ color: colors.mutedText }}>{t('noReviews')}</Body>
      ) : reviews.data.map((item) => (
        <Card key={item.id}>
          <View style={styles.reviewHeader}>
            <Body style={styles.reviewAuthor}>
              {item.user?.firstName ?? 'Wardrobe'} · {'★'.repeat(item.rating)}
            </Body>
            <Body style={[styles.reviewDate, { color: colors.mutedText }]}>
              {formatDate(item.createdAt, locale)}
            </Body>
          </View>
          <Body>{item.comment}</Body>
          {!!item.image && <ProductImage src={item.image} aspectRatio={1.5} />}
        </Card>
      ))}

      {hasSession && eligible.data && (
        <Card>
          <Title style={styles.reviewFormTitle}>{t('writeReview')}</Title>
          <View style={styles.ratings}>
            {[1, 2, 3, 4, 5].map((option) => (
              <Choice
                key={option}
                title={`${option} ★`}
                selected={rating === option}
                onPress={() => setRating(option)}
              />
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
  galleryIndicators: { flexDirection: 'row', gap: 5, justifyContent: 'center', padding: 10 },
  galleryIndicator: { height: 5, borderRadius: 5 },
  metadata: { fontSize: 12 },
  oldPrice: { textDecorationLine: 'line-through' },
  variantTitle: { fontSize: 17 },
  variants: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quantity: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  descriptionTitle: { fontSize: 19 },
  reviewsTitle: { fontSize: 21, marginTop: 8 },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  reviewAuthor: { fontFamily: 'Inter_600SemiBold' },
  reviewDate: { fontSize: 11 },
  reviewFormTitle: { fontSize: 18 },
  ratings: { flexDirection: 'row', gap: 7 },
});
