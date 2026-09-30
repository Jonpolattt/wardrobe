import React, { forwardRef, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo, ActivityIndicator, Animated, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
  type ColorValue, type DimensionValue, type PressableProps, type RefreshControlProps, type StyleProp,
  type TextInputProps, type TextProps, type ViewProps, type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { radius, spacing } from '@wardrobe/theme';
import { useTheme } from '../hooks/useTheme';

interface ScreenProps extends ViewProps {
  children: React.ReactNode; scroll?: boolean; contentContainerStyle?: StyleProp<ViewStyle>;
  refreshControl?: React.ReactElement<RefreshControlProps>;
}
export function Screen({ children, scroll = true, style, contentContainerStyle, refreshControl, ...props }: ScreenProps) {
  const { colors } = useTheme();
  return <SafeAreaView edges={['left', 'right', 'bottom']} style={[styles.safeArea, { backgroundColor: colors.background }, style]} {...props}>
    {scroll ? <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false} refreshControl={refreshControl}
      contentContainerStyle={[styles.screenContent, contentContainerStyle]}>{children}</ScrollView>
      : <View style={[styles.fixedContent, contentContainerStyle]}>{children}</View>}
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
  title: string; loading?: boolean; variant?: 'primary' | 'secondary' | 'danger'; style?: StyleProp<ViewStyle>;
}
export function Button({ title, loading = false, disabled = false, variant = 'primary', style, ...props }: ButtonProps) {
  const { colors } = useTheme();
  const isDisabled = disabled || loading;
  const backgroundColor = variant === 'secondary' ? colors.surface : variant === 'danger' ? colors.danger : colors.accent;
  const color = variant === 'secondary' ? colors.text : colors.onAccent;
  return <Pressable {...props} disabled={isDisabled} accessibilityRole="button"
    accessibilityState={{ disabled: isDisabled, busy: loading }}
    style={({ pressed }) => [styles.button, { backgroundColor,
      borderColor: variant === 'secondary' ? colors.border : backgroundColor,
      opacity: isDisabled ? 0.45 : pressed ? 0.85 : 1 }, style]}>
    {loading && <ActivityIndicator size="small" color={color} />}
    <Text style={[styles.buttonLabel, { color }]}>{title}</Text>
  </Pressable>;
}
interface FieldProps extends TextInputProps { label?: string; error?: string; }
export const Field = forwardRef<TextInput, FieldProps>(function Field({ label, error, style, ...props }, ref) {
  const { colors } = useTheme();
  return <View style={styles.field}>
    {!!label && <Text style={[styles.fieldLabel, { color: colors.text }]}>{label}</Text>}
    <TextInput ref={ref} accessibilityLabel={props.accessibilityLabel ?? label}
      placeholderTextColor={colors.mutedText} selectionColor={colors.accent}
      {...props} style={[styles.input, { color: colors.text, backgroundColor: colors.input,
        borderColor: error ? colors.danger : colors.border }, style]} />
    {!!error && <Text accessibilityRole="alert" accessibilityLiveRegion="polite"
      style={[styles.fieldError, { color: colors.danger }]}>{error}</Text>}
  </View>;
});
export function Card({ style, ...props }: ViewProps) {
  const { colors } = useTheme();
  return <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, style]} {...props} />;
}
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
      <Text accessible={false} style={[styles.stateIconText, { color: kind === 'error' ? colors.danger : colors.accentText }]}>{kind === 'error' ? '!' : '◇'}</Text>
    </View>
    <Title style={styles.stateTitle}>{title ?? t(kind === 'error' ? 'errorTitle' : 'emptyTitle')}</Title>
    <Body style={[styles.stateMessage, { color: colors.mutedText }]}>{message ?? t(kind === 'error' ? 'errorMessage' : 'emptyMessage')}</Body>
    {!!onRetry && <Button title={t('retry')} onPress={onRetry} style={styles.retryButton} />}
  </View>;
}
export type TabIconName = 'home' | 'shop' | 'cart' | 'favorites' | 'profile';
export function TabIcon({ name, color }: { name: TabIconName; color: ColorValue }) {
  if (name === 'favorites') return <Text accessible={false} style={{ color, fontSize: 28, lineHeight: 30 }}>♡</Text>;
  const stroke = { borderColor: color };
  return <View accessible={false} style={styles.tabIcon}>
    {name === 'home' && <>
      <View style={[styles.homeRoof, stroke]} /><View style={[styles.homeBody, stroke]} />
      <View style={[styles.homeDoor, stroke]} />
    </>}
    {name === 'shop' && <>
      <View style={[styles.bagHandle, stroke]} /><View style={[styles.bagBody, stroke]} />
    </>}
    {name === 'cart' && <>
      <View style={[styles.cartHandle, { backgroundColor: color }]} /><View style={[styles.cartBody, stroke]} />
      <View style={[styles.cartWheel, { left: 9, backgroundColor: color }]} />
      <View style={[styles.cartWheel, { left: 20, backgroundColor: color }]} />
    </>}
    {name === 'profile' && <>
      <View style={[styles.profileHead, stroke]} /><View style={[styles.profileBody, stroke]} />
    </>}
  </View>;
}
const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  screenContent: { flexGrow: 1, padding: spacing.xl, gap: spacing.xl, paddingBottom: spacing.xxxl },
  fixedContent: { flex: 1, padding: spacing.xl, gap: spacing.xl },
  title: { fontFamily: 'Inter_600SemiBold', fontSize: 25, lineHeight: 33, letterSpacing: -0.6 },
  body: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 22 },
  button: { minHeight: 48, borderWidth: 1, borderRadius: radius.button, paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md, flexDirection: 'row', gap: spacing.sm, justifyContent: 'center', alignItems: 'center' },
  buttonLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 14, lineHeight: 22 },
  field: { gap: spacing.sm },
  fieldLabel: { fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 18 },
  fieldError: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18 },
  input: { minHeight: 50, borderWidth: 1, borderRadius: radius.headerControl,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md, fontFamily: 'Inter_400Regular', fontSize: 16 },
  card: { borderWidth: 1, borderRadius: radius.card, padding: spacing.lg, gap: spacing.md },
  skeleton: { borderRadius: radius.headerControl },
  loadingState: { paddingVertical: spacing.xl, gap: spacing.lg },
  state: { paddingVertical: spacing.xxxl, gap: spacing.lg, alignItems: 'center' },
  stateIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  stateIconText: { fontFamily: 'Inter_500Medium', fontSize: 32, lineHeight: 40 },
  stateTitle: { fontSize: 21, lineHeight: 29, textAlign: 'center' },
  stateMessage: { maxWidth: 300, textAlign: 'center' },
  retryButton: { alignSelf: 'stretch', marginTop: spacing.sm },
  tabIcon: { width: 30, height: 30 },
  homeRoof: { position: 'absolute', top: 4, left: 8, width: 14, height: 14, borderLeftWidth: 1.8, borderTopWidth: 1.8, transform: [{ rotate: '45deg' }] },
  homeBody: { position: 'absolute', top: 13, left: 5, width: 20, height: 13, borderWidth: 1.8, borderTopWidth: 0, borderRadius: 2 },
  homeDoor: { position: 'absolute', top: 18, left: 12, width: 6, height: 8, borderWidth: 1.5, borderBottomWidth: 0 },
  bagHandle: { position: 'absolute', top: 3, left: 10, width: 10, height: 11, borderWidth: 1.8, borderRadius: 5 },
  bagBody: { position: 'absolute', top: 10, left: 5, width: 20, height: 16, borderWidth: 1.8, borderRadius: 3 },
  cartHandle: { position: 'absolute', top: 6, left: 3, width: 7, height: 2 },
  cartBody: { position: 'absolute', top: 8, left: 8, width: 18, height: 13, borderWidth: 1.8, borderTopWidth: 0, borderRadius: 3, transform: [{ skewX: '-10deg' }] },
  cartWheel: { position: 'absolute', top: 24, width: 4, height: 4, borderRadius: 2 },
  profileHead: { position: 'absolute', top: 3, left: 10, width: 10, height: 10, borderWidth: 1.8, borderRadius: 5 },
  profileBody: { position: 'absolute', top: 17, left: 5, width: 20, height: 10, borderWidth: 1.8, borderRadius: 9 },
});
