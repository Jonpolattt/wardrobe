import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Animated, FlatList, Keyboard, ScrollView, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions, type FlatListProps, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { productTitle, localizedName } from '../features/catalog/model';
import { catalogDisplayPrice } from '../features/catalog/api-contract';
import { formatPrice } from '@wardrobe/utils';
import type { Product } from '@wardrobe/types';
import { router, usePathname } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { brand, storefront, typography } from '@wardrobe/theme';
import { usePreferences } from '../store/preferences';
import { useAuth } from '../store/auth';
import { useTheme } from '../hooks/useTheme';
import { mobileApi, imageUrl } from '../services/api';
import { Icon } from './Icon';

export type StorefrontScroll = {
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  topInset: number; bottomInset: number; offset?: Animated.Value;
};
export const StorefrontScrollContext = createContext<StorefrontScroll>({ onScroll: () => undefined, topInset: 0, bottomInset: 100 });
const AnimatedList = Animated.createAnimatedComponent(FlatList) as unknown as typeof FlatList;
export function StorefrontList<T>({ contentContainerStyle, onScroll, ...props }: FlatListProps<T>) {
  const scroll = useContext(StorefrontScrollContext);
  return <AnimatedList automaticallyAdjustKeyboardInsets {...props} scrollEventThrottle={16}
    onScroll={onScroll && scroll.offset ? Animated.event([{ nativeEvent: { contentOffset: { y: scroll.offset } } }], { useNativeDriver: true, listener: onScroll }) : scroll.onScroll}
    contentContainerStyle={[contentContainerStyle, { paddingTop: scroll.topInset, paddingBottom: scroll.bottomInset }]} />;
}
export function hasStorefrontChrome(path: string) {
  return !/^\/(?:profile|auth|reset-password|payment-return)(?:\/|$)/.test(path);
}
export function BrandHeader() {
  const { colors, isDark, setMode } = useTheme();
  const locale = usePreferences(state => state.locale);
  const setLocale = usePreferences(state => state.setLocale);
  const { t } = useTranslation('common');
  return <View style={[styles.header, { backgroundColor: colors.header, borderBottomColor: colors.border }]}>
    <Pressable accessibilityRole="button" accessibilityLabel={t('nav.home')} onPress={() => router.navigate('/(tabs)')}>
      <Text style={[styles.wordmark, { color: colors.text }]}>{brand.wordmark.toUpperCase()}</Text>
    </Pressable>
    <View style={styles.controls}>
      <View style={[styles.languages, { borderColor: colors.border }]}>
        {(['uz', 'ru'] as const).map(value => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: value === locale }} accessibilityLabel={value === 'uz' ? t('uzbek') : t('russian')}
          onPress={() => setLocale(value)} style={({ pressed }) => [styles.language, { backgroundColor: value === locale ? colors.accent : 'transparent', opacity: pressed ? 0.7 : 1 }]}>
          <Text style={[styles.languageText, { color: value === locale ? colors.onAccent : colors.text }]}>{value.toUpperCase()}</Text>
        </Pressable>)}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={t('toggleTheme')} onPress={() => setMode(isDark ? 'light' : 'dark')}
        style={({ pressed }) => [styles.theme, { opacity: pressed ? 0.6 : 1 }]}>
        <Icon name={isDark ? 'sun' : 'moon'} size={18} color={colors.text} />
      </Pressable>
    </View>
  </View>;
}
// Same display matching as responsive HeaderSearch: Unicode/apostrophe normalization and prefix matching.
function normalizeSearch(value: string | null | undefined) {
  return String(value ?? '').normalize('NFKC').toLocaleLowerCase().replace(/[‘’ʻʼ`´]/g, "'").trim();
}

// Search preview shows the lowest variant display price, like web HeaderSearch.
function searchPreviewPrice(product: Product): number {
  const prices = product.variants.map(variant => catalogDisplayPrice(product, variant.size, variant.color))
    .filter(price => Number.isFinite(price) && price > 0);
  return prices.length ? Math.min(...prices) : catalogDisplayPrice(product);
}

export function SearchRow({ value, onChange }: { value?: string; onChange?: (value: string) => void }) {
  const { colors } = useTheme();
  const { t } = useTranslation('catalog');
  const window = useWindowDimensions();
  const { t: common } = useTranslation('common');
  const path = usePathname();
  const hasSession = useAuth(state => state.hasSession);
  const sessionKey = useAuth(state => state.sessionKey);
  const favorites = useQuery({ queryKey: ['private', sessionKey, 'wishlist'], queryFn: ({ signal }) => mobileApi.wishlist(signal), enabled: hasSession });
  const locale = usePreferences(state => state.locale);
  const [local, setLocal] = useState('');
  const [term, setTerm] = useState('');
  const [recent, setRecent] = useState<string[]>([]);
  const [focused, setFocused] = useState(false);
  const input = useRef<TextInput>(null);
  useEffect(() => { if (value === undefined) setLocal(''); }, [path]);
  const search = value ?? local;
  useEffect(() => { const timer = setTimeout(() => setTerm(search.trim()), 200); return () => clearTimeout(timer); }, [search]);
  useEffect(() => { let active = true; void AsyncStorage.getItem('wardrobe.search.recent').then(raw => {
    if (!active || !raw) return; try { const rows: unknown = JSON.parse(raw); if (Array.isArray(rows)) setRecent([...new Set(rows.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map(item => item.trim().slice(0, 100)))].slice(0, 6)); } catch { /* Optional local search history. */ }
  }).catch(() => undefined); return () => { active = false; }; }, []);
  const suggestions = useQuery({ queryKey: ['search-preview', term], queryFn: ({ signal }) => mobileApi.products({ search: term, page: 1, limit: 40, sort: 'NEWEST' }, signal), enabled: focused && normalizeSearch(term).length >= 1 });
  const categories = useQuery({ queryKey: ['categories'], queryFn: ({ signal }) => mobileApi.categories(signal), enabled: focused && normalizeSearch(term).length >= 1 });
  const normalizedQuery = normalizeSearch(term);
  const previewProducts = normalizedQuery ? (suggestions.data?.list ?? []).filter(product => normalizeSearch(productTitle(product, locale)).startsWith(normalizedQuery)).slice(0, 6) : [];
  const matchingCategories = normalizedQuery ? (categories.data ?? []).filter(category => normalizeSearch(localizedName(category, locale)).startsWith(normalizedQuery)).slice(0, 6) : [];
  function remember(next: string) { const value = next.trim().slice(0, 100); if (!value) return; const rows = [value, ...recent.filter(item => item.toLocaleLowerCase() !== value.toLocaleLowerCase())].slice(0, 6); setRecent(rows); void AsyncStorage.setItem('wardrobe.search.recent', JSON.stringify(rows)).catch(() => undefined); }
  function close() { input.current?.blur(); Keyboard.dismiss(); setFocused(false); }
  function searchFor(next: string) { remember(next); change(next); close(); router.navigate({ pathname: '/(tabs)/shop', params: { search: next.trim() } }); }

  const change = (next: string) => { if (onChange) onChange(next); else setLocal(next); };
  function submit() {
    searchFor(search);
  }
  return <View style={{ backgroundColor: colors.header }}><View style={[styles.searchRow, { backgroundColor: colors.header }]}>
    <View style={[styles.searchBox, { backgroundColor: colors.input, borderColor: focused ? colors.accent : colors.border }]}>
      <Icon name="search" size={19} color={colors.text} />
      <TextInput ref={input} value={search} onChangeText={change} onSubmitEditing={submit} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        placeholder={t('searchPlaceholder')} accessibilityLabel={t('search')} placeholderTextColor={colors.mutedText} selectionColor={colors.accent}
        returnKeyType="search" autoCorrect={false} style={[styles.searchInput, { color: colors.text }]} />
      {!!search && <Pressable accessibilityRole="button" accessibilityLabel={common('remove')} hitSlop={8} onPress={() => change('')}><Icon name="x" size={16} color={colors.mutedText} /></Pressable>}
      {focused && <Pressable accessibilityRole="button" accessibilityLabel={common('cancel')} onPress={() => { input.current?.blur(); Keyboard.dismiss(); setFocused(false); }}
        style={[styles.cancel, { backgroundColor: colors.accent }]}><Text style={[styles.cancelText, { color: colors.onAccent }]}>{common('cancel')}</Text></Pressable>}
    </View>
    {!focused && <Pressable accessibilityRole="button" accessibilityLabel={common('nav.favorites')} onPress={() => router.navigate('/(tabs)/favorites')}
      style={({ pressed }) => [styles.heart, { borderColor: colors.border, backgroundColor: colors.input, opacity: pressed ? 0.7 : 1 }]}>
      <Icon name="heart" size={19} color={path.includes('favorites') ? colors.accentText : colors.text} />
      {!!favorites.data?.length && <View style={[styles.badge, { backgroundColor: colors.accent }]}><Text style={[styles.badgeText, { color: colors.onAccent }]}>{favorites.data.length}</Text></View>}
    </Pressable>}
    </View>
    {focused && (normalizeSearch(term).length >= 1 || (!search && recent.length > 0)) && <View style={[styles.suggestions, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <ScrollView keyboardShouldPersistTaps="always" style={{ maxHeight: Math.min(320, window.height * 0.38) }} showsVerticalScrollIndicator={false}>
        {!search ? <>
          <View style={styles.previewHeading}><Text style={[styles.previewLabel, { color: colors.mutedText }]}>{common('recentSearches')}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={common('remove')} onPress={() => { setRecent([]); void AsyncStorage.removeItem('wardrobe.search.recent').catch(() => undefined); }}><Icon name="trash" size={16} color={colors.mutedText} /></Pressable></View>
          {recent.map(item => <Pressable key={item} style={styles.previewRow} onPress={() => searchFor(item)}><Icon name="search" size={16} color={colors.mutedText} /><Text style={[styles.previewText, { color: colors.text }]}>{item}</Text><Icon name="chevronRight" size={16} color={colors.mutedText} /></Pressable>)}
        </> : <>
          {suggestions.isPending ? <Text style={[styles.previewLabel, { padding: 16, color: colors.mutedText }]}>{common('loading')}</Text>
            : suggestions.isError ? <Pressable style={styles.previewRow} onPress={() => void suggestions.refetch()}><Icon name="alert" size={16} color={colors.danger} /><Text style={[styles.previewText, { color: colors.text }]}>{common('retry')}</Text></Pressable>
            : previewProducts.map(product => <Pressable key={product.id} style={styles.previewRow} onPress={() => { remember(term); close(); router.navigate({ pathname: '/product/[slug]', params: { slug: product.slug } }); }}>
              {!!product.images[0] && <Image source={imageUrl(product.images[0])} contentFit="cover" style={styles.previewImage} />}
              <View style={styles.previewDetails}><Text numberOfLines={1} style={[styles.previewName, { color: colors.text }]}>{productTitle(product, locale)}</Text>
                <Text style={[styles.previewPrice, { color: colors.accentText }]}>{formatPrice(searchPreviewPrice(product), locale)}</Text></View>
              <Icon name="chevronRight" size={16} color={colors.mutedText} />
            </Pressable>)}
          {suggestions.isSuccess && categories.isSuccess && !suggestions.isFetching && !categories.isFetching
            && previewProducts.length === 0 && matchingCategories.length === 0
            && <Text accessibilityLiveRegion="polite" style={[styles.previewEmpty, { color: colors.mutedText }]}>{t('noResults')}</Text>}
          {matchingCategories.map(category => <Pressable key={category.id} style={styles.previewRow} onPress={() => { close(); router.navigate({ pathname: '/(tabs)/shop', params: { categorySlug: category.slug, search: '' } }); }}>
            <Icon name="categories" size={18} color={colors.mutedText} /><Text style={[styles.previewText, { color: colors.text }]}>{localizedName(category, locale)}</Text><Icon name="chevronRight" size={16} color={colors.mutedText} />
          </Pressable>)}
          <Pressable style={[styles.previewRow, { borderTopWidth: 1, borderTopColor: colors.border }]} onPress={submit}><Icon name="search" size={18} color={colors.accentText} /><Text style={[styles.previewText, { color: colors.accentText }]}>{t('viewAll')}</Text><Icon name="chevronRight" size={16} color={colors.accentText} /></Pressable>
        </>}
      </ScrollView>
    </View>}
  </View>;
}
export function StorefrontHeader({ offset, searchValue, onSearchChange }: { offset: Animated.Value; searchValue?: string; onSearchChange?: (value: string) => void }) {
  const { colors } = useTheme();
  return <Animated.View pointerEvents="box-none" style={[styles.overlay, { backgroundColor: colors.header }, { transform: [{ translateY: offset.interpolate({ inputRange: [0, storefront.topHeader], outputRange: [0, -storefront.topHeader], extrapolate: 'clamp' }) }] }]}>
    <BrandHeader /><SearchRow value={searchValue} onChange={onSearchChange} />
  </Animated.View>;
}
const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 30, elevation: 6 },
  header: { height: storefront.topHeader, marginHorizontal: storefront.gutter, paddingHorizontal: 12, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wordmark: { fontFamily: typography.wordmark, fontSize: 24, letterSpacing: 1.8 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  languages: { flexDirection: 'row', padding: 4, borderWidth: 1, borderRadius: 999 },
  language: { minWidth: 32, minHeight: 28, paddingHorizontal: 8, borderRadius: 999, justifyContent: 'center', alignItems: 'center' },
  languageText: { fontFamily: typography.semibold, fontSize: 12 },
  theme: { width: 36, height: 44, alignItems: 'center', justifyContent: 'center' },
  searchRow: { height: storefront.searchRow, paddingHorizontal: storefront.gutter, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchBox: { flex: 1, minWidth: 0, height: storefront.searchControl, borderWidth: 1, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16 },
  searchInput: { flex: 1, minWidth: 0, height: storefront.searchControl, fontFamily: typography.regular, fontSize: 16, paddingVertical: 0 },
  heart: { width: storefront.searchControl, height: storefront.searchControl, borderWidth: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -1, right: -1, minWidth: 16, height: 16, paddingHorizontal: 3, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  badgeText: { fontFamily: typography.bold, fontSize: 9 },
  cancel: { paddingHorizontal: 8, height: 30, justifyContent: 'center', borderRadius: 5 },
  suggestions: { marginHorizontal: storefront.gutter, marginBottom: 8, borderWidth: 1, borderRadius: 12, overflow: 'hidden', elevation: 10, zIndex: 40 },
  previewHeading: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },
  previewLabel: { fontFamily: typography.medium, fontSize: 12 },
  previewRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, gap: 12 },
  previewImage: { height: 40, width: 40, borderRadius: 5 },
  previewDetails: { flex: 1, minWidth: 0, gap: 2 },
  previewName: { fontFamily: typography.medium, fontSize: 13, lineHeight: 18 },
  previewPrice: { fontFamily: typography.semibold, fontSize: 13, lineHeight: 18 },
  previewEmpty: { fontFamily: typography.regular, fontSize: 14, lineHeight: 22, textAlign: 'center', paddingHorizontal: 16, paddingVertical: 24 },
  previewText: { flex: 1, fontFamily: typography.medium, fontSize: 13 },
  cancelText: { fontFamily: typography.semibold, fontSize: 11 },
});
