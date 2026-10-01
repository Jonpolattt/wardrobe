import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { AccessibilityInfo, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { Banner, Category } from '@wardrobe/types';
import { radius, spacing, storefront, typography, webColors } from '@wardrobe/theme';
import { mobileApi } from '../../services/api';
import { usePreferences } from '../../store/preferences';
import { bannerTitle, localizedName } from '../../features/catalog/model';
import { useTheme } from '../../hooks/useTheme';
import { Screen, Title, Body, Card, Skeleton, StateView } from '../../components/ui';
import { ProductCard } from '../../components/ProductCard';
import { ProductImage } from '../../components/ProductImage';
import { Icon } from '../../components/Icon';

function bannerRoute(banner: Banner) {
  if (banner.linkType === 'PRODUCT' && banner.productSlug) {
    router.push({ pathname: '/product/[slug]', params: { slug: banner.productSlug } });
  } else if (banner.linkType === 'CATEGORY' && banner.categorySlug) {
    router.push({ pathname: '/(tabs)/shop', params: { categorySlug: banner.categorySlug } });
  } else if (banner.linkType === 'PRODUCTS' && banner.products.length) {
    router.push({ pathname: '/(tabs)/shop', params: { ids: banner.products.map((product) => product.id).join(',') } });
  }
}
function useCarousel(count: number, width: number, delay: number) {
  const ref = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    let current = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => { if (current) setReduced(enabled); }).catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => { current = false; subscription.remove(); };
  }, []);
  useEffect(() => {
    if (paused || reduced || count <= 1) return;
    const timer = setInterval(() => {
      setIndex((current) => {
        const next = (current + 1) % count;
        ref.current?.scrollTo({ x: next * width, animated: true });
        return next;
      });
    }, delay);
    return () => clearInterval(timer);
  }, [count, delay, paused, reduced, width]);
  function select(next: number) { setIndex(next); ref.current?.scrollTo({ x: next * width, animated: !reduced }); }
  return { ref, index, setIndex, setPaused, select };
}
function BannerStrip({ banners, fallback }: { banners: Banner[]; fallback?: string | null }) {
  const locale = usePreferences((state) => state.locale);
  const { colors } = useTheme();
  const { t } = useTranslation('catalog');
  const window = useWindowDimensions();
  const [width, setWidth] = useState(window.width - storefront.gutter * 2);
  const carousel = useCarousel(banners.length, width, 3000);
  if (!banners.length) return fallback ? <ProductImage src={fallback} label={t('collection')} aspectRatio={16 / 9} /> : null;
  return <View style={styles.banner} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
    <ScrollView ref={carousel.ref} horizontal pagingEnabled showsHorizontalScrollIndicator={false}
      onScrollBeginDrag={() => carousel.setPaused(true)} onTouchStart={() => carousel.setPaused(true)}
      onTouchEnd={() => carousel.setPaused(false)}
      onMomentumScrollEnd={(event) => { carousel.setIndex(Math.round(event.nativeEvent.contentOffset.x / width)); carousel.setPaused(false); }}>
      {banners.map((banner) => {
        const title = bannerTitle(banner, locale);
        return <Pressable key={banner.id} style={{ width }} accessibilityRole="button"
          accessibilityLabel={title || t('collection')} disabled={banner.linkType === 'NONE'} onPress={() => bannerRoute(banner)}>
          <ProductImage src={banner.image} label={title || t('collection')} aspectRatio={16 / 9} style={styles.squareImage} />
          {!!title && <View pointerEvents="none" style={styles.bannerCaption}>
            <Body numberOfLines={2} style={[styles.bannerTitle, { color: colors.onAccent }]}>{title}</Body>
          </View>}
        </Pressable>;
      })}
    </ScrollView>
    {banners.length > 1 && <View style={styles.bannerDots}>
      {banners.map((banner, index) => <Pressable key={banner.id} accessibilityRole="button"
        accessibilityLabel={`${index + 1}/${banners.length}`} accessibilityState={{ selected: index === carousel.index }}
        hitSlop={8} onPress={() => carousel.select(index)}
        style={[styles.dot, { width: index === carousel.index ? 20 : 6,
          backgroundColor: index === carousel.index ? colors.accent : colors.onAccent, opacity: index === carousel.index ? 1 : 0.6 }]} />)}
    </View>}
  </View>;
}
function CategoryShowcase({ categories }: { categories: Category[] }) {
  const locale = usePreferences((state) => state.locale);
  const window = useWindowDimensions();
  const [width, setWidth] = useState(window.width - storefront.gutter * 2);
  const carousel = useCarousel(categories.length, width, 3500);
  return <View style={styles.showcase} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
    <ScrollView ref={carousel.ref} horizontal pagingEnabled showsHorizontalScrollIndicator={false}
      onScrollBeginDrag={() => carousel.setPaused(true)} onTouchStart={() => carousel.setPaused(true)}
      onTouchEnd={() => carousel.setPaused(false)}
      onMomentumScrollEnd={(event) => { carousel.setIndex(Math.round(event.nativeEvent.contentOffset.x / width)); carousel.setPaused(false); }}>
      {categories.map((category) => <Pressable key={category.id} style={[styles.category, { width }]}
        accessibilityRole="button" onPress={() => router.push({ pathname: '/(tabs)/shop', params: { categorySlug: category.slug } })}>
        <View pointerEvents="none" style={styles.categoryGlow} />
        <View pointerEvents="none" style={styles.categoryGlowBottom} />
        <Title style={styles.categoryTitle}>{localizedName(category, locale)}</Title>
      </Pressable>)}
    </ScrollView>
    {categories.length > 1 && <View style={styles.categoryDots}>
      {categories.map((category, index) => <Pressable key={category.id} hitSlop={8} accessibilityRole="button"
        accessibilityLabel={localizedName(category, locale)} accessibilityState={{ selected: index === carousel.index }}
        onPress={() => carousel.select(index)} style={[styles.dot, { width: index === carousel.index ? 24 : 6,
          backgroundColor: index === carousel.index ? webColors.gold[400] : webColors.cream, opacity: index === carousel.index ? 1 : 0.3 }]} />)}
    </View>}
  </View>;
}
export default function HomeScreen() {
  const { t } = useTranslation('catalog');
  const { colors } = useTheme();
  const window = useWindowDimensions();
  const cardWidth = (window.width - storefront.gutter * 2 - storefront.gridGap) / 2;
  const home = useQuery({
    queryKey: ['home'],
    queryFn: async ({ signal }) => {
      const [banners, popular, arrivals, categories, settings] = await Promise.all([
        mobileApi.banners(signal), mobileApi.bestSellers(signal),
        mobileApi.products({ sort: 'NEWEST', page: 1, limit: 6 }, signal),
        mobileApi.categories(signal), mobileApi.siteSettings(signal),
      ]);
      return { banners, popular, arrivals: arrivals.list, categories, settings };
    },
  });
  if (home.isPending) return <Screen contentContainerStyle={styles.homeContent}>
    <Skeleton height={220} /><View style={styles.section}><Skeleton width="65%" height={36} />
      <View style={[styles.productGrid, { marginTop: 40 }]}>{[0, 1, 2, 3].map((index) => <View key={index} style={{ width: cardWidth }}><Skeleton height={300} /></View>)}</View>
    </View>
  </Screen>;
  if (home.isError && !home.data) return <Screen><StateView kind="error" onRetry={() => void home.refetch()} /></Screen>;
  const data = home.data!;
  const trust = [
    { icon: 'shield' as const, title: t('originalTitle'), text: t('originalBody') },
    { icon: 'truck' as const, title: t('deliveryTitle'), text: t('deliveryBody') },
    { icon: 'bag' as const, title: t('trustedTitle'), text: t('trustedBody') },
    { icon: 'lock' as const, title: t('paymentTitle'), text: t('paymentBody') },
  ];
  return <Screen contentContainerStyle={styles.homeContent}>
    <BannerStrip banners={data.banners} fallback={data.settings.heroImage} />
    <View style={styles.section}>
      <Title style={styles.sectionTitle}>{t('popular')}</Title>
      {data.popular.length ? <View style={styles.productGrid}>
        {data.popular.map((product) => <View key={product.id} style={{ width: cardWidth }}><ProductCard product={product} /></View>)}
      </View> : <StateView kind="empty" title={t('noResults')} />}
    </View>
    <View style={styles.categorySection}>
      <Body style={[styles.eyebrow, { color: colors.accentText }]}>{t('arrivals')}</Body>
      <Title style={styles.categoryHeading}>{t('categories')}</Title>
      <View style={{ marginTop: 40 }}>{data.categories.length ? <CategoryShowcase categories={data.categories} /> : <Body>{t('noResults')}</Body>}</View>
    </View>
    <View style={[styles.trustSection, { borderTopColor: colors.border }]}>
      {trust.map((item) => <Card key={item.title} style={[styles.trustCard, { width: cardWidth }]}>
        <View style={[styles.trustIcon, { backgroundColor: colors.input }]}><Icon name={item.icon} size={22} color={colors.accentText} /></View>
        <Body style={styles.trustTitle}>{item.title}</Body>
        <Body style={[styles.trustBody, { color: colors.mutedText }]}>{item.text}</Body>
      </Card>)}
    </View>
  </Screen>;
}
const styles = StyleSheet.create({
  homeContent: { gap: 0 }, banner: { overflow: 'hidden', borderRadius: radius.card, marginTop: spacing.lg }, squareImage: { borderRadius: 0 },
  bannerCaption: { position: 'absolute', bottom: 20, left: 0, right: 0, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: webColors.ink[950] + '73' },
  bannerTitle: { fontFamily: typography.semibold, fontSize: 14, lineHeight: 21 },
  bannerDots: { position: 'absolute', bottom: 10, left: 0, right: 0, flexDirection: 'row', gap: 6, justifyContent: 'center' },
  dot: { height: 6, borderRadius: radius.pill }, section: { paddingVertical: 80 },
  sectionTitle: { fontSize: typography.sectionTitle, lineHeight: 38 }, productGrid: { marginTop: 40, flexDirection: 'row', flexWrap: 'wrap', gap: storefront.gridGap },
  categorySection: { paddingVertical: 80 }, eyebrow: { fontSize: 12, fontFamily: typography.semibold, letterSpacing: 2.5, textTransform: 'uppercase' },
  categoryHeading: { fontSize: typography.sectionTitle, lineHeight: 38, fontFamily: typography.medium, marginTop: 16 },
  showcase: { overflow: 'hidden', borderRadius: storefront.categoryRadius },
  category: { height: storefront.categoryHeight, backgroundColor: webColors.ink[950], overflow: 'hidden', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  categoryGlow: { position: 'absolute', top: -40, right: -40, width: 224, height: 224, borderRadius: 112, backgroundColor: webColors.gold[500], opacity: 0.1 },
  categoryGlowBottom: { position: 'absolute', bottom: -40, left: -40, width: 224, height: 224, borderRadius: 112, backgroundColor: webColors.gold[600], opacity: 0.08 },
  categoryTitle: { color: webColors.cream, fontSize: 36, lineHeight: 44, fontFamily: typography.medium, textAlign: 'center' },
  categoryDots: { position: 'absolute', left: 16, right: 16, bottom: 20, justifyContent: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  trustSection: { borderTopWidth: 1, paddingVertical: 64, flexDirection: 'row', flexWrap: 'wrap', gap: storefront.gridGap },
  trustCard: { padding: spacing.xl, gap: 12 }, trustIcon: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  trustTitle: { fontFamily: typography.semibold, fontSize: 14, lineHeight: 20 }, trustBody: { fontSize: 13, lineHeight: 21 },
});