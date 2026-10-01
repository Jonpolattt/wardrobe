import React, { useEffect, useRef, useState } from 'react';
import { Animated, Keyboard, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { glassColors, motion, radius, storefront, typography } from '@wardrobe/theme';
import { useTheme } from '../hooks/useTheme';
import { useMotionPreferences } from '../hooks/useMotionPreferences';
import { useAuth } from '../store/auth';
import { mobileApi } from '../services/api';
import { Icon, type IconName } from './Icon';

const items: { name: string; icon: IconName; route: '/(tabs)' | '/(tabs)/shop' | '/(tabs)/cart' | '/(tabs)/categories' | '/(tabs)/profile' }[] = [
  { name: 'home', icon: 'home', route: '/(tabs)' },
  { name: 'shop', icon: 'shop', route: '/(tabs)/shop' },
  { name: 'cart', icon: 'cart', route: '/(tabs)/cart' },
  { name: 'categories', icon: 'categories', route: '/(tabs)/categories' },
  { name: 'profile', icon: 'profile', route: '/(tabs)/profile' },
];
function GlassSurface() {
  const { colors, isDark } = useTheme();
  const { reduceTransparency } = useMotionPreferences();
  const glass = glassColors[isDark ? 'dark' : 'light'];
  if (reduceTransparency) return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.header }]} />;
  if (Platform.OS === 'ios') {
    let supported = false;
    try { supported = isLiquidGlassAvailable(); } catch { /* Expo Go/older OS: blur fallback. */ }
    return supported
      ? <GlassView pointerEvents="none" glassEffectStyle="regular" colorScheme={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
      : <BlurView pointerEvents="none" tint={isDark ? 'dark' : 'light'} intensity={35} style={[StyleSheet.absoluteFill, { backgroundColor: glass.surface }]} />;
  }
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: glass.surface }]} />;
}
function TabButton({ item, active, count }: { item: typeof items[number]; active: boolean; count?: number }) {
  const { colors } = useTheme();
  const { t } = useTranslation('common');
  const { reduceMotion } = useMotionPreferences();
  const scale = useRef(new Animated.Value(1)).current;
  const change = (toValue: number) => {
    if (reduceMotion) return;
    Animated.spring(scale, { ...motion.pressSpring, toValue, useNativeDriver: true }).start();
  };
  return <Pressable accessibilityRole="tab" accessibilityState={{ selected: active }} accessibilityLabel={t(`nav.${item.name}`)}
    onPress={() => router.navigate(item.route)} onPressIn={() => change(0.94)} onPressOut={() => change(1)} style={styles.tab}>
    <Animated.View style={[styles.tabInner, { transform: [{ scale }] }]}>
      <View><Icon name={item.icon} size={22} strokeWidth={active ? 2.4 : 2} color={active ? colors.accentText : colors.mutedText} />
        {!!count && <View style={[styles.badge, { backgroundColor: colors.accent }]}><Text style={[styles.badgeText, { color: colors.onAccent }]}>{count > 99 ? '99+' : count}</Text></View>}
      </View>
      <Text numberOfLines={1} maxFontSizeMultiplier={1.2} style={[styles.label, { color: active ? colors.accentText : colors.mutedText }]}>{t(`nav.${item.name}`)}</Text>
    </Animated.View>
  </Pressable>;
}
export function FloatingNavigation() {
  const path = usePathname();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { reduceMotion } = useMotionPreferences();
  const glass = glassColors[isDark ? 'dark' : 'light'];
  const [width, setWidth] = useState(0);
  const [keyboard, setKeyboard] = useState(false);
  const position = useRef(new Animated.Value(0)).current;
  const hasSession = useAuth(state => state.hasSession);
  const sessionKey = useAuth(state => state.sessionKey);
  const hidden = /^\/(?:auth|reset-password|payment-return)(?:\/|$)/.test(path);
  const cart = useQuery({ queryKey: ['private', sessionKey, 'cart'], queryFn: ({ signal }) => mobileApi.cart(signal), enabled: hasSession && !hidden });
  const count = cart.data?.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
  const active = path === '/' ? 0 : path.startsWith('/cart') || path.startsWith('/checkout') ? 2
    : path.startsWith('/categories') ? 3 : path.startsWith('/profile') || path.startsWith('/orders') ? 4
      : path.startsWith('/shop') || path.startsWith('/product') ? 1 : -1;
  const cellWidth = Math.max(0, width - 8) / items.length;
  useEffect(() => {
    const shown = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboard(true));
    const gone = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboard(false));
    return () => { shown.remove(); gone.remove(); };
  }, []);
  useEffect(() => {
    const toValue = Math.max(0, active) * cellWidth;
    if (reduceMotion) position.setValue(toValue);
    else Animated.spring(position, { ...motion.tabSpring, toValue, useNativeDriver: true }).start();
  }, [active, cellWidth, position, reduceMotion]);
  if (hidden || keyboard) return null;
  return <View pointerEvents="box-none" style={[styles.anchor, { bottom: insets.bottom + storefront.navGap }]}>
    <View onLayout={event => setWidth(event.nativeEvent.layout.width)} style={[styles.shadow, { shadowColor: glass.shadow }]}>
      <View style={[styles.container, { borderColor: glass.border }]}>
        <GlassSurface />
        {active >= 0 && cellWidth > 0 && <Animated.View pointerEvents="none" style={[styles.capsule, { width: cellWidth, backgroundColor: glass.capsule, borderColor: glass.highlight, transform: [{ translateX: position }] }]} />}
        {items.map((item, index) => <TabButton key={item.name} item={item} active={index === active} count={item.name === 'cart' ? count : undefined} />)}
      </View>
    </View>
  </View>;
}
const styles = StyleSheet.create({
  anchor: { position: 'absolute', left: storefront.navGap, right: storefront.navGap, zIndex: 60, alignItems: 'center' },
  shadow: { width: '100%', maxWidth: storefront.navMaxWidth, height: storefront.navHeight, borderRadius: radius.pill, shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  container: { flex: 1, borderRadius: radius.pill, overflow: 'hidden', borderWidth: 1, paddingHorizontal: 4, flexDirection: 'row' },
  capsule: { position: 'absolute', top: 5, bottom: 5, left: 4, borderRadius: radius.pill, borderWidth: 1 },
  tab: { flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: 44 },
  tabInner: { alignItems: 'center', gap: 4, width: '100%', paddingHorizontal: 1 },
  label: { fontFamily: typography.semibold, fontSize: 10, lineHeight: 14 },
  badge: { position: 'absolute', right: -8, top: -5, minWidth: 16, height: 16, paddingHorizontal: 3, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  badgeText: { fontFamily: typography.bold, fontSize: 9 },
});
