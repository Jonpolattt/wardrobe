import { useColorScheme } from 'react-native';
import { themeColors } from '@wardrobe/theme';
import { usePreferences } from '../store/preferences';
export function useTheme() {
  const mode = usePreferences((state) => state.mode);
  const setMode = usePreferences((state) => state.setMode);
  const systemMode = useColorScheme();
  const isDark = mode === 'dark' || (mode === 'system' && systemMode === 'dark');
  return { colors: themeColors[isDark ? 'dark' : 'light'], mode, setMode, isDark };
}
