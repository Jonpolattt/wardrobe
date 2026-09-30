import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import type { Product } from '@wardrobe/types';
import { formatPrice } from '@wardrobe/utils';
import { usePreferences } from '../store/preferences';
import { useTheme } from '../hooks/useTheme';
import { productTitle } from '../features/catalog/model';
import { Body } from './ui';
import { ProductImage } from './ProductImage';

interface ProductCardProps {
  product: Product;
  onPress?: () => void;
}

export function ProductCard({ product, onPress }: ProductCardProps) {
  const locale = usePreferences((state) => state.locale);
  const { colors } = useTheme();
  const title = productTitle(product, locale);
  const price = product.unitPrice ?? product.price;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress ?? (() => router.push({
        pathname: '/product/[slug]',
        params: { slug: product.slug },
      }))}
      style={styles.card}
    >
      <ProductImage src={product.images[0]} label={title} />
      <Body numberOfLines={2} style={styles.title}>{title}</Body>
      <View style={styles.prices}>
        <Body style={[styles.price, { color: colors.accentText }]}>
          {formatPrice(price, locale)}
        </Body>
        {!!product.oldPrice && product.oldPrice > price && (
          <Body style={[styles.oldPrice, { color: colors.mutedText }]}>
            {formatPrice(product.oldPrice, locale)}
          </Body>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, minWidth: 0, gap: 8 },
  title: { fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 19 },
  prices: { gap: 3 },
  price: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  oldPrice: { fontSize: 11, textDecorationLine: 'line-through' },
});
