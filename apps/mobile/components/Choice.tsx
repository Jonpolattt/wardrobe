import { Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { Body } from './ui';

interface ChoiceProps {
  title: string;
  selected?: boolean;
  onPress: () => void;
  disabled?: boolean;
}

export function Choice({ title, selected, onPress, disabled }: ChoiceProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.choice,
        {
          borderColor: selected ? colors.text : colors.border,
          backgroundColor: selected ? colors.text : colors.surface,
          opacity: disabled ? 0.4 : 1,
        },
      ]}
    >
      <Body style={[styles.label, { color: selected ? colors.background : colors.bodyText }]}>
        {title}
      </Body>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  choice: { paddingHorizontal: 16, paddingVertical: 11, borderRadius: 100, borderWidth: 1 },
  label: { fontSize: 12 },
});
