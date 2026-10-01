import { useEffect, useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { Modal, Pressable, RefreshControl, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { radius, spacing, storefront, typography } from '@wardrobe/theme';
import { useTranslation } from 'react-i18next';
import type { ProductFilter, ProductSortValue } from '@wardrobe/types';
import { mobileApi } from '../../services/api';
import { usePreferences } from '../../store/preferences';
import { localizedName } from '../../features/catalog/model';
import { Screen, Title, Body, Button, Field, StateView } from '../../components/ui';
import { Choice } from '../../components/Choice';
import { ProductCard } from '../../components/ProductCard';
import { Icon } from '../../components/Icon';
import { StorefrontList } from '../../components/StorefrontShell';
import { useTheme } from '../../hooks/useTheme';
import { swatchColor } from '../../features/catalog/color-swatch';
import { translateColorName } from '../../features/catalog/color-names';

const SORTS: { value: ProductSortValue; key: string }[] = [
  { value: 'RANDOM', key: 'random' },
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
  const { colors } = useTheme();
  const window = useWindowDimensions();
  const productWidth = (window.width - storefront.gutter * 2 - storefront.gridGap) / 2;
  const params = useLocalSearchParams<{ categorySlug?: string; ids?: string; search?: string }>();
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('');
  const [filters, setFilters] = useState<ProductFilter>({ sort: 'NEWEST' });
  const [draft, setDraft] = useState<ProductFilter>(filters);
  const [open, setOpen] = useState(false);
  const [priceError, setPriceError] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  useEffect(() => { setSearch(one(params.search) ?? ''); }, [params.search]);

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
    <Screen scroll={false} searchValue={search} onSearchChange={setSearch}>
      <StorefrontList
        ListHeaderComponent={<View style={styles.pageHeader}>
          <Title>{t('shop')}</Title>
          <View style={styles.filterHeader}>
            <Pressable accessibilityRole="button" onPress={() => { setDraft(filters); setPriceError(false); setOpen(true); }}
              style={({ pressed }) => [styles.filterTrigger, { opacity: pressed ? 0.6 : 1 }]}>
              <Body style={styles.filterLabel}>{t('filters')}</Body><Icon name="chevronDown" size={18} color={colors.text} />
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => { setFilters({ sort: 'NEWEST' }); setSearch(''); }} hitSlop={8}>
              <Body style={[styles.clearLabel, { color: colors.mutedText }]}>{t('reset')}</Body>
            </Pressable>
          </View>
          <View style={styles.resultsHeader}>
            <Body style={[styles.resultCount, { color: colors.mutedText }]}>{t('results', { count: productsQuery.data?.pages[0]?.total ?? 0 })}</Body>
            <Pressable accessibilityRole="button" onPress={() => setSortOpen(true)}
              style={({ pressed }) => [styles.sortControl, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}>
              <Body numberOfLines={1} style={styles.sortLabel}>{t(SORTS.find((sort) => sort.value === filters.sort)?.key ?? 'newest')}</Body>
              <Icon name="chevronDown" size={14} color={colors.text} />
            </Pressable>
          </View>
        </View>}
        data={products}
        keyExtractor={(item) => item.id}
        numColumns={2}
        showsVerticalScrollIndicator={false}
        columnWrapperStyle={styles.columns}
        ItemSeparatorComponent={() => <View style={{ height: storefront.gridGap }} />}
        contentContainerStyle={styles.productList}
        renderItem={({ item }) => (
          <View style={{ width: productWidth }}><ProductCard product={item} /></View>
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
        <Screen chrome={false}>
          <View style={styles.sheetHeader}><Title>{t('filters')}</Title>
            <Pressable accessibilityRole="button" accessibilityLabel={t('close')} hitSlop={8} onPress={() => setOpen(false)}><Icon name="x" size={22} color={colors.text} /></Pressable>
          </View>
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
                    title={translateColorName(color, locale)}
                    swatch={swatchColor(color)}
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
      <Modal visible={sortOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSortOpen(false)}>
        <Screen chrome={false}>
          <View style={styles.sheetHeader}><Title>{t('sort')}</Title><Pressable accessibilityRole="button" accessibilityLabel={t('close')} onPress={() => setSortOpen(false)} hitSlop={8}><Icon name="x" size={22} color={colors.text} /></Pressable></View>
          {SORTS.map((sort) => <Pressable key={sort.value} accessibilityRole="button" accessibilityState={{ selected: filters.sort === sort.value }}
            onPress={() => { setFilters((current) => ({ ...current, sort: sort.value })); setSortOpen(false); }}
            style={({ pressed }) => [styles.sortOption, { borderBottomColor: colors.border, opacity: pressed ? 0.65 : 1 }]}>
            <Body>{t(sort.key)}</Body>{filters.sort === sort.value && <Icon name="check" size={20} color={colors.accentText} />}
          </Pressable>)}
        </Screen>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, pageHeader: { paddingTop: spacing.xxxl, marginBottom: spacing.xxl },
  filterHeader: { marginTop: spacing.xxxl, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  filterTrigger: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  filterLabel: { fontFamily: typography.bold, fontSize: 14, textTransform: 'uppercase', letterSpacing: 0.7 },
  clearLabel: { fontFamily: typography.semibold, fontSize: 12 },
  resultsHeader: { flexDirection: 'row', gap: spacing.md, alignItems: 'center', justifyContent: 'space-between', marginTop: 40 },
  resultCount: { fontSize: 14 }, sortControl: { minHeight: 36, maxWidth: '58%', borderWidth: 1, borderRadius: radius.pill,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  sortLabel: { fontSize: 12, lineHeight: 18, fontFamily: typography.semibold, flexShrink: 1 },
  columns: { gap: storefront.gridGap }, productList: {},
  filterTitle: { fontSize: 12, lineHeight: 18, textTransform: 'uppercase', letterSpacing: 0.7 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, colorList: { gap: spacing.sm },
  priceInputs: { flexDirection: 'row', gap: spacing.md }, sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sortOption: { minHeight: 52, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
