import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { mobileApi } from '../services/api';
import { usePreferences } from '../store/preferences';
import { localizedName } from '../features/catalog/model';
import { ProductImage } from '../components/ProductImage';
import { Screen, Title, Body, StateView } from '../components/ui';

export default function CategoriesScreen() {
  const { t } = useTranslation('catalog');
  const locale = usePreferences((state) => state.locale);
  const categories = useQuery({
    queryKey: ['categories'],
    queryFn: ({ signal }) => mobileApi.categories(signal),
  });

  return (
    <Screen>
      <Title>{t('categories')}</Title>
      {categories.isPending ? (
        <StateView kind="loading" />
      ) : categories.isError ? (
        <StateView kind="error" onRetry={() => void categories.refetch()} />
      ) : !categories.data.length ? (
        <StateView kind="empty" />
      ) : (
        <View style={styles.grid}>
          {categories.data.map((category) => {
            const title = localizedName(category, locale);
            return (
              <Pressable
                key={category.id}
                accessibilityRole="button"
                accessibilityLabel={title}
                style={styles.category}
                onPress={() => router.push({
                  pathname: '/(tabs)/shop',
                  params: { categorySlug: category.slug },
                })}
              >
                <ProductImage src={category.image} label={title} aspectRatio={1} />
                <Body>{title}</Body>
              </Pressable>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  category: { width: '47%', gap: 10 },
});
