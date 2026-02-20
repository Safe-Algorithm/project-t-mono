import { useColorScheme } from 'react-native';
import { LightColors, DarkColors, ThemeColors } from '../constants/Theme';
import { useThemeStore } from '../store/themeStore';

export function useTheme(): { colors: ThemeColors; isDark: boolean } {
  const { preference } = useThemeStore();
  const systemScheme = useColorScheme();

  const isDark =
    preference === 'dark' ||
    (preference === 'system' && systemScheme === 'dark');

  return {
    colors: isDark ? DarkColors : LightColors,
    isDark,
  };
}
