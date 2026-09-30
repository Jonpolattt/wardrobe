import { useEffect, useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { FlatList, Modal, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { ProductFilter, ProductSortValue } from '@wardrobe/types';
import { mobileApi } from '../../services/api';
import { usePreferences } from '../../store/preferences';
import { localizedName } from '../../features/catalog/model';
import { Screen, Title, Body, Button, Field, StateView } from '../../components/ui';
import { Choice } from '../../components/Choice';
import { ProductCard } from '../../components/ProductCard';
import { ApiDiagnostics } from '../../components/ApiDiagnostics';

const SORTS: { value: ProductSortValue; key: string }[] = [
  { value: 'NEWEST', key: 'newest' },
  { value: 'PRICE_ASC', key: 'priceAsc' },
  { value: 'PRICE_DESC', key: 'priceDesc' },
  { value: 'MOST_POPULAR', key: 'popularSort' },
  { value: 'TOP_RATED', key: 'topRated' },
];
const one = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

export default function ShopScreen() {
  const { t } = useTranslation('catalog');
  const locale = usePreferences((state) => state.locale);
  const params = useLocalSearchParams<{ categorySlug?: string; ids?: string }>();
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('');
  const [filters, setFilters] = useState<ProductFilter>({ sort: 'NEWEST' });
  const [draft, setDraft] = useState<ProductFilter>(filters);
  const [open, setOpen] = useState(false);
  const [priceError, setPriceError] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setTerm(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setFilters((current) => ({
      ...current,
      categorySlug: one(params.categorySlug),
      ids: one(params.ids)?.split(',').filter(Boolean),
    }));
  }, [params.categorySlug, params.ids]);

  const options = useQuery({
    queryKey: ['catalog-filters'],
    queryFn: ({ signal }) => mobileApi.filters(signal),
  });
  const productsQuery = useInfiniteQuery({
    queryKey: ['products', filters, term],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => mobileApi.products({
      ...filters,
      search: term || undefined,
      page: pageParam,
      limit: 12,
    }, signal),
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((sum, page) => sum + page.list.length, 0);
      return loaded < last.total && last.list.length ? pages.length + 1 : undefined;
    },
  });
  const products = productsQuery.data?.pages.flatMap((page) => page.list) ?? [];

  function apply() {
    const invalidMinimum = draft.minPrice !== undefined
      && (!Number.isFinite(draft.minPrice) || draft.minPrice < 0);
    const invalidMaximum = draft.maxPrice !== undefined
      && (!Number.isFinite(draft.maxPrice) || draft.maxPrice < 0);
    const reversedRange = draft.minPrice !== undefined
      && draft.maxPrice !== undefined
      && draft.minPrice > draft.maxPrice;

    if (invalidMinimum || invalidMaximum || reversedRange) {
      setPriceError(true);
      return;
    }
    setFilters(draft);
    setOpen(false);
    setPriceError(false);
  }

  return (
    <Screen scroll={false}>
      <Title>{t('shop')}</Title>
      <Field
        accessibilityLabel={t('search')}
        placeholder={t('search')}
        value={search}
        onChangeText={setSearch}
        returnKeyType="search"
        clearButtonMode="while-editing"
      />
      <View style={styles.resultsHeader}>
        <View style={styles.flex}>
          <Body>{t('results', { count: productsQuery.data?.pages[0]?.total ?? 0 })}</Body>
        </View>
        <Button
          title={t('filters')}
          variant="secondary"
          onPress={() => {
            setDraft(filters);
            setPriceError(false);
            setOpen(true);
          }}
        />
      </View>

      {__DEV__ && <ApiDiagnostics />}
      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        numColumns={2}
        showsVerticalScrollIndicator={false}
        columnWrapperStyle={styles.columns}
        contentContainerStyle={styles.productList}
        renderItem={({ item }) => (
          <View style={styles.product}><ProductCard product={item} /></View>
        )}
        refreshControl={(
          <RefreshControl
            refreshing={productsQuery.isRefetching && !productsQuery.isFetchingNextPage}
            onRefresh={() => void productsQuery.refetch()}
          />
        )}
        onEndReached={() => {
          if (productsQuery.hasNextPage && !productsQuery.isFetching) {
            void productsQuery.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={productsQuery.isPending ? (
          <StateView kind="loading" />
        ) : productsQuery.isError ? (
          <StateView kind="error" onRetry={() => void productsQuery.refetch()} />
        ) : (
          <StateView kind="empty" title={t('noResults')} message={t('noResultsBody')} />
        )}
        ListFooterComponent={productsQuery.isFetchingNextPage ? (
          <StateView kind="loading" />
        ) : productsQuery.isError && products.length ? (
          <StateView kind="error" onRetry={() => void productsQuery.refetch()} />
        ) : productsQuery.hasNextPage ? (
          <Button
            title={t('loadMore')}
            variant="secondary"
            onPress={() => void productsQuery.fetchNextPage()}
          />
        ) : null}
      />

      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setOpen(false)}
      >
        <Screen>
          <Title>{t('filters')}</Title>
          {options.isPending ? (
            <StateView kind="loading" />
          ) : options.isError ? (
            <StateView kind="error" onRetry={() => void options.refetch()} />
          ) : (
            <>
              <Title style={styles.filterTitle}>{t('category')}</Title>
              <View style={styles.choices}>
                <Choice
                  title={t('all')}
                  selected={!draft.categorySlug}
                  onPress={() => setDraft({ ...draft, categorySlug: undefined })}
                />
                {options.data.categories.map((category) => (
                  <Choice
                    key={category.id}
                    title={localizedName(category, locale)}
                    selected={draft.categorySlug === category.slug}
                    onPress={() => setDraft({ ...draft, categorySlug: category.slug })}
                  />
                ))}
              </View>

              <Title style={styles.filterTitle}>{t('brand')}</Title>
              <View style={styles.choices}>
                <Choice
                  title={t('all')}
                  selected={!draft.brandSlug}
                  onPress={() => setDraft({ ...draft, brandSlug: undefined })}
                />
                {options.data.brands.map((brand) => (
                  <Choice
                    key={brand.id}
                    title={brand.name}
                    selected={draft.brandSlug === brand.slug}
                    onPress={() => setDraft({ ...draft, brandSlug: brand.slug })}
                  />
                ))}
              </View>

              <Title style={styles.filterTitle}>{t('gender')}</Title>
              <View style={styles.choices}>
                <Choice
                  title={t('all')}
                  selected={!draft.genderSlug}
                  onPress={() => setDraft({ ...draft, genderSlug: undefined })}
                />
                {options.data.genders.map((gender) => (
                  <Choice
                    key={gender.id}
                    title={localizedName(gender, locale)}
                    selected={draft.genderSlug === gender.slug}
                    onPress={() => setDraft({ ...draft, genderSlug: gender.slug })}
                  />
                ))}
              </View>

              <Title style={styles.filterTitle}>{t('color')}</Title>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.colorList}
              >
                {options.data.productColors.map((color) => (
                  <Choice
                    key={color}
                    title={color}
                    selected={draft.colors?.includes(color)}
                    onPress={() => setDraft({
                      ...draft,
                      colors: draft.colors?.includes(color)
                        ? draft.colors.filter((selected) => selected !== color)
                        : [...(draft.colors ?? []), color],
                    })}
                  />
                ))}
              </ScrollView>
            </>
          )}

          <Field
            label={t('sizesHint')}
            value={draft.sizes?.join(', ') ?? ''}
            onChangeText={(value) => setDraft({
              ...draft,
              sizes: value.split(',').map((size) => size.trim()).filter(Boolean),
            })}
          />
          <View style={styles.priceInputs}>
            <View style={styles.flex}>
              <Field
                label={t('minPrice')}
                keyboardType="numeric"
                value={draft.minPrice === undefined ? '' : String(draft.minPrice)}
                onChangeText={(value) => setDraft({
                  ...draft,
                  minPrice: value.trim() ? Number(value) : undefined,
                })}
              />
            </View>
            <View style={styles.flex}>
              <Field
                label={t('maxPrice')}
                keyboardType="numeric"
                value={draft.maxPrice === undefined ? '' : String(draft.maxPrice)}
                onChangeText={(value) => setDraft({
                  ...draft,
                  maxPrice: value.trim() ? Number(value) : undefined,
                })}
              />
            </View>
          </View>
          {priceError && <Body>{t('priceRangeError')}</Body>}

          <Title style={styles.filterTitle}>{t('sort')}</Title>
          <View style={styles.choices}>
            {SORTS.map((sort) => (
              <Choice
                key={sort.value}
                title={t(sort.key)}
                selected={draft.sort === sort.value}
                onPress={() => setDraft({ ...draft, sort: sort.value })}
              />
            ))}
          </View>
          <Button title={t('apply')} onPress={apply} />
          <Button
            title={t('reset')}
            variant="secondary"
            onPress={() => setDraft({ sort: 'NEWEST' })}
          />
          <Button title={t('close')} variant="secondary" onPress={() => setOpen(false)} />
        </Screen>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  resultsHeader: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  columns: { gap: 16 },
  productList: { gap: 24, paddingVertical: 12, paddingBottom: 28 },
  product: { flex: 1, maxWidth: '48%' },
  filterTitle: { fontSize: 18 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  colorList: { gap: 8 },
  priceInputs: { flexDirection: 'row', gap: 12 },
});
