import { useMemo } from 'react';
import { useThemeStore } from '@/store/themeStore';
import { colorTokens } from '@/constants/tokens';

/**
 * Theme hook that provides colors based on the active color scheme
 *
 * Returns an object with:
 * - colors: Merged color tokens (active scheme + shared colors)
 * - activeColorScheme: Current active scheme ('light' | 'dark')
 *
 * @example
 * const { colors, activeColorScheme } = useTheme();
 * <View style={{ backgroundColor: colors.background }}>
 *   <Text style={{ color: colors.text }}>Hello</Text>
 * </View>
 */
export const useTheme = () => {
  const activeColorScheme = useThemeStore((state) => state.activeColorScheme);
  const customPrimaryColor = useThemeStore((state) => state.customPrimaryColor);

  const colors = useMemo(() => {
    // Use custom primary color if set, otherwise use default primary
    const effectivePrimaryColor = customPrimaryColor || colorTokens.shared.primary;

    // Return merged colors with primary override and minimumTrackTintColor added
    return {
      ...colorTokens[activeColorScheme],
      ...colorTokens.shared,
      primary: effectivePrimaryColor,
      minimumTrackTintColor: effectivePrimaryColor,
    };
  }, [activeColorScheme, customPrimaryColor]);

  return {
    colors,
    activeColorScheme,
  };
};
