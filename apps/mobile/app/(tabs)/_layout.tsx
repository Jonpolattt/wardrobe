import React from 'react';
import { Pressable, StyleSheet, Text, View, type ColorValue } from 'react-native';
import { Tabs } from 'expo-router/js-tabs';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { brand, radius, spacing } from '@wardrobe/theme';
import { TabIcon, type TabIconName } from '../../components/ui';
import { usePreferences } from '../../store/preferences';
import { useTheme } from '../../hooks/useTheme';

function BrandHeader() {
  const { colors, isDark, setMode } = useTheme();
  const locale = usePreferences((state) => state.locale);
  const setLocale = usePreferences((state) => state.setLocale);
  const { t } = useTranslation('common');
  return <SafeAreaView edges={['top']} style={{ backgroundColor: colors.header }}>
    <View style={[styles.header, { borderBottomColor: colors.border }]}>
      <Text accessibilityRole="header" style={[styles.wordmark, { color: colors.text }]}>{brand.wordmark.toUpperCase()}</Text>
      <View style={styles.headerActions}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('selectLanguage')} hitSlop={4}
          onPress={() => setLocale(locale === 'uz' ? 'ru' : 'uz')}
          style={({ pressed }) => [styles.headerControl, { backgroundColor: colors.input, borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}>
          <Text style={[styles.locale, { color: colors.text }]}>{locale.toUpperCase()}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={t('toggleTheme')} hitSlop={4}
          onPress={() => setMode(isDark ? 'light' : 'dark')}
          style={({ pressed }) => [styles.headerControl, { backgroundColor: colors.input, borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}>
          <Text accessible={false} style={[styles.themeIcon, { color: colors.text }]}>{isDark ? '☼' : '☾'}</Text>
        </Pressable>
      </View>
    </View>
  </SafeAreaView>;
}
export default function TabsLayout() {
  const { colors } = useTheme();
  const { bottom } = useSafeAreaInsets();
  const { t } = useTranslation('common');
  const tab = (name: TabIconName) => ({ title: t(`nav.${name}`),
    tabBarIcon: ({ color }: { color: ColorValue }) => <TabIcon name={name} color={color} /> });
  return <Tabs screenOptions={{ header: () => <BrandHeader />,
    tabBarActiveTintColor: colors.accentText, tabBarInactiveTintColor: colors.mutedText,
    tabBarStyle: { backgroundColor: colors.header, borderTopColor: colors.border,
      height: 64 + Math.max(bottom, 8), paddingTop: 8, paddingBottom: Math.max(bottom, 8) },
    tabBarLabelStyle: { fontFamily: 'Inter_500Medium', fontSize: 10, marginTop: 3 },
    sceneStyle: { backgroundColor: colors.background } }}>
    <Tabs.Screen name="index" options={tab('home')} />
    <Tabs.Screen name="shop" options={tab('shop')} />
    <Tabs.Screen name="cart" options={tab('cart')} />
    <Tabs.Screen name="favorites" options={tab('favorites')} />
    <Tabs.Screen name="profile" options={tab('profile')} />
  </Tabs>;
}
const styles = StyleSheet.create({
  header: { height: 70, paddingHorizontal: spacing.xl, borderBottomWidth: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wordmark: { fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 22, letterSpacing: 2 },
  headerActions: { flexDirection: 'row', gap: spacing.sm },
  headerControl: { width: 40, height: 40, borderRadius: radius.headerControl, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center' },
  locale: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  themeIcon: { fontSize: 24, lineHeight: 28 },
});
