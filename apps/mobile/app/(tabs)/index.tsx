import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { Banner } from '@wardrobe/types';
import { mobileApi } from '../../services/api';
import { usePreferences } from '../../store/preferences';
import { bannerTitle, localizedName } from '../../features/catalog/model';
import { useTheme } from '../../hooks/useTheme';
import { Screen, Title, Body, Button, Card, StateView } from '../../components/ui';
import { ProductCard } from '../../components/ProductCard';
import { ProductImage } from '../../components/ProductImage';

function bannerRoute(banner: Banner) {
  if (banner.linkType === 'PRODUCT' && banner.productSlug) {
    router.push({ pathname: '/product/[slug]', params: { slug: banner.productSlug } });
  } else if (banner.linkType === 'CATEGORY' && banner.categorySlug) {
    router.push({ pathname: '/(tabs)/shop', params: { categorySlug: banner.categorySlug } });
  } else if (banner.linkType === 'PRODUCTS' && banner.products.length) {
    router.push({
      pathname: '/(tabs)/shop',
      params: { ids: banner.products.map((product) => product.id).join(',') },
    });
  }
}

export default function HomeScreen() {
  const { t } = useTranslation('catalog');
  const { colors } = useTheme();
  const locale = usePreferences((state) => state.locale);
  const home = useQuery({
    queryKey: ['home'],
    queryFn: async ({ signal }) => {
      const [banners, popular, arrivals, categories, settings] = await Promise.all([
        mobileApi.banners(signal),
        mobileApi.bestSellers(signal),
        mobileApi.products({ sort: 'NEWEST', page: 1, limit: 6 }, signal),
        mobileApi.categories(signal),
        mobileApi.siteSettings(signal),
      ]);
      return { banners, popular, arrivals: arrivals.list, categories, settings };
    },
  });

  if (home.isPending) {
    return <Screen><StateView kind="loading" /></Screen>;
  }
  if (home.isError && !home.data) {
    return <Screen><StateView kind="error" onRetry={() => void home.refetch()} /></Screen>;
  }

  const data = home.data!;
  const banner = data.banners[0];
  const collectionTitle = banner ? bannerTitle(banner, locale) : '';
  const sections = [
    { title: t('popular'), items: data.popular },
    { title: t('arrivals'), items: data.arrivals },
  ];

  return (
    <Screen>
      <View style={styles.introduction}>
        <Body style={styles.wordmark}>WARDROBE</Body>
        <Title>{t('homeTitle')}</Title>
        <Body style={{ color: colors.mutedText }}>{t('homeSubtitle')}</Body>
      </View>

      {(banner || data.settings.heroImage) && (
        <Pressable
          accessibilityRole="button"
          onPress={() => banner && bannerRoute(banner)}
          disabled={!banner || banner.linkType === 'NONE'}
        >
          <ProductImage
            src={banner?.image ?? data.settings.heroImage}
            aspectRatio={1.5}
            label={t('collection')}
          />
          {!!collectionTitle && <Title style={styles.collectionTitle}>{collectionTitle}</Title>}
        </Pressable>
      )}

      <Button title={t('shop')} onPress={() => router.push('/(tabs)/shop')} />
      <View style={styles.sectionHeader}>
        <Title style={styles.sectionTitle}>{t('categories')}</Title>
        <Pressable accessibilityRole="button" onPress={() => router.push('/categories')}>
          <Body style={{ color: colors.accentText }}>{t('viewAll')}</Body>
        </Pressable>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryList}
      >
        {data.categories.map((category) => {
          const title = localizedName(category, locale);
          return (
            <Pressable
              key={category.id}
              accessibilityRole="button"
              accessibilityLabel={title}
              onPress={() => router.push({
                pathname: '/(tabs)/shop',
                params: { categorySlug: category.slug },
              })}
              style={styles.category}
            >
              <ProductImage src={category.image} aspectRatio={1} label={title} />
              <Body numberOfLines={2} style={styles.categoryTitle}>{title}</Body>
            </Pressable>
          );
        })}
      </ScrollView>

      {sections.map((section) => (
        <View key={section.title} style={styles.section}>
          <Title style={styles.sectionTitle}>{section.title}</Title>
          {section.items.length ? (
            <View style={styles.productGrid}>
              {section.items.map((product) => (
                <View key={product.id} style={styles.product}>
                  <ProductCard product={product} />
                </View>
              ))}
            </View>
          ) : (
            <Card><Body style={{ color: colors.mutedText }}>{t('noResults')}</Body></Card>
          )}
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  introduction: { gap: 8, marginVertical: 12 },
  wordmark: { fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 20, letterSpacing: 1 },
  collectionTitle: { marginTop: 12, fontSize: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
  sectionTitle: { fontSize: 21 },
  categoryList: { gap: 12, paddingVertical: 8 },
  category: { width: 104, gap: 8 },
  categoryTitle: { fontSize: 12, textAlign: 'center' },
  section: { gap: 16, marginTop: 16 },
  productGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  product: { width: '47%' },
});
