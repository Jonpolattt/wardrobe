import { Pressable, StyleSheet, View } from 'react-native';
import { radius, spacing, typography } from '@wardrobe/theme';
import { useTheme } from '../hooks/useTheme';
import { Body } from './ui';
interface ChoiceProps { title: string; selected?: boolean; onPress: () => void; disabled?: boolean; swatch?: string; }
export function Choice({ title, selected, onPress, disabled, swatch }: ChoiceProps) {
  const { colors } = useTheme();
  return <Pressable accessibilityRole="button" accessibilityState={{ selected, disabled }} onPress={onPress} disabled={disabled}
    style={({ pressed }) => [styles.choice, { borderColor: selected ? colors.text : colors.border,
      backgroundColor: selected ? colors.text : 'transparent', opacity: disabled ? 0.4 : pressed ? 0.75 : 1 }]}>
    {!!swatch && <View style={[styles.swatch, { backgroundColor: swatch, borderColor: colors.border }]} />}
    <Body style={[styles.label, { color: selected ? colors.background : colors.bodyText, textDecorationLine: disabled ? 'line-through' : 'none' }]}>{title}</Body>
  </Pressable>;
}
const styles = StyleSheet.create({
  choice: { minHeight: 40, minWidth: 40, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radius.button, borderWidth: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: typography.semibold, fontSize: 12, lineHeight: 18 },
  swatch: { width: 12, height: 12, borderRadius: 6, borderWidth: 1 },
});