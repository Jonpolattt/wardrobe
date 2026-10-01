import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { Category } from '@wardrobe/types';
import { storefront, typography, webColors } from '@wardrobe/theme';
import { mobileApi } from '../services/api';
import { usePreferences } from '../store/preferences';
import { localizedName } from '../features/catalog/model';
import { Screen, Title, StateView } from './ui';
export function CategoryTile({ category }: { category: Category }) {
  const locale = usePreferences(state => state.locale);
  const title = localizedName(category, locale);
  return <Pressable accessibilityRole="button" accessibilityLabel={title}
    onPress={() => router.navigate({ pathname: '/(tabs)/shop', params: { categorySlug: category.slug } })}
    style={({ pressed }) => [styles.category, { backgroundColor: webColors.ink[950], transform: [{ scale: pressed ? 0.985 : 1 }] }]}>
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: webColors.ink[900], opacity: 0.35 }]} />
    <View pointerEvents="none" style={[styles.circle, { backgroundColor: webColors.gold[500] }]} />
    <Text numberOfLines={2} style={[styles.name, { color: webColors.cream }]}>{title}</Text>
  </Pressable>;
}
export function CategoriesContent() {
  const { t } = useTranslation('common');
  const categories = useQuery({ queryKey: ['categories'], queryFn: ({ signal }) => mobileApi.categories(signal) });
  return <Screen><Title style={styles.heading}>{t('categories')}</Title>
    {categories.isPending ? <StateView kind="loading" /> : categories.isError ? <StateView kind="error" onRetry={() => void categories.refetch()} />
      : !categories.data.length ? <StateView kind="empty" /> : <View style={styles.list}>{categories.data.map(category => <CategoryTile key={category.id} category={category} />)}</View>}
  </Screen>;
}
const styles = StyleSheet.create({
  heading: { marginTop: 32, marginBottom: 16 },
  list: { gap: 24 },
  category: { height: 208, borderRadius: storefront.categoryRadius, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  circle: { position: 'absolute', top: -32, right: -32, height: 160, width: 160, borderRadius: 80, opacity: 0.1 },
  name: { fontFamily: typography.medium, fontSize: 30, lineHeight: 38, textAlign: 'center' },
});
