import React, { forwardRef, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo, ActivityIndicator, Animated, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
  type ColorValue, type DimensionValue, type PressableProps, type RefreshControlProps, type StyleProp,
  type TextInputProps, type TextProps, type ViewProps, type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname } from 'expo-router';
import { StorefrontHeader, StorefrontScrollContext, hasStorefrontChrome } from './StorefrontShell';
import { Icon } from './Icon';
import { useMotionPreferences } from '../hooks/useMotionPreferences';
import { useTranslation } from 'react-i18next';
import { radius, spacing, storefront, typography, motion } from '@wardrobe/theme';
import { useTheme } from '../hooks/useTheme';

interface ScreenProps extends ViewProps {
  children: React.ReactNode; scroll?: boolean; contentContainerStyle?: StyleProp<ViewStyle>;
  refreshControl?: React.ReactElement<RefreshControlProps>; chrome?: boolean;
  searchValue?: string; onSearchChange?: (value: string) => void;
}
export function Screen({ children, scroll = true, style, contentContainerStyle, refreshControl, chrome, searchValue, onSearchChange, ...props }: ScreenProps) {
  const { colors } = useTheme();
  const path = usePathname();
  const insets = useSafeAreaInsets();
  const visible = chrome ?? hasStorefrontChrome(path);
  const offset = useRef(new Animated.Value(0)).current;
  const onScroll = useRef(Animated.event([{ nativeEvent: { contentOffset: { y: offset } } }], { useNativeDriver: true })).current;
  const topInset = visible ? storefront.topHeader + storefront.searchRow + spacing.lg : spacing.xl;
  const bottomInset = storefront.navHeight + storefront.navGap + insets.bottom + spacing.xxl;
  const nativeHeader = /^\/(?:product|auth|checkout|orders|support|profile\/|reset-password|payment-return)/.test(path);
  return <SafeAreaView edges={nativeHeader ? ['left', 'right'] : ['top', 'left', 'right']} style={[styles.safeArea, { backgroundColor: colors.background }, style]} {...props}>
    <View style={{ flex: 1, overflow: 'hidden' }}><StorefrontScrollContext.Provider value={{ onScroll, topInset, bottomInset, offset }}>
      {scroll ? <Animated.ScrollView automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false} refreshControl={refreshControl} onScroll={onScroll} scrollEventThrottle={16}
        contentContainerStyle={[styles.screenContent, contentContainerStyle, { paddingTop: topInset, paddingBottom: bottomInset }]}>{children}</Animated.ScrollView>
        : <View style={[styles.fixedContent, contentContainerStyle]}>{children}</View>}
      {visible && <StorefrontHeader offset={offset} searchValue={searchValue} onSearchChange={onSearchChange} />}
    </StorefrontScrollContext.Provider></View>
  </SafeAreaView>;
}
export function Title({ style, ...props }: TextProps) {
  const { colors } = useTheme();
  return <Text accessibilityRole="header" style={[styles.title, { color: colors.text }, style]} {...props} />;
}
export function Body({ style, ...props }: TextProps) {
  const { colors } = useTheme();
  return <Text style={[styles.body, { color: colors.bodyText }, style]} {...props} />;
}
// Compatible descriptive alias for feature screens.
export const BodyText = Body;
interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  title: string; loading?: boolean; variant?: 'primary' | 'secondary' | 'danger'; style?: StyleProp<ViewStyle>; icon?: React.ReactNode;
}
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
export function Button({ title, loading = false, disabled = false, variant = 'primary', style, icon, onPressIn, onPressOut, ...props }: ButtonProps) {
  const { colors } = useTheme();
  const { reduceMotion } = useMotionPreferences();
  const scale = useRef(new Animated.Value(1)).current;
  const isDisabled = disabled || loading;
  const backgroundColor = variant === 'secondary' ? colors.surface : variant === 'danger' ? colors.danger : colors.accent;
  const color = variant === 'secondary' ? colors.text : colors.onAccent;
  const animate = (toValue: number) => {
    if (reduceMotion) { scale.setValue(1); return; }
    Animated.spring(scale, { ...motion.pressSpring, toValue, useNativeDriver: true }).start();
  };
  return <AnimatedPressable {...props} disabled={isDisabled} accessibilityRole="button"
    accessibilityState={{ disabled: isDisabled, busy: loading }} onPressIn={event => { animate(0.97); onPressIn?.(event); }} onPressOut={event => { animate(1); onPressOut?.(event); }}
    style={[styles.button, { backgroundColor, borderColor: variant === 'secondary' ? colors.border : backgroundColor,
      opacity: isDisabled ? 0.45 : 1, transform: [{ scale }], shadowColor: colors.accent,
      shadowOpacity: variant === 'primary' ? 0.2 : 0, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } }, style]}>
    {loading ? <ActivityIndicator size="small" color={color} /> : icon}
    <Text style={[styles.buttonLabel, { color }]}>{title}</Text>
  </AnimatedPressable>;
}
export function TextAction({ title, disabled, loading, style, ...props }: ButtonProps) {
  const { colors } = useTheme();
  return <Pressable {...props} disabled={disabled || loading} accessibilityRole="button"
    style={({ pressed }) => [{ minHeight: 44, justifyContent: 'center', alignItems: 'center', opacity: disabled || loading ? 0.45 : pressed ? 0.65 : 1 }, style]}>
    <Text style={{ color: colors.text, fontFamily: typography.semibold, fontSize: 14, textDecorationLine: 'underline' }}>{title}</Text>
  </Pressable>;
}
interface FieldProps extends TextInputProps { label?: string; error?: string; }
export const Field = forwardRef<TextInput, FieldProps>(function Field({ label, error, style, onFocus, onBlur, ...props }, ref) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return <View style={styles.field}>
    {!!label && <Text style={[styles.fieldLabel, { color: colors.text }]}>{label}</Text>}
    <TextInput ref={ref} accessibilityLabel={props.accessibilityLabel ?? label}
      placeholderTextColor={colors.mutedText} selectionColor={colors.accent}
      {...props} onFocus={event => { setFocused(true); onFocus?.(event); }} onBlur={event => { setFocused(false); onBlur?.(event); }} style={[styles.input, { color: colors.text, backgroundColor: colors.input,
        borderColor: error ? colors.danger : focused ? colors.accent : colors.border }, style]} />
    {!!error && <Text accessibilityRole="alert" accessibilityLiveRegion="polite"
      style={[styles.fieldError, { color: colors.danger }]}>{error}</Text>}
  </View>;
});
export function Card({ style, ...props }: ViewProps) {
  const { colors } = useTheme();
  return <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, style]} {...props} />;
}
export function FormCard({ style, ...props }: ViewProps) { return <Card style={[styles.formCard, style]} {...props} />; }
export function FormTitle({ style, ...props }: TextProps) { return <Title style={[styles.formTitle, style]} {...props} />; }
interface SkeletonProps { width?: DimensionValue; height?: DimensionValue; style?: StyleProp<ViewStyle>; }
export function Skeleton({ width = '100%', height = 16, style }: SkeletonProps) {
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(0.6)).current;
  const [reduceMotion, setReduceMotion] = useState(true);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => { if (mounted) setReduceMotion(enabled); }).catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { mounted = false; subscription.remove(); };
  }, []);
  useEffect(() => {
    if (reduceMotion) { opacity.setValue(0.6); return; }
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(opacity, { toValue: 0.35, duration: 800, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0.75, duration: 800, useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [opacity, reduceMotion]);
  return <Animated.View accessible={false}
    style={[styles.skeleton, { width, height, opacity, backgroundColor: colors.border }, style]} />;
}
interface StateViewProps {
  kind: 'loading' | 'empty' | 'error'; title?: string; message?: string; onRetry?: () => void;
}
export function StateView({ kind, title, message, onRetry }: StateViewProps) {
  const { colors } = useTheme();
  const { t } = useTranslation('common');
  if (kind === 'loading') return <View accessibilityRole="progressbar" accessibilityLabel={title ?? t('loading')} style={styles.loadingState}>
    <Skeleton width="60%" height={28} /><Skeleton height={160} />
    <Skeleton width="85%" /><Skeleton width="55%" />
    {!!title && <Body style={{ color: colors.mutedText }}>{title}</Body>}
  </View>;
  return <View style={styles.state} accessibilityLiveRegion="polite">
    <View style={[styles.stateIcon, { backgroundColor: colors.input }]}>
      <Icon name={kind === 'error' ? 'alert' : 'bag'} size={28} color={kind === 'error' ? colors.danger : colors.accentText} />
    </View>
    <Title style={styles.stateTitle}>{title ?? t(kind === 'error' ? 'errorTitle' : 'emptyTitle')}</Title>
    <Body style={[styles.stateMessage, { color: colors.mutedText }]}>{message ?? t(kind === 'error' ? 'errorMessage' : 'emptyMessage')}</Body>
    {!!onRetry && <Button title={t('retry')} onPress={onRetry} style={styles.retryButton} />}
  </View>;
}
export type TabIconName = 'home' | 'shop' | 'cart' | 'favorites' | 'categories' | 'profile';
export function TabIcon({ name, color }: { name: TabIconName; color: ColorValue }) {
  return <Icon name={name === 'favorites' ? 'heart' : name} color={String(color)} size={22} />;
}
const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  screenContent: { flexGrow: 1, padding: storefront.gutter, gap: spacing.xl },
  fixedContent: { flex: 1, paddingHorizontal: storefront.gutter, gap: spacing.xl },
  title: { fontFamily: typography.semibold, fontSize: typography.pageTitle, lineHeight: 38, letterSpacing: -0.6 },
  body: { fontFamily: typography.regular, fontSize: 14, lineHeight: 22 },
  button: { minHeight: 48, borderWidth: 1, borderRadius: radius.button, paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md, flexDirection: 'row', gap: spacing.sm, justifyContent: 'center', alignItems: 'center' },
  buttonLabel: { fontFamily: typography.semibold, fontSize: 14, lineHeight: 22 },
  field: { gap: spacing.sm },
  fieldLabel: { fontFamily: typography.medium, fontSize: 13, lineHeight: 18 },
  fieldError: { fontFamily: typography.regular, fontSize: 12, lineHeight: 18 },
  input: { minHeight: 48, borderWidth: 1, borderRadius: radius.headerControl,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md, fontFamily: typography.regular, fontSize: 16 },
  card: { borderWidth: 1, borderRadius: radius.card, padding: spacing.lg, gap: spacing.md },
  formCard: { padding: spacing.xxl, gap: spacing.xl, marginTop: spacing.xxl },
  formTitle: { fontSize: 24, lineHeight: 32, textAlign: 'center', marginBottom: spacing.sm },
  skeleton: { borderRadius: radius.headerControl },
  loadingState: { paddingVertical: spacing.xl, gap: spacing.lg },
  state: { paddingVertical: spacing.xxxl, gap: spacing.lg, alignItems: 'center' },
  stateIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  stateIconText: { fontFamily: typography.medium, fontSize: 32, lineHeight: 40 },
  stateTitle: { fontSize: 21, lineHeight: 29, textAlign: 'center' },
  stateMessage: { maxWidth: 300, textAlign: 'center' },
  retryButton: { alignSelf: 'stretch', marginTop: spacing.sm },
});
